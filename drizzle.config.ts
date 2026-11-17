import "dotenv/config";
import { defineConfig } from "drizzle-kit";

// Same database as src/db/index.ts: `pnpm db` locally, Neon when deployed.
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set. Run `pnpm db` and set it in .env (see .env.example).");

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url },
});
