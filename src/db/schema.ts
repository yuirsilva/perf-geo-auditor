import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import type { CrawlResult } from "@/lib/audit/crawl";
import type { Diagnosis } from "@/lib/audit/diagnosis-schema";
import type { PsiSummary } from "@/lib/audit/psi";

// ---------------------------------------------------------------------------
// Better Auth core tables (user / session / account / verification)
// ---------------------------------------------------------------------------

const timestamps = {
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  ...timestamps,
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (t) => [index("session_user_id_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    ...timestamps,
  },
  (t) => [index("account_user_id_idx").on(t.userId)],
);

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  ...timestamps,
});

// ---------------------------------------------------------------------------
// Audits
// ---------------------------------------------------------------------------

export const auditStatus = pgEnum("audit_status", [
  "queued",
  "collecting", // PageSpeed Insights + crawl
  "diagnosing", // Claude
  "done",
  "failed",
]);

export const audit = pgTable(
  "audit",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    status: auditStatus("status").notNull().default("queued"),
    error: text("error"),

    // Raw-ish inputs, kept so diagnoses can be re-run and evaluated later
    psi: jsonb("psi").$type<PsiSummary>(),
    crawl: jsonb("crawl").$type<CrawlResult>(),

    // Claude output + bookkeeping for cost/latency tracking (Week 2)
    diagnosis: jsonb("diagnosis").$type<Diagnosis>(),
    model: text("model"),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    costUsd: real("cost_usd"),
    collectMs: integer("collect_ms"),
    diagnoseMs: integer("diagnose_ms"),

    ...timestamps,
  },
  (t) => [index("audit_user_created_idx").on(t.userId, t.createdAt)],
);

export type Audit = typeof audit.$inferSelect;
