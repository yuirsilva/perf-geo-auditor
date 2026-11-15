import type { CrawlResult } from "@/lib/audit/crawl";
import type { PsiSummary } from "@/lib/audit/psi";

/** Human-readable summary of collected data, shared by `pnpm collect` and `pnpm fixture`. */
export function printPsi(p: PsiSummary) {
  console.log("== PageSpeed Insights ==");
  console.log("categories:", p.categories);
  console.log("field:", p.field ? `${p.field.scope}-level` : "none", p.field);
  console.log("lab:", Object.fromEntries(Object.entries(p.lab).map(([k, v]) => [k, v?.display])));
  console.log("top failing audits:");
  for (const a of p.failingAudits.slice(0, 8)) {
    console.log(`  - ${a.id} (${a.displayValue ?? a.score})`);
  }
}

export function printCrawl(c: CrawlResult) {
  console.log("\n== Crawl ==");
  console.log("status:", c.status, "html KB:", Math.round(c.htmlBytes / 1024));
  console.log("title:", c.meta.title);
  console.log("h1 count:", c.h1Count, "| images:", c.images.total, "missing alt:", c.images.missingAlt);
  console.log("blocking css/js in head:", c.head.blockingStylesheets, "/", c.head.blockingScripts);
  console.log("JSON-LD types:", c.structuredData.types);
  console.log("AI crawlers blocked:", c.aiCrawlers.blocked, "| llms.txt:", c.aiCrawlers.llmsTxtFound);
}
