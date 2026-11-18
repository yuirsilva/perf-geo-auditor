import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/glaze/ui/card";
import { CodeBlock } from "@/components/glaze/ui/code-block";
import { DataList, DataListItem, DataListLabel, DataListValue } from "@/components/glaze/ui/data-list";
import { Status, type StatusValue } from "@/components/glaze/ui/status";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/glaze/ui/table";
import type { Audit } from "@/db/schema";
import type { FieldMetric, LabMetric } from "@/lib/audit/psi";
import { EMPTY_VALUE } from "@/lib/glaze/data";

// CrUX's buckets as an outcome: a glyph and a word, never colour alone.
const RATING: Record<string, { status: StatusValue; word: string }> = {
  FAST: { status: "ok", word: "Good" },
  AVERAGE: { status: "warn", word: "Needs work" },
  SLOW: { status: "fail", word: "Poor" },
};

// Lighthouse category ids, as people read them.
const LIGHTHOUSE_LABEL: Record<string, string> = {
  performance: "Performance",
  accessibility: "Accessibility",
  "best-practices": "Best practices",
  seo: "SEO",
};

const SEVERITY_LABEL: Record<string, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

function fmtMs(ms: number) {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms)} ms`;
}

type VitalRow = {
  name: string;
  field: FieldMetric | undefined;
  format: (n: number) => string;
  lab: LabMetric | undefined;
};

export function AuditReport({ audit }: { audit: Audit }) {
  const { psi, crawl, diagnosis } = audit;
  // When Lighthouse got a block page, its lab numbers and scores describe that page, not the site.
  const lab = psi && !psi.httpError ? psi.lab : null;

  const vitals: VitalRow[] = psi
    ? [
        { name: "LCP", field: psi.field?.lcpMs, format: fmtMs, lab: lab?.lcp },
        { name: "INP", field: psi.field?.inpMs, format: fmtMs, lab: undefined },
        { name: "CLS", field: psi.field?.cls, format: (n) => n.toFixed(2), lab: lab?.cls },
        { name: "TTFB", field: psi.field?.ttfbMs, format: fmtMs, lab: undefined },
        { name: "TBT", field: undefined, format: fmtMs, lab: lab?.tbt },
        { name: "FCP", field: undefined, format: fmtMs, lab: lab?.fcp },
      ]
    : [];

  return (
    <div className="flex flex-col gap-8">
      {psi && (
        <section className="flex flex-col gap-3">
          <p className="type-body-sm text-text-2">
            Real users: CrUX p75, {psi.field ? `${psi.field.scope}-level` : "no data for this page or origin"}.
            {lab && ` Lab: Lighthouse ${psi.lighthouseVersion}, ${psi.strategy}.`}
          </p>
          <Table title="Core Web Vitals">
            <TableHeader>
              <TableRow>
                <TableHead>Metric</TableHead>
                <TableHead numeric>Real users</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead numeric>Lab</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vitals.map((v) => {
                const rating = v.field ? RATING[v.field.category] : undefined;
                return (
                  <TableRow key={v.name}>
                    <TableCell>{v.name}</TableCell>
                    <TableCell numeric>{v.field ? v.format(v.field.p75) : EMPTY_VALUE}</TableCell>
                    <TableCell>
                      {rating ? (
                        <Status status={rating.status} size="sm">
                          {rating.word}
                        </Status>
                      ) : (
                        <span className="text-text-3">{EMPTY_VALUE}</span>
                      )}
                    </TableCell>
                    <TableCell numeric>{v.lab?.display || EMPTY_VALUE}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {lab && (
            <DataList variant="panel">
              {Object.entries(psi.categories).map(([k, v]) => (
                <DataListItem key={k}>
                  <DataListLabel>{LIGHTHOUSE_LABEL[k] ?? k}</DataListLabel>
                  <DataListValue className="tabular-nums">{v}</DataListValue>
                </DataListItem>
              ))}
            </DataList>
          )}
        </section>
      )}

      {diagnosis && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Diagnosis</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <p className="type-body">{diagnosis.summary}</p>
              <p className="type-body-sm text-text-2">{diagnosis.fieldVsLab}</p>
            </CardContent>
          </Card>

          <section className="flex flex-col gap-3">
            <h2 className="type-heading">Issues, highest impact first</h2>
            {diagnosis.issues.map((issue, i) => (
              <Card key={i}>
                <CardHeader>
                  <CardTitle>{issue.title}</CardTitle>
                  <CardDescription>
                    {SEVERITY_LABEL[issue.severity] ?? issue.severity} severity · {issue.category}
                    {issue.metric !== "none" && ` · ${issue.metric}`}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <DataList>
                    <DataListItem>
                      <DataListLabel>Evidence</DataListLabel>
                      <DataListValue>{issue.evidence}</DataListValue>
                    </DataListItem>
                    <DataListItem>
                      <DataListLabel>Root cause</DataListLabel>
                      <DataListValue>{issue.rootCause}</DataListValue>
                    </DataListItem>
                    <DataListItem>
                      <DataListLabel>Fix</DataListLabel>
                      <DataListValue>{issue.fix}</DataListValue>
                    </DataListItem>
                    <DataListItem>
                      <DataListLabel>Impact</DataListLabel>
                      <DataListValue>{issue.estimatedImpact}</DataListValue>
                    </DataListItem>
                  </DataList>
                  {/* No header: the snippet has no filename, and its language is unknown, so the header could only say
                      "Text". Each block is named after its issue instead, so its controls are told apart. */}
                  {issue.codeSnippet && (
                    <CodeBlock
                      code={issue.codeSnippet}
                      header={false}
                      maxLines={30}
                      aria-label={`Fix for ${issue.title}`}
                      copyLabel={`Copy the fix for ${issue.title}`}
                    />
                  )}
                </CardContent>
              </Card>
            ))}
          </section>

          {/* min-w-0: grid items won't shrink below a long code block otherwise, which widens the whole page. */}
          <section className="grid gap-3 sm:grid-cols-2 *:min-w-0">
            <Card>
              <CardHeader>
                <CardTitle>AI crawlers</CardTitle>
                {crawl && (
                  <CardDescription>
                    Blocked: {crawl.aiCrawlers.blocked.join(", ") || "none"}. llms.txt{" "}
                    {crawl.aiCrawlers.llmsTxtFound ? "found" : "missing"}.
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <p className="type-body-sm">{diagnosis.aiCrawlers.assessment}</p>
                <ul className="type-body-sm list-disc ps-5">
                  {diagnosis.aiCrawlers.recommendations.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Structured data</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <p className="type-body-sm">{diagnosis.structuredData.assessment}</p>
                {diagnosis.structuredData.recommendedJsonLd && (
                  <CodeBlock
                    code={diagnosis.structuredData.recommendedJsonLd}
                    language="json"
                    maxLines={30}
                    aria-label="Recommended JSON-LD"
                    copyLabel="Copy the recommended JSON-LD"
                  />
                )}
              </CardContent>
            </Card>
          </section>

          <p className="type-caption text-text-3">
            {audit.model} · {audit.inputTokens?.toLocaleString()} in / {audit.outputTokens?.toLocaleString()} out
            {audit.costUsd != null && ` · about $${audit.costUsd.toFixed(3)}`}
            {audit.collectMs != null && ` · data ${fmtMs(audit.collectMs)}`}
            {audit.diagnoseMs != null && ` · diagnosis ${fmtMs(audit.diagnoseMs)}`}
          </p>
        </>
      )}
    </div>
  );
}
