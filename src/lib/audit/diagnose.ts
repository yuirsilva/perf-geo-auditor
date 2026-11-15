import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat, betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { CrawlResult } from "./crawl";
import { DiagnosisSchema, type Diagnosis } from "./diagnosis-schema";
import type { PsiSummary } from "./psi";
import { safeFetch } from "./url-guard";

const client = new Anthropic();

// Haiku for development and eval iteration (~$0.01/audit). Compare against
// claude-sonnet-5-5 / claude-opus-5-5 on the evals before deciding on production.
const MODEL = process.env.AUDIT_MODEL ?? "claude-haiku-5-5";

// Server-side refusal fallbacks exist on these models only (not on Haiku 5.5).
const SUPPORTS_FALLBACKS = ["claude-opus-5-5", "claude-sonnet-5-5", "claude-fable-5-2"];
type Effort = "low" | "medium" | "high" | "xhigh" | "max";
const EFFORT = (process.env.AUDIT_EFFORT ?? "medium") as Effort;

// $ per 1M tokens (input, output). Cache reads are ~0.1x input, writes ~1.25x.
export const PRICES: Record<string, { input: number; output: number }> = {
  "claude-opus-5-5": { input: 4, output: 20 },
  "claude-sonnet-5-5": { input: 2, output: 10 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5 },
};

// Stable across requests so prompt caching can kick in. Don't put per-request data here.
const SYSTEM_PROMPT = `You are a senior web performance and technical SEO engineer.
You diagnose why a page is slow or hard for search engines and AI assistants to understand, and you explain fixes a front-end developer can ship today.

You receive:
- Core Web Vitals field data from CrUX (real users, p75) when the page or origin has enough traffic.
- A Lighthouse lab run (mobile, simulated throttling) with category scores and failing audits.
- A crawl of the HTML: meta tags, headings, images, render-blocking resources, scripts, JSON-LD, robots.txt rules for AI crawlers, and llms.txt.

How to work:
- Field data reflects real users and decides whether a Core Web Vital passes. Use lab data to explain *why*.
- Before blaming something, look at the evidence. Call get_lighthouse_audit to read an audit's rows (e.g. the LCP element, render-blocking URLs, unused JS by script). Call inspect_resource to check a specific asset's size, compression and caching headers when it matters.
- Go for root causes ("the LCP image is discovered late because it's a CSS background") over generic advice ("optimize images").
- Name the framework when the HTML makes it obvious (Next.js, Shopify, WordPress...) and tailor code snippets to it.
- Every issue must cite concrete evidence from the data. If the data doesn't support a claim, don't make it.
- GEO (generative engine optimization): check whether AI crawlers are blocked, whether the content is server-rendered and readable without JS, and whether structured data describes the page well.
- Prioritize: the first issue should be the change with the biggest real-user impact.
- Always report images missing alt text.

Core Web Vitals thresholds (field p75):
| Metric | Good    | Poor    |
| LCP    | ≤2500ms | >4000ms |
| INP    | ≤200ms  | >500ms  |
| CLS    | ≤0.1    | >0.25   |
| FCP    | ≤1800ms | >3000ms |
| TTFB   | ≤800ms  | >1800ms |

- A page passes Core Web Vitals only when LCP, INP and CLS are all Good. Between Good and Poor is "needs improvement", which is not a pass. If a metric has no field data, say its status can't be confirmed.
- Rank issues by how far each field metric is above its Good limit (p75 ÷ Good). Then account for causes: TTFB is part of LCP, so a slow server can come before a slow LCP.
- Only set an issue's metric to a field metric that is above Good. If real users are already fine on that metric, use "none" and say the gain is lab-only.
- Label an issue by the metric its fix moves most directly. A server or HTML caching fix is TTFB, even though it also helps FCP and LCP.
`;

export type DiagnoseResult = {
  diagnosis: Diagnosis;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number | null;
};

