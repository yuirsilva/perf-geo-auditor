import { and, eq, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { AuditProgress } from "@/components/audit-progress";
import { DocumentTitle } from "@/components/document-title";
import { LocalTime } from "@/components/local-time";
import { RerunButton } from "@/components/rerun-button";
import { AuditReport } from "@/components/audit-report";
import { ReportReveal } from "@/components/report-reveal";
import { AutoRefresh } from "@/components/auto-refresh";
import { StatusBadge } from "@/components/status-badge";
import { db } from "@/db";
import { audit } from "@/db/schema";
import { requireUser } from "@/lib/auth";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function AuditPage({ params }: PageProps<"/audits/[id]">) {
  // params are only known at request time, so read them behind a boundary.
  return (
    <Suspense fallback={<AuditSkeleton />}>
      <AuditView params={params} />
    </Suspense>
  );
}

/** Same shape as the report header and first row of tiles, so nothing jumps when it loads. */
function AuditSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-6 motion-safe:animate-pulse">
      <div className="flex flex-col gap-2">
        <div className="h-5 w-24 rounded bg-card" />
        <div className="h-5 w-56 rounded bg-card" />
        <div className="h-8 w-2/3 rounded bg-card" />
      </div>
      <div className="flex flex-col gap-3">
        <div className="h-7 w-48 rounded bg-card" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-[86px] rounded-lg bg-card" />
          ))}
        </div>
      </div>
    </div>
  );
}

async function AuditView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const user = await requireUser();
  // Scope by user so nobody can read someone else's audit by guessing an id.
  const [found] = await db
    .select({
      row: audit,
      // If the server is killed mid-audit (e.g. the 300 s function limit), the
      // catch in runAudit never runs and the status stays "collecting" or
      // "diagnosing". No step takes 6 minutes, so an audit that hasn't moved
      // is treated as stopped. Computed in SQL: render code must stay pure.
      quiet: sql<boolean>`${audit.updatedAt} < now() - interval '6 minutes'`,
    })
    .from(audit)
    .where(and(eq(audit.id, id), eq(audit.userId, user.id)));
  if (!found) notFound();
  const { row } = found;

  const running = row.status !== "done" && row.status !== "failed";
  const stalled = running && found.quiet;
  const inProgress = running && !stalled;
  const failed = stalled || row.status === "failed";

  const host = new URL(row.url).host;
  const tabTitle = failed
    ? `Failed · ${host}`
    : row.status === "done"
      ? `✓ Done · ${host}`
      : `${row.status === "diagnosing" ? "Diagnosing" : "Collecting"}… · ${host}`;

  return (
    <div className="flex flex-col gap-6">
      <DocumentTitle title={tabTitle} />
      <div className="flex flex-col gap-2">
        <Link href="/" className="w-fit text-sm text-muted transition-colors hover:text-foreground">
          ← Your audits
        </Link>
        <div className="flex items-center gap-3">
          <StatusBadge status={stalled ? "failed" : row.status} />
          <span className="text-sm text-muted">
            <LocalTime date={row.createdAt} withTime />
          </span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight [overflow-wrap:anywhere]">{row.url}</h1>
      </div>

      {inProgress && (
        <>
          <AutoRefresh intervalMs={3000} />
          <AuditProgress status={row.status} />
          <p className="-mt-3 text-sm text-muted">
            {row.status === "diagnosing"
              ? "Data collected. Claude is tracing root causes. This usually takes under a minute."
              : "Running Lighthouse and pulling real-user data. This takes 20–60 seconds."}
          </p>
        </>
      )}

      {failed && (
        <div role="alert" className="flex flex-col gap-3 rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm">
          <p>
            {stalled
              ? "This audit stopped before finishing, most likely because it hit the server's time limit."
              : (row.error ?? "The audit failed.")}
          </p>
          <RerunButton url={row.url} />
        </div>
      )}

      <ReportReveal running={inProgress}>
        <AuditReport audit={row} />
      </ReportReveal>
    </div>
  );
}
