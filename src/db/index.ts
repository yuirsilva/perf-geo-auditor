import "server-only";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { Pool } from "pg";
import * as schema from "./schema";

/**
 * Two modes:
 * - DATABASE_URL set (postgres://...) → a normal Postgres server (e.g. for deploys).
 * - DATABASE_URL empty → PGlite: Postgres running inside this Node process,
 *   data stored in ./.pglite. No server, no password.
 */
const url = process.env.DATABASE_URL;
export const PGLITE_DIR = "./.pglite";

// Both drivers expose the same query builder. Typing them as one avoids
// TypeScript union overload errors at every call site.
type Db = NodePgDatabase<typeof schema>;

function create(): Db {
  if (url) {
    return drizzlePg(new Pool({ connectionString: url, max: 10 }), { schema });
  }
  return drizzlePglite(new PGlite(PGLITE_DIR), { schema }) as unknown as Db;
}

// Reuse one connection across hot reloads in dev (PGlite allows only one per folder).
const globalForDb = globalThis as unknown as { db?: Db };
export const db = globalForDb.db ?? create();
if (process.env.NODE_ENV !== "production") globalForDb.db = db;
