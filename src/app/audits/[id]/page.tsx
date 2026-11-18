import { and, eq, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import { SkeletonSuspense } from "skullet/react";
import { AuditBreadcrumb } from "@/components/audit-breadcrumb";
import { AuditReport } from "@/components/audit-report";
import { AuditStatus } from "@/components/audit-status";
import { AutoRefresh } from "@/components/auto-refresh";
import { DocumentTitle } from "@/components/document-title";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/glaze/ui/alert";
import {
  Step,
  StepDescription,
  StepIndicator,
  StepSeparator,
  StepText,
  StepTitle,
  StepTrigger,
  Steps,
} from "@/components/glaze/ui/steps";
import { LocalTime } from "@/components/local-time";
import { RerunButton } from "@/components/rerun-button";
import { db } from "@/db";
import { audit, type Audit } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { SAMPLE_AUDIT } from "@/lib/sample-data";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function AuditPage({ params }: PageProps<"/audits/[id]">) {
  // params are only known at request time, so read them behind a boundary. Its skeleton is the real report
  // rendered with a sample audit, measured by Skullet.
  return (
    <SkeletonSuspense skeleton={<AuditBody row={SAMPLE_AUDIT} stalled={false} />} label="Loading audit">
      <AuditView params={params} />
    </SkeletonSuspense>
  );
}

const STEPS = [
  { title: "Collect data", description: "Lighthouse and real-user data" },
  { title: "Diagnose", description: "Claude traces root causes" },
  { title: "Report", description: "Fixes, highest impact first" },
] as const;

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
      ? `Done · ${host}`
      : `${row.status === "diagnosing" ? "Diagnosing" : "Collecting"}… · ${host}`;

  return (
    <>
      {/* Side effects live here, not in AuditBody, so the skeleton never sets the title or starts refreshing. */}
      <DocumentTitle title={tabTitle} />
      {inProgress && <AutoRefresh intervalMs={3000} />}
      <AuditBody row={row} stalled={stalled} />
    </>
  );
}

/** The report screen. Also rendered with a sample audit for the skeleton, so it must not fetch or run effects. */
function AuditBody({ row, stalled }: { row: Audit; stalled: boolean }) {
  const running = row.status !== "done" && row.status !== "failed";
  const inProgress = running && !stalled;
  const failed = stalled || row.status === "failed";
  // Queued and collecting are step 1; diagnosing is step 2.
  const currentStep = row.status === "diagnosing" ? 2 : 1;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <AuditBreadcrumb host={new URL(row.url).host} />
        <h1 className="type-title wrap-anywhere">{row.url}</h1>
        <div className="flex flex-wrap items-center gap-3">
          {/* The one status this page watches, so it alone is live. */}
          <AuditStatus status={stalled ? "failed" : row.status} live />
          <span className="type-body-sm text-text-2">
            <LocalTime date={row.createdAt} withTime />
          </span>
        </div>
      </div>

      {inProgress && (
        <>
          <Steps value={currentStep} aria-label="Audit progress">
            {STEPS.map((step, i) => (
              <Step
                key={step.title}
                step={i + 1}
                state={i + 1 === currentStep && row.status !== "queued" ? "pending" : undefined}
              >
                <StepTrigger>
                  <StepIndicator />
                  <StepText>
                    <StepTitle>{step.title}</StepTitle>
                    <StepDescription>{step.description}</StepDescription>
                  </StepText>
                </StepTrigger>
                <StepSeparator />
              </Step>
            ))}
          </Steps>
          <p className="type-body-sm text-text-2">
            {row.status === "diagnosing"
              ? "Data collected. Claude is tracing root causes. This usually takes under a minute."
              : "Running Lighthouse and pulling real-user data. This takes 20–60 seconds."}
          </p>
        </>
      )}

      {failed && (
        <Alert status="fail">
          <AlertTitle>This audit didn&apos;t finish</AlertTitle>
          <AlertDescription>
            {stalled
              ? "It stopped before finishing, most likely because it hit the server's time limit."
              : (row.error ?? "The audit failed.")}
          </AlertDescription>
          <AlertAction>
            <RerunButton url={row.url} />
          </AlertAction>
        </Alert>
      )}

      <AuditReport audit={row} />
    </div>
  );
}
