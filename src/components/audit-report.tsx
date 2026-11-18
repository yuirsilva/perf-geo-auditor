import type { Audit } from "@/db/schema";
import type { Issue } from "@/lib/audit/diagnosis-schema";
import type { FieldMetric, LabMetric } from "@/lib/audit/psi";

const CATEGORY_STYLE: Record<string, string> = {
  FAST: "text-green-600 dark:text-green-400",
  AVERAGE: "text-amber-600 dark:text-amber-400",
  SLOW: "text-red-600 dark:text-red-400",
};

const SEVERITY_STYLE: Record<Issue["severity"], string> = {
  critical: "bg-red-500/15 text-red-600 dark:text-red-400",
  high: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
  medium: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  low: "bg-card text-muted",
};

function fmtMs(ms: number) {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms)} ms`;
}

function FieldTile({ label, metric, format }: { label: string; metric: FieldMetric; format: (n: number) => string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      {metric ? (
        <div className={`text-xl font-semibold ${CATEGORY_STYLE[metric.category] ?? ""}`}>
          {format(metric.p75)}
        </div>
      ) : (
        <div className="text-xl font-semibold text-muted">n/a</div>
      )}
    </div>
  );
}

function LabTile({ label, metric }: { label: string; metric: LabMetric }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      <div className="text-xl font-semibold">{metric?.display || "n/a"}</div>
    </div>
  );
}

export function AuditReport({ audit }: { audit: Audit }) {
  const { psi, crawl, diagnosis } = audit;

  return (
    <div className="flex flex-col gap-8">
      {psi && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">
            Real users{" "}
            <span className="text-sm font-normal text-muted">
              (CrUX p75, {psi.field ? `${psi.field.scope}-level` : "no data for this page or origin"})
            </span>
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <FieldTile label="LCP" metric={psi.field?.lcpMs ?? null} format={fmtMs} />
            <FieldTile label="INP" metric={psi.field?.inpMs ?? null} format={fmtMs} />
            <FieldTile label="CLS" metric={psi.field?.cls ?? null} format={(n) => n.toFixed(2)} />
            <FieldTile label="TTFB" metric={psi.field?.ttfbMs ?? null} format={fmtMs} />
          </div>

          {/* When Lighthouse got a block page, its lab numbers and scores describe that page, not the site. */}
          {!psi.httpError && (
            <>
              <h2 className="mt-4 text-lg font-semibold">
                Lab <span className="text-sm font-normal text-muted">(Lighthouse {psi.lighthouseVersion}, {psi.strategy})</span>
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <LabTile label="LCP" metric={psi.lab.lcp} />
                <LabTile label="TBT" metric={psi.lab.tbt} />
                <LabTile label="CLS" metric={psi.lab.cls} />
                <LabTile label="FCP" metric={psi.lab.fcp} />
              </div>
              <div className="flex flex-wrap gap-4 text-sm text-muted">
                {Object.entries(psi.categories).map(([k, v]) => (
                  <span key={k}>
                    {k}: <strong className="text-foreground">{v ?? "–"}</strong>
                  </span>
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {diagnosis && (
        <>
          <section className="flex flex-col gap-2 rounded-lg bg-card p-4">
            <h2 className="text-lg font-semibold">Diagnosis</h2>
            <p>{diagnosis.summary}</p>
            <p className="text-sm text-muted">{diagnosis.fieldVsLab}</p>
          </section>

          <section className="flex flex-col gap-4">
            <h2 className="text-lg font-semibold">Issues, highest impact first</h2>
            {diagnosis.issues.map((issue, i) => (
              <article key={i} className="flex flex-col gap-2 rounded-lg border border-border p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${SEVERITY_STYLE[issue.severity]}`}>
                    {issue.severity}
                  </span>
                  <span className="text-xs uppercase tracking-wide text-muted">
                    {issue.category}
                    {issue.metric !== "none" && ` · ${issue.metric}`}
                  </span>
                </div>
                <h3 className="font-semibold">{issue.title}</h3>
                <dl className="grid gap-2 text-sm sm:grid-cols-[8rem_1fr]">
                  <dt className="text-muted">Evidence</dt>
                  <dd>{issue.evidence}</dd>
                  <dt className="text-muted">Root cause</dt>
                  <dd>{issue.rootCause}</dd>
                  <dt className="text-muted">Fix</dt>
                  <dd>{issue.fix}</dd>
                  <dt className="text-muted">Impact</dt>
                  <dd>{issue.estimatedImpact}</dd>
                </dl>
                {issue.codeSnippet && (
                  <pre className="overflow-x-auto rounded-md bg-card p-3 font-mono text-xs">
                    <code>{issue.codeSnippet}</code>
                  </pre>
                )}
              </article>
            ))}
          </section>

          <section className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2 rounded-lg border border-border p-4">
              <h2 className="font-semibold">AI crawlers (GEO)</h2>
              <p className="text-sm">{diagnosis.aiCrawlers.assessment}</p>
              {crawl && (
                <p className="text-xs text-muted">
                  Blocked: {crawl.aiCrawlers.blocked.join(", ") || "none"} · llms.txt:{" "}
                  {crawl.aiCrawlers.llmsTxtFound ? "found" : "missing"}
                </p>
              )}
              <ul className="list-disc pl-5 text-sm">
                {diagnosis.aiCrawlers.recommendations.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col gap-2 rounded-lg border border-border p-4">
              <h2 className="font-semibold">Structured data</h2>
              <p className="text-sm">{diagnosis.structuredData.assessment}</p>
              {diagnosis.structuredData.recommendedJsonLd && (
                <pre className="overflow-x-auto rounded-md bg-card p-3 font-mono text-xs">
                  <code>{diagnosis.structuredData.recommendedJsonLd}</code>
                </pre>
              )}
            </div>
          </section>

          <p className="text-xs text-muted">
            {audit.model} · {audit.inputTokens?.toLocaleString()} in / {audit.outputTokens?.toLocaleString()} out
            {audit.costUsd != null && ` · ~$${audit.costUsd.toFixed(3)}`}
            {audit.collectMs != null && ` · data ${fmtMs(audit.collectMs)}`}
            {audit.diagnoseMs != null && ` · diagnosis ${fmtMs(audit.diagnoseMs)}`}
          </p>
        </>
      )}
    </div>
  );
}
