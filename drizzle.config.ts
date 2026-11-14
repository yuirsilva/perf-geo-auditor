import "dotenv/config";
import { defineConfig } from "drizzle-kit";

// Same switch as src/db/index.ts: a Postgres server if DATABASE_URL is set,
// otherwise the local PGlite folder.
const url = process.env.DATABASE_URL;

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  ...(url ? { dbCredentials: { url } } : { driver: "pglite", dbCredentials: { url: "./.pglite" } }),
});