export async function diagnose(input: {
  url: string;
  psi: PsiSummary;
  crawl: CrawlResult;
}): Promise<DiagnoseResult> {
  const { url, psi, crawl } = input;
  const auditsById = new Map(psi.failingAudits.map((a) => [a.id, a]));

  const getLighthouseAudit = betaZodTool({
    name: "get_lighthouse_audit",
    description:
      "Return the full details (description and table rows) of one failing Lighthouse audit, by its id from the failingAudits list.",
    inputSchema: z.object({ id: z.string().describe("Lighthouse audit id, e.g. 'largest-contentful-paint-element'") }),
    run: async ({ id }) => {
      const audit = auditsById.get(id);
      return audit
        ? JSON.stringify(audit)
        : `No failing audit with id "${id}". Available ids: ${[...auditsById.keys()].join(", ")}`;
    },
  });

  const inspectResource = betaZodTool({
    name: "inspect_resource",
    description:
      "Fetch the response headers of a public asset (image, script, stylesheet, font) to check its size, type, compression and caching. Does not return the body.",
    inputSchema: z.object({ url: z.string().describe("Absolute URL of the asset") }),
    run: async ({ url: assetUrl }) => {
      try {
        let res = await safeFetch(assetUrl, { method: "HEAD", timeoutMs: 8_000 });
        if (res.status === 405 || res.status === 403) {
          res = await safeFetch(assetUrl, { headers: { range: "bytes=0-0" }, timeoutMs: 8_000 });
          await res.body?.cancel();
        }
        const h = (name: string) => res.headers.get(name);
        return JSON.stringify({
          status: res.status,
          contentType: h("content-type"),
          contentLength: h("content-length") ?? h("content-range"),
          contentEncoding: h("content-encoding"),
          cacheControl: h("cache-control"),
          age: h("age"),
          cdn: h("server") ?? h("via") ?? h("x-cache"),
        });
      } catch (err) {
        return `Could not fetch: ${(err as Error).message}`;
      }
    },
  });

  // Keep the first message compact: audit rows are pulled on demand via the tool.
  const payload = {
    url,
    finalUrl: psi.finalUrl,
    strategy: psi.strategy,
    categories: psi.categories,
    field: psi.field,
    lab: psi.lab,
    failingAudits: psi.failingAudits.map(({ id, title, displayValue, score, savingsMs }) => ({
      id,
      title,
      displayValue,
      score,
      savingsMs,
    })),
    crawl,
  };

  const runner = client.beta.messages.toolRunner({
    model: MODEL,
    // Non-streaming requests are capped so the SDK's 10-minute timeout is never at risk.
    max_tokens: 16000,
    max_iterations: 12,
    thread: false,
    // If the model declines, the API retries the request on a fallback model.
    ...(SUPPORTS_FALLBACKS.includes(MODEL)
      ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }
      : {}),
    cache_control: { type: "ephemeral" },
    system: SYSTEM_PROMPT,
    output_config: { effort: EFFORT, format: betaZodOutputFormat(DiagnosisSchema) },
    tools: [getLighthouseAudit, inspectResource],
    messages: [
      {
        role: "user",
        content: `Diagnose this page.\n\n<audit_data>\n${JSON.stringify(payload)}\n</audit_data>`,
      },
    ],
  });

  // Iterate so we can sum token usage across every turn of the tool loop.
  let inputTokens = 0;
  let outputTokens = 0;
  let cacheRead = 0;
  let cacheWrite = 0;
  let final: Anthropic.Beta.BetaMessage | undefined;
  for await (const message of runner) {
    inputTokens += message.usage.input_tokens;
    outputTokens += message.usage.output_tokens;
    cacheRead += message.usage.cache_read_input_tokens ?? 0;
    cacheWrite += message.usage.cache_creation_input_tokens ?? 0;
    final = message;
  }

  if (!final) throw new Error("Claude returned no response.");
  if (final.stop_reason === "refusal") {
    throw new Error(`Claude declined to diagnose this page (${final.stop_details?.category ?? "no category"}).`);
  }
  if (final.stop_reason === "max_tokens") {
    throw new Error("Diagnosis was cut off (max_tokens). Try again or lower the effort.");
  }

  const text = final.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  const diagnosis = DiagnosisSchema.parse(JSON.parse(text));

  const price = PRICES[final.model] ?? PRICES[MODEL];
  const costUsd = price
    ? (inputTokens * price.input +
        cacheWrite * price.input * 1.25 +
        cacheRead * price.input * 0.1 +
        outputTokens * price.output) /
      1_000_000
    : null;

  return {
    diagnosis,
    model: final.model,
    inputTokens: inputTokens + cacheRead + cacheWrite,
    outputTokens,
    costUsd,
  };
}
