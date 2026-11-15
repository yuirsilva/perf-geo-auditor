/**
 * Runs the data-collection half of an audit (PageSpeed Insights + crawl) for a URL
 * and prints a summary. No database, no Claude call, so it costs nothing.
 *
 *   pnpm collect https://example.com
 *   pnpm collect https://example.com --save example   → evals/fixtures/example.json
 *
 * --save freezes the collected data as an eval fixture, so the diagnosis can
 * be run on exactly the same input every time.
 */
import "dotenv/config";
import { saveFixture } from "../evals/fixtures";
import { printCrawl, printPsi } from "../evals/summary";
import { crawlPage } from "@/lib/audit/crawl";
import { runPsi } from "@/lib/audit/psi";
import { assertPublicUrl } from "@/lib/audit/url-guard";

async function main() {
  const args = process.argv.slice(2);
  const saveIdx = args.indexOf("--save");
  const saveName = saveIdx >= 0 ? args[saveIdx + 1] : undefined;
  // The URL is the first argument that isn't a flag or the --save value.
  const input = args.find((a, i) => !a.startsWith("--") && !(saveIdx >= 0 && i === saveIdx + 1));
  if (!input || (saveIdx >= 0 && !saveName)) {
    console.error("Usage: pnpm collect <url> [--save <fixture-name>]");
    process.exit(1);
  }
  const url = (await assertPublicUrl(input)).toString();

  // PageSpeed Insights fails intermittently (timeouts, 500s), so retry it once.
  const psiWithRetry = () =>
    runPsi(url).catch((err) => {
      console.log(`PageSpeed failed (${err.message}), retrying once...`);
      return runPsi(url);
    });
  const [psi, crawl] = await Promise.allSettled([psiWithRetry(), crawlPage(url)]);

  if (psi.status === "fulfilled") printPsi(psi.value);
  else console.log("PSI failed:", psi.reason.message);

  if (crawl.status === "fulfilled") printCrawl(crawl.value);
  else console.log("Crawl failed:", crawl.reason.message);

  if (saveName) {
    // A fixture is only useful with both halves of the data.
    if (psi.status !== "fulfilled" || crawl.status !== "fulfilled") {
      console.error(`\nNot saved: ${saveName} needs both PageSpeed and crawl data. Try again.`);
      process.exit(1);
    }
    saveFixture({
      name: saveName,
      url,
      collectedAt: new Date().toISOString(),
      psi: psi.value,
      crawl: crawl.value,
    });
    console.log(`\nSaved fixture → evals/fixtures/${saveName}.json`);
  }
}

main();
