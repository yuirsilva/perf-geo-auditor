import "server-only";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

/**
 * One Postgres server for every environment: `pnpm db` locally, Neon (or any
 * Postgres) when deployed. Same driver everywhere, so local behaves like prod.
 */
const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error(
    "DATABASE_URL is not set. For local dev run `pnpm db` and set " +
      "DATABASE_URL=postgres://postgres:postgres@localhost:5433/auditor in .env",
  );
}

type Db = NodePgDatabase<typeof schema>;

// Reuse one pool across hot reloads in dev instead of opening new connections each time.
const globalForDb = globalThis as unknown as { db?: Db };

function create(): Db {
  const pool = new Pool({ connectionString: url, max: 10 });
  // An idle connection can die (database restart, network blip). Without this
  // handler that error is uncaught and can crash the server; with it the pool
  // drops the dead connection and opens a new one on the next query.
  pool.on("error", (err) => console.error("[db] idle connection lost:", err.message));
  return drizzle(pool, { schema });
}

export const db = globalForDb.db ?? create();
if (process.env.NODE_ENV !== "production") globalForDb.db = db;
