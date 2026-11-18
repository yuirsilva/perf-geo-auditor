import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { SkeletonSuspense } from "skullet/react";
import { AuditForm } from "@/components/audit-form";
import { AuditStatus } from "@/components/audit-status";
import { Button } from "@/components/glaze/ui/button";
import { DataList, DataListItem, DataListLabel, DataListValue } from "@/components/glaze/ui/data-list";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/glaze/ui/empty-state";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemLink,
  ItemTitle,
} from "@/components/glaze/ui/item";
import { LocalTime } from "@/components/local-time";
import { db } from "@/db";
import { audit, type Audit } from "@/db/schema";
import { getUser } from "@/lib/auth";
import { SAMPLE_AUDIT_ROWS } from "@/lib/sample-data";

// The audit form's server action runs the whole audit in after(), which counts
// toward this page's limit. 300 s is the Vercel Hobby maximum; audits take ~60–100 s.
export const maxDuration = 300;

export default function Home() {
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-2">
        <h1 className="type-title max-w-measure">
          Find out <em>why</em> your page is slow, and how AI search sees it.
        </h1>
        <p className="type-body max-w-measure text-text-2">
          Combines real-user Core Web Vitals (CrUX), a Lighthouse run and a crawl of your HTML,
          then has Claude trace each problem to its root cause and write the fix.
        </p>
      </section>

      {/* The skeleton is the real dashboard rendered with sample audits, measured by Skullet. */}
      <SkeletonSuspense skeleton={<DashboardView audits={SAMPLE_AUDIT_ROWS} />} label="Loading your audits">
        <Dashboard />
      </SkeletonSuspense>
    </div>
  );
}

async function Dashboard() {
  const user = await getUser();
  if (!user) {
    return (
      <Button render={<Link href="/login" />} nativeButton={false} className="w-fit">
        Sign in to run an audit
      </Button>
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

  return <DashboardView audits={audits} />;
}

type DashboardRow = OverviewRow & { id: string; url: string; status: Audit["status"]; createdAt: Date };

/** The signed-in dashboard. Also rendered with sample audits for the skeleton, so it must not fetch. */
function DashboardView({ audits }: { audits: DashboardRow[] }) {
  const recent = audits.slice(0, 20);

  return (
    <div className="flex flex-col gap-8">
      <AuditForm />
      <Overview audits={audits} />
      <section className="flex flex-col gap-3">
        <h2 className="type-heading-sm">Your audits</h2>
        {recent.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>No audits yet</EmptyTitle>
              <EmptyDescription>Try your own site or a client&apos;s.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ItemGroup aria-label="Your audits">
            {recent.map((a) => (
              <Item key={a.id}>
                <ItemContent>
                  <ItemTitle>
                    {/* Wraps instead of truncating: audits of one site differ only in the path at the end. */}
                    <ItemLink
                      render={<Link href={`/audits/${a.id}`} />}
                      // "!": ItemLink's own truncate sets nowrap, which a plain whitespace-normal loses to.
                      className="whitespace-normal! wrap-anywhere"
                    >
                      {a.url}
                    </ItemLink>
                  </ItemTitle>
                  <ItemDescription>
                    <LocalTime date={a.createdAt} />
                  </ItemDescription>
                </ItemContent>
                <AuditStatus status={a.status} size="sm" />
              </Item>
            ))}
          </ItemGroup>
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
  const sec = (ms: number) => `${(ms / 1000).toFixed(1)} s`;

  // One list, not a row of equal stat cards: the numbers read as facts about the same audits.
  return (
    <section className="flex flex-col gap-3">
      <h2 className="type-heading-sm">Overview</h2>
      <DataList variant="panel">
        <DataListItem>
          <DataListLabel>Audits done</DataListLabel>
          {/* Each value is one string: DataListValue lays its children out with a gap. */}
          <DataListValue className="tabular-nums">
            {failed > 0 ? `${done.length}, ${failed} failed` : String(done.length)}
          </DataListValue>
        </DataListItem>
        <DataListItem>
          <DataListLabel>Median time</DataListLabel>
          <DataListValue className="tabular-nums">
            {totalMs == null
              ? null
              : collectMs != null && diagnoseMs != null
                ? `${sec(totalMs)} (data ${sec(collectMs)}, diagnosis ${sec(diagnoseMs)})`
                : sec(totalMs)}
          </DataListValue>
        </DataListItem>
        <DataListItem>
          <DataListLabel>Median cost</DataListLabel>
          <DataListValue className="tabular-nums">
            {cost == null ? null : `$${cost.toFixed(3)} for the Claude diagnosis`}
          </DataListValue>
        </DataListItem>
      </DataList>
    </section>
  );
}
