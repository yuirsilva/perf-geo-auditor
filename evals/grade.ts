import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { PRICES } from "@/lib/audit/diagnose";
import type { Diagnosis } from "@/lib/audit/diagnosis-schema";
import type { Expected, Metric } from "./dataset";

/**
 * Grades one diagnosis against one dataset entry.
 *
 * - topIssueMetric and mustNotFlag are checked by code (free, exact).
 * - Each mustFind line is checked by an LLM judge, because the same finding
 *   can be worded many ways ("slow server response" vs "high TTFB").
 */

const client = new Anthropic();
export const JUDGE_MODEL = process.env.JUDGE_MODEL ?? "claude-haiku-5-5";

// Reason comes first so the judge thinks before it decides.
const Verdict = z.object({
  reason: z.string().describe("One or two sentences: where the diagnosis says it, or why it doesn't"),
  found: z.boolean(),
});

const JUDGE_SYSTEM = `You check whether a web performance diagnosis contains one expected finding.

The diagnosis is JSON with a summary, a field-vs-lab comparison, a list of issues, a structured-data assessment and an AI-crawler assessment. The finding can appear anywhere in it.

Count the finding as found when the diagnosis makes the same point, even in different words, with rounded numbers, or split across fields.
Do not count it when the diagnosis only mentions something loosely related, or says the opposite.

Give your reason first, then the verdict.`;

export type GradeResult = {
  topIssue: { expected: Metric[]; actual: string | null; pass: boolean } | null;
  mustNotFlag: { metric: Metric; pass: boolean; flaggedBy: string[] }[];
  mustFind: { finding: string; found: boolean; reason: string }[];
  passed: number;
  total: number;
  judgeCostUsd: number;
};

export async function grade(diagnosis: Diagnosis, expected: Expected): Promise<GradeResult> {
  // 1. Top issue: the metric of Claude's first issue must be one of the accepted ones.
  let topIssue: GradeResult["topIssue"] = null;
  if (expected.topIssueMetric) {
    const accepted = Array.isArray(expected.topIssueMetric) ? expected.topIssueMetric : [expected.topIssueMetric];
    const actual = diagnosis.issues[0]?.metric ?? null;
    topIssue = { expected: accepted, actual, pass: actual !== null && (accepted as string[]).includes(actual) };
  }

  // 2. Must not flag: no issue may be about these metrics.
  const mustNotFlag = expected.mustNotFlag.map((metric) => {
    const flaggedBy = diagnosis.issues.filter((i) => i.metric === metric).map((i) => i.title);
    return { metric, pass: flaggedBy.length === 0, flaggedBy };
  });

  // 3. Must find: one judge call per line, all in parallel.
  const diagnosisJson = JSON.stringify(diagnosis, null, 2);
  const judged = await Promise.all(expected.mustFind.map((finding) => judge(diagnosisJson, finding)));
  const mustFind = judged.map((j, i) => ({ finding: expected.mustFind[i], found: j.found, reason: j.reason }));
  const judgeCostUsd = judged.reduce((sum, j) => sum + j.costUsd, 0);

  const checks = [
    ...(topIssue ? [topIssue.pass] : []),
    ...mustNotFlag.map((c) => c.pass),
    ...mustFind.map((c) => c.found),
  ];
  return {
    topIssue,
    mustNotFlag,
    mustFind,
    passed: checks.filter(Boolean).length,
    total: checks.length,
    judgeCostUsd,
  };
}

async function judge(diagnosisJson: string, finding: string) {
  const response = await client.messages.parse({
    model: JUDGE_MODEL,
    max_tokens: 2000,
    output_config: { effort: "low", format: zodOutputFormat(Verdict) },
    system: JUDGE_SYSTEM,
    messages: [
      {
        role: "user",
        // Diagnosis first, finding last: the diagnosis is the same for every
        // finding of a site, so this order lets prompt caching reuse it.
        content: [
          { type: "text", text: `<diagnosis>\n${diagnosisJson}\n</diagnosis>`, cache_control: { type: "ephemeral" } },
          { type: "text", text: `<expected_finding>\n${finding}\n</expected_finding>` },
        ],
      },
    ],
  });

  if (response.stop_reason === "refusal") throw new Error(`Judge declined to grade "${finding}"`);
  if (!response.parsed_output) throw new Error(`Judge returned no verdict for "${finding}" (${response.stop_reason})`);

  const u = response.usage;
  const price = PRICES[JUDGE_MODEL];
  const costUsd = price
    ? (u.input_tokens * price.input +
        (u.cache_creation_input_tokens ?? 0) * price.input * 1.25 +
        (u.cache_read_input_tokens ?? 0) * price.input * 0.1 +
        u.output_tokens * price.output) /
      1_000_000
    : 0;

  return { ...response.parsed_output, costUsd };
}
