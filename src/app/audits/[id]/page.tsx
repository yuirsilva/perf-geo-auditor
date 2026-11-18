import { and, eq, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AuditReport } from "@/components/audit-report";
import { AutoRefresh } from "@/components/auto-refresh";
import { StatusBadge } from "@/components/status-badge";
import { db } from "@/db";
import { audit } from "@/db/schema";
import { requireUser } from "@/lib/auth";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function AuditPage({ params }: PageProps<"/audits/[id]">) {
  // params are only known at request time, so read them behind a boundary.
  return (
    <Suspense fallback={<div className="h-40 animate-pulse rounded-lg bg-card" />}>
      <AuditView params={params} />
    </Suspense>
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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <StatusBadge status={stalled ? "failed" : row.status} />
          <span className="text-sm text-muted">{row.createdAt.toLocaleString()}</span>
        </div>
        <h1 className="break-all text-2xl font-semibold">{row.url}</h1>
      </div>

      {inProgress && (
        <>
          <AutoRefresh intervalMs={3000} />
          <p className="text-muted">
            {row.status === "diagnosing"
              ? "Data collected. Claude is tracing root causes. This usually takes under a minute."
              : "Running Lighthouse and pulling real-user data. This takes 20–60 seconds."}
          </p>
        </>
      )}

      {stalled && (
        <p role="alert" className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm">
          This audit stopped before finishing, most likely because it hit the server&apos;s time limit. Run it again.
        </p>
      )}

      {row.status === "failed" && (
        <p role="alert" className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm">
          {row.error ?? "The audit failed."}
        </p>
      )}

      <AuditReport audit={row} />
    </div>
  );
}
