import { z } from "zod";

/**
 * The structured output Claude must return. Every field is required (use "" or []
 * for "nothing to report") so the schema works with structured outputs and the
 * UI never has to guess. Keep this file free of server-only imports — the UI uses the type.
 */
export const IssueSchema = z.object({
  title: z.string().describe("Short, specific headline, e.g. 'Hero image is lazy-loaded'"),
  category: z.enum(["performance", "seo", "geo", "accessibility"]),
  metric: z
    .enum(["LCP", "INP", "CLS", "TTFB", "FCP", "none"])
    .describe("Field metric this issue fixes, only if real users are above Good on it; otherwise 'none'"),
  severity: z.enum(["critical", "high", "medium", "low"]),
  evidence: z
    .string()
    .describe("The specific data points (audit ids, numbers, elements) that show the problem"),
  rootCause: z.string().describe("Why it happens — the underlying cause, not the symptom"),
  fix: z.string().describe("What to change, concretely"),
  codeSnippet: z
    .string()
    .describe("A short code example of the fix (HTML/JSX/config), or empty string if not applicable"),
  estimatedImpact: z.string().describe("Expected improvement, grounded in the data where possible"),
});

export const DiagnosisSchema = z.object({
  summary: z
    .string()
    .describe("2–4 sentences: overall state of the page and the single most important fix"),
  fieldVsLab: z
    .string()
    .describe(
      "How real-user (CrUX) data compares to the Lighthouse lab run and what that implies; say so if field data is missing",
    ),
  issues: z.array(IssueSchema).describe("Prioritized: most impactful first. 3–10 issues."),
  structuredData: z.object({
    assessment: z.string(),
    recommendedJsonLd: z
      .string()
      .describe("A complete JSON-LD block to add or replace, or empty string if current data is good"),
  }),
  aiCrawlers: z.object({
    assessment: z
      .string()
      .describe("Can AI search crawlers access and understand this page? Mention robots.txt and llms.txt"),
    recommendations: z.array(z.string()),
  }),
});

export type Issue = z.infer<typeof IssueSchema>;
export type Diagnosis = z.infer<typeof DiagnosisSchema>;
