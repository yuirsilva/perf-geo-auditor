/**
 * Runs the diagnosis on every fixture in evals/dataset.ts, grades each output,
 * and prints score, cost and latency. Costs real API credits.
 *
 *   pnpm eval                      → all sites, once each
 *   pnpm eval aese bbc             → only these sites
 *   pnpm eval --repeat 3           → each site 3 times (Claude's answers vary run to run)
 *
 * Every run is saved to evals/results/<timestamp>.json with the full diagnosis
 * and every judge verdict, so you can check the judge by hand later.
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { dataset } from "../evals/dataset";
import { loadFixture } from "../evals/fixtures";
import { grade, JUDGE_MODEL, type GradeResult } from "../evals/grade";
import { diagnose } from "@/lib/audit/diagnose";
import type { Diagnosis } from "@/lib/audit/diagnosis-schema";

type Row = {
  fixture: string;
  run: number;
  model?: string;
  diagnoseMs?: number;
  diagnoseCostUsd?: number | null;
  inputTokens?: number;
  outputTokens?: number;
  diagnosis?: Diagnosis;
  grade?: GradeResult;
  error?: string;
};

function parseArgs() {
  const args = process.argv.slice(2);
  const flag = (name: string, fallback: number) => {
    const i = args.indexOf(name);
    return i >= 0 ? Number(args[i + 1]) : fallback;
  };
  const flagValues = new Set(["--repeat", "--concurrency"].map((f) => args.indexOf(f) + 1).filter((i) => i > 0));
  const names = args.filter((a, i) => !a.startsWith("--") && !flagValues.has(i));
  return { names, repeat: flag("--repeat", 1), concurrency: flag("--concurrency", 3) };
}

async function runOne(fixtureName: string, run: number): Promise<Row> {
  const entry = dataset.find((d) => d.fixture === fixtureName)!;
  const fixture = loadFixture(fixtureName);
  try {
    const t0 = performance.now();
    const result = await diagnose({ url: fixture.url, psi: fixture.psi, crawl: fixture.crawl });
    const diagnoseMs = Math.round(performance.now() - t0);
    const graded = await grade(result.diagnosis, entry.expected);
    return {
      fixture: fixtureName,
      run,
      model: result.model,
      diagnoseMs,
      diagnoseCostUsd: result.costUsd,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      diagnosis: result.diagnosis,
      grade: graded,
    };
  } catch (err) {
    return { fixture: fixtureName, run, error: (err as Error).message };
  }
}

/** Runs tasks with at most `limit` in flight, to stay under API rate limits. */
async function pool<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let next = 0;
  const worker = async () => {
    while (next < tasks.length) {
      const i = next++;
      results[i] = await tasks[i]();
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return results;
}

const pct = (n: number) => `${Math.round(n * 100)}%`;
const usd = (n: number) => `$${n.toFixed(4)}`;
const secs = (ms: number) => `${(ms / 1000).toFixed(0)}s`;

function printRow(r: Row) {
  const name = `${r.fixture}${r.run > 1 ? ` #${r.run}` : ""}`.padEnd(16);
  if (r.error || !r.grade) {
    console.log(`${name} ERROR  ${r.error}`);
    return;
  }
  const g = r.grade;
  const top = g.topIssue ? (g.topIssue.pass ? "ok" : `got ${g.topIssue.actual}`) : "-";
  const notFlag = g.mustNotFlag.every((c) => c.pass) ? "ok" : g.mustNotFlag.filter((c) => !c.pass).map((c) => c.metric).join(",");
  const found = g.mustFind.filter((c) => c.found).length;
  const cost = (r.diagnoseCostUsd ?? 0) + g.judgeCostUsd;
  console.log(
    `${name} ${pct(g.passed / g.total).padStart(4)}  top:${top.padEnd(9)} notFlag:${notFlag.padEnd(5)} find:${found}/${g.mustFind.length}  ${usd(cost)}  ${secs(r.diagnoseMs!)}`,
  );
  for (const c of g.mustFind.filter((c) => !c.found)) console.log(`    missed: ${c.finding}`);
  for (const c of g.mustNotFlag.filter((c) => !c.pass)) console.log(`    flagged ${c.metric}: ${c.flaggedBy.join(" | ")}`);
}

async function main() {
  const { names, repeat, concurrency } = parseArgs();
  const cases = names.length ? dataset.filter((d) => names.includes(d.fixture)) : dataset;
  const unknown = names.filter((n) => !dataset.some((d) => d.fixture === n));
  if (unknown.length) {
    console.error(`Not in evals/dataset.ts: ${unknown.join(", ")}`);
    process.exit(1);
  }
  for (const c of cases) loadFixture(c.fixture); // fail fast on a missing fixture file

  const model = process.env.AUDIT_MODEL ?? "claude-haiku-5-5";
  const effort = process.env.AUDIT_EFFORT ?? "medium";
  console.log(`Running ${cases.length} site(s) × ${repeat} · model ${model} · effort ${effort} · judge ${JUDGE_MODEL}\n`);

  const tasks = cases.flatMap((c) =>
    Array.from({ length: repeat }, (_, r) => async () => {
      const row = await runOne(c.fixture, r + 1);
      printRow(row);
      return row;
    }),
  );
  const rows = await pool(tasks, concurrency);

  // Totals over successful runs only; errors are listed separately.
  const ok = rows.filter((r) => r.grade);
  const passed = ok.reduce((s, r) => s + r.grade!.passed, 0);
  const total = ok.reduce((s, r) => s + r.grade!.total, 0);
  const diagnoseCost = ok.reduce((s, r) => s + (r.diagnoseCostUsd ?? 0), 0);
  const judgeCost = ok.reduce((s, r) => s + r.grade!.judgeCostUsd, 0);
  const times = ok.map((r) => r.diagnoseMs!).sort((a, b) => a - b);
  const median = times.length ? times[Math.floor(times.length / 2)] : 0;

  console.log("\n== Summary ==");
  console.log(`score:    ${total ? pct(passed / total) : "-"} (${passed}/${total} checks)`);
  console.log(`cost:     ${usd(diagnoseCost + judgeCost)} total (diagnosis ${usd(diagnoseCost)}, judge ${usd(judgeCost)})`);
  console.log(`latency:  median ${secs(median)}, slowest ${secs(times.at(-1) ?? 0)}`);
  if (rows.length > ok.length) console.log(`errors:   ${rows.length - ok.length} run(s) failed`);

  const dir = path.join(process.cwd(), "evals", "results");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(
    file,
    JSON.stringify({ ranAt: new Date().toISOString(), model, effort, judgeModel: JUDGE_MODEL, repeat, rows }, null, 2),
  );
  console.log(`\nSaved → ${path.relative(process.cwd(), file)}`);
}

main();
