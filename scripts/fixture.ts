/**
 * Prints the summary of a saved fixture, without collecting anything again.
 *
 *   pnpm fixture            → lists all saved fixtures
 *   pnpm fixture bbc        → summary of evals/fixtures/bbc.json
 */
import fs from "node:fs";
import { FIXTURES_DIR, loadFixture } from "../evals/fixtures";
import { printCrawl, printPsi } from "../evals/summary";

const name = process.argv[2];

if (!name) {
  const names = fs.existsSync(FIXTURES_DIR)
    ? fs.readdirSync(FIXTURES_DIR).filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, ""))
    : [];
  console.log(names.length ? names.join("\n") : "No fixtures yet. Create one with: pnpm collect <url> --save <name>");
} else {
  const f = loadFixture(name);
  console.log(`${f.name} · ${f.url} · collected ${f.collectedAt}\n`);
  printPsi(f.psi);
  printCrawl(f.crawl);
}
