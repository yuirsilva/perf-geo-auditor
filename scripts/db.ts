/**
 * Runs a real Postgres server for local development. No Docker, no install:
 * the binaries come from the embedded-postgres package in node_modules.
 *
 *   pnpm db          → starts Postgres on localhost:5433 (Ctrl+C stops it)
 *
 * Data lives in ./.postgres and survives restarts. Point the app at it with:
 *   DATABASE_URL=postgres://postgres:postgres@localhost:5433/auditor
 */
import EmbeddedPostgres from "embedded-postgres";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import pgLib from "pg";

const DIR = "./.postgres";
const DB_NAME = "auditor";
const URL = `postgres://postgres:postgres@localhost:5433/${DB_NAME}`;

/** True when a working server already answers on our port. */
async function alreadyRunning() {
  const client = new pgLib.Client({ connectionString: URL, connectionTimeoutMillis: 2000 });
  try {
    await client.connect();
    await client.query("select 1");
    return true;
  } catch {
    return false;
  } finally {
    await client.end().catch(() => {});
  }
}

/**
 * On Windows, a hard-killed Postgres can leave a worker process alive that
 * still holds port 5433, so a new server can't start. Stop any Postgres
 * started from this project's binaries (other Postgres installs are untouched).
 */
function killLeftovers() {
  if (process.platform !== "win32") return;
  const script =
    "Get-CimInstance Win32_Process -Filter \"Name='postgres.exe'\" | " +
    // Command lines use either slash style, so compare with forward slashes.
    "Where-Object { $_.CommandLine -and $_.CommandLine.Replace('\\','/') -like ('*' + $env:AUDITOR_DIR + '/node_modules/*embedded-postgres*') } | " +
    "ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue; $_.ProcessId }";
  const out = execFileSync("powershell", ["-NoProfile", "-Command", script], {
    encoding: "utf8",
    env: { ...process.env, AUDITOR_DIR: process.cwd().replaceAll("\\", "/") },
  }).trim();
  if (out) console.log(`Stopped leftover Postgres processes from a previous run: ${out.split(/\s+/).join(", ")}`);
}

const pg = new EmbeddedPostgres({
  databaseDir: DIR,
  port: 5433, // not 5432, so it can't clash with a Postgres you may install later
  user: "postgres",
  password: "postgres", // local only: the server listens on localhost
  persistent: true,
  autoRehydrateSymlinks: true,
  // Without this, initdb picks the Windows encoding (WIN1252), which can't
  // store characters like "≤" that Claude writes. Neon is UTF-8 too.
  initdbFlags: ["--encoding=UTF8", "--no-locale"],
  onLog: () => {}, // Postgres is chatty; errors still go to onError
});

async function main() {
  if (await alreadyRunning()) {
    console.log("Postgres is already running on localhost:5433. Nothing to do.");
    return;
  }
  killLeftovers();

  // initdb only once: it creates the cluster folder.
  if (!existsSync(DIR)) await pg.initialise();
  // A crash skips the clean shutdown; Postgres replays its write-ahead log here.
  await pg.start();

  const client = pg.getPgClient();
  await client.connect();
  const { rowCount } = await client.query("select 1 from pg_database where datname = $1", [DB_NAME]);
  await client.end();
  if (!rowCount) {
    await pg.createDatabase(DB_NAME);
    console.log(`Created database "${DB_NAME}". Run \`pnpm db:push\` to create the tables.`);
  }

  console.log(`Postgres running on localhost:5433 (data in ${DIR}). Ctrl+C to stop.`);

  // A clean stop writes everything to disk and leaves no processes behind.
  const stop = async () => {
    await pg.stop();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

main().catch((err) => {
  // embedded-postgres rejects with undefined when the server won't start.
  console.error(err ?? "Postgres failed to start. Is something else using port 5433?");
  process.exit(1);
});
