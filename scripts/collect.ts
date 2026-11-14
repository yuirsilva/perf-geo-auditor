/**
 * Runs the data-collection half of an audit (PageSpeed Insights + crawl) for a URL
 * and prints a summary. No database, no Claude call, so it costs nothing.
 *
 *   pnpm collect https://example.com
 *
 * Useful for building the eval set: save the output for each site, then write
 * down what a correct diagnosis should say.
 */
import "dotenv/config";
import { crawlPage } from "@/lib/audit/crawl";
import { runPsi } from "@/lib/audit/psi";
import { assertPublicUrl } from "@/lib/audit/url-guard";

async function main() {
  const input = process.argv[2];
  if (!input) {
    console.error("Usage: pnpm collect <url>");
    process.exit(1);
  }
  const url = (await assertPublicUrl(input)).toString();

  const [psi, crawl] = await Promise.allSettled([runPsi(url), crawlPage(url)]);

  if (psi.status === "fulfilled") {
    const p = psi.value;
    console.log("== PageSpeed Insights ==");
    console.log("categories:", p.categories);
    console.log("field:", p.field ? `${p.field.scope}-level` : "none", p.field);
    console.log("lab:", Object.fromEntries(Object.entries(p.lab).map(([k, v]) => [k, v?.display])));
    console.log("top failing audits:");
    for (const a of p.failingAudits.slice(0, 8)) {
      console.log(`  - ${a.id} (${a.displayValue ?? a.score})`);
    }
  } else {
    console.log("PSI failed:", psi.reason.message);
  }

  if (crawl.status === "fulfilled") {
    const c = crawl.value;
    console.log("\n== Crawl ==");
    console.log("status:", c.status, "html KB:", Math.round(c.htmlBytes / 1024));
    console.log("title:", c.meta.title);
    console.log("h1 count:", c.h1Count, "| images:", c.images.total, "missing alt:", c.images.missingAlt);
    console.log("blocking css/js in head:", c.head.blockingStylesheets, "/", c.head.blockingScripts);
    console.log("JSON-LD types:", c.structuredData.types);
    console.log("AI crawlers blocked:", c.aiCrawlers.blocked, "| llms.txt:", c.aiCrawlers.llmsTxtFound);
  } else {
    console.log("Crawl failed:", crawl.reason.message);
  }
}

main();
