import fs from "node:fs";
import path from "node:path";
import type { CrawlResult } from "@/lib/audit/crawl";
import type { PsiSummary } from "@/lib/audit/psi";

/**
 * A fixture is one site's collected data, frozen in a JSON file so evals
 * always run the diagnosis on exactly the same input.
 */
export type Fixture = {
  name: string;
  url: string;
  collectedAt: string;
  psi: PsiSummary;
  crawl: CrawlResult;
};

export const FIXTURES_DIR = path.join(process.cwd(), "evals", "fixtures");

export function fixturePath(name: string) {
  if (!/^[a-z0-9-]+$/.test(name)) {
    throw new Error(`Fixture names use lowercase letters, numbers and dashes only (got "${name}")`);
  }
  return path.join(FIXTURES_DIR, `${name}.json`);
}

export function saveFixture(fixture: Fixture) {
  fs.mkdirSync(FIXTURES_DIR, { recursive: true });
  fs.writeFileSync(fixturePath(fixture.name), JSON.stringify(fixture, null, 2));
}

export function loadFixture(name: string): Fixture {
  const file = fixturePath(name);
  if (!fs.existsSync(file)) throw new Error(`No fixture "${name}". Create it with: pnpm collect <url> --save ${name}`);
  return JSON.parse(fs.readFileSync(file, "utf8")) as Fixture;
}
