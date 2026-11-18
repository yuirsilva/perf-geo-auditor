import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { Suspense } from "react";
import { AuditForm } from "@/components/audit-form";
import { buttonClass } from "@/components/button";
import { LocalTime } from "@/components/local-time";
import { StatusBadge } from "@/components/status-badge";
import { db } from "@/db";
import { audit } from "@/db/schema";
import { getUser } from "@/lib/auth";

// The audit form's server action runs the whole audit in after(), which counts
// toward this page's limit. 300 s is the Vercel Hobby maximum; audits take ~60–100 s.
export const maxDuration = 300;

export default function Home() {
  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Find out <em>why</em> your page is slow, and how AI search sees it.
        </h1>
        <p className="max-w-2xl text-muted">
          Combines real-user Core Web Vitals (CrUX), a Lighthouse run and a crawl of your HTML,
          then has Claude trace each problem to its root cause and write the fix.
        </p>
      </section>

      <Suspense fallback={<DashboardSkeleton />}>
        <Dashboard />
      </Suspense>
    </div>
  );
}

/** Same shape as the signed-in dashboard (form, 3 tiles, list), so nothing jumps when it loads. */
function DashboardSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-8 motion-safe:animate-pulse">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="h-[42px] flex-1 rounded-md bg-card" />
        <div className="h-10 rounded-md bg-card sm:h-[42px] sm:w-28" />
      </div>
      <div className="flex flex-col gap-3">
        <div className="h-5 w-24 rounded bg-card" />
        <div className="grid gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[86px] rounded-lg bg-card" />
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <div className="h-5 w-24 rounded bg-card" />
        <div className="h-48 rounded-lg bg-card" />
      </div>
    </div>
  );
}

async function Dashboard() {
  const user = await getUser();
  if (!user) {
    return (
      <Link href="/login" className={`${buttonClass} w-fit`}>
        Sign in to run an audit
      </Link>
    );
  }

  // Only small columns (no jsonb), so loading every audit for the overview stays cheap.
  const audits = await db
    .select({
      id: audit.id,
      url: audit.url,
      status: audit.status,
      createdAt: audit.createdAt,
      collectMs: audit.collectMs,
      diagnoseMs: audit.diagnoseMs,
      costUsd: audit.costUsd,
    })
    .from(audit)
    .where(eq(audit.userId, user.id))
    .orderBy(desc(audit.createdAt));
  const recent = audits.slice(0, 20);

  return (
    <div className="flex flex-col gap-8">
      <AuditForm />
      <Overview audits={audits} />
      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted">
          Your audits
        </h2>
        {recent.length === 0 ? (
          <p className="text-muted">No audits yet. Try your own site or a client&apos;s.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {recent.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/audits/${a.id}`}
                  className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-card"
                >
                  <span className="truncate">{a.url}</span>
                  <span className="flex shrink-0 items-center gap-3 text-sm text-muted">
                    <LocalTime date={a.createdAt} />
                    <StatusBadge status={a.status} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

type OverviewRow = {
  status: string;
  collectMs: number | null;
  diagnoseMs: number | null;
  costUsd: number | null;
};

function Overview({ audits }: { audits: OverviewRow[] }) {
  const done = audits.filter((a) => a.status === "done");
  if (done.length === 0) return null;
  const failed = audits.filter((a) => a.status === "failed").length;

  const totalMs = median(
    done.filter((a) => a.collectMs != null && a.diagnoseMs != null).map((a) => a.collectMs! + a.diagnoseMs!),
  );
  const collectMs = median(done.flatMap((a) => (a.collectMs != null ? [a.collectMs] : [])));
  const diagnoseMs = median(done.flatMap((a) => (a.diagnoseMs != null ? [a.diagnoseMs] : [])));
  const cost = median(done.flatMap((a) => (a.costUsd != null ? [a.costUsd] : [])));
  const sec = (ms: number | null) => (ms == null ? "–" : `${(ms / 1000).toFixed(1)} s`);

  const tiles = [
    { label: "Audits done", value: String(done.length), hint: failed ? `${failed} failed` : "none failed" },
    { label: "Median time", value: sec(totalMs), hint: `data ${sec(collectMs)} · diagnosis ${sec(diagnoseMs)}` },
    { label: "Median cost", value: cost == null ? "–" : `$${cost.toFixed(3)}`, hint: "Claude diagnosis only" },
  ];

  return (
    <section>
      <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted">Overview</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-lg border border-border p-3">
            <div className="text-xs uppercase tracking-wide text-muted">{t.label}</div>
            <div className="text-xl font-semibold tabular-nums">{t.value}</div>
            <div className="text-xs text-muted">{t.hint}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
