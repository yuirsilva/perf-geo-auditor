import "server-only";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

/**
 * One Postgres server for every environment: `pnpm db` locally, Neon (or any
 * Postgres) when deployed. Same driver everywhere, so local behaves like prod.
 */
type Db = NodePgDatabase<typeof schema>;

// One pool per server process (and across hot reloads in dev).
const globalForDb = globalThis as unknown as { db?: Db };

function getDb(): Db {
  if (globalForDb.db) return globalForDb.db;

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. For local dev run `pnpm db` and set " +
        "DATABASE_URL=postgres://postgres:postgres@localhost:5433/auditor in .env",
    );
  }
  const pool = new Pool({ connectionString: url, max: 10 });
  // An idle connection can die (database restart, network blip). Without this
  // handler that error is uncaught and can crash the server; with it the pool
  // drops the dead connection and opens a new one on the next query.
  pool.on("error", (err) => console.error("[db] idle connection lost:", err.message));
  globalForDb.db = drizzle(pool, { schema });
  return globalForDb.db;
}

/**
 * Connects on first use, not on import. `next build` imports every route to
 * collect page data, and the build shouldn't need (or have) database access.
 */
export const db = new Proxy({} as Db, {
  get(_, prop) {
    const real = getDb();
    const value = Reflect.get(real, prop, real);
    return typeof value === "function" ? value.bind(real) : value;
  },
});
