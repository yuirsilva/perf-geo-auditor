"use server";

import { gt, sql } from "drizzle-orm";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { audit } from "@/db/schema";
import { getUser } from "@/lib/auth";
import { assertPublicUrl, UnsafeUrlError } from "@/lib/audit/url-guard";
import { runAudit } from "@/lib/audit/run";

// url is what the person submitted, returned with an error: React 19 resets a form after its action runs, so the
// field refills from it instead of coming back empty.
export type CreateAuditState = { error: string | null; url?: string };

// Raise them in .env for local testing; the defaults keep a public deploy cheap
// (50 audits at ~$0.007 is ~$0.35/day at most).
const PER_USER_PER_DAY = Number(process.env.AUDIT_LIMIT_PER_USER_PER_DAY ?? 5);
const SITE_PER_DAY = Number(process.env.AUDIT_LIMIT_SITE_PER_DAY ?? 50);

async function checkDailyLimits(userId: string): Promise<string | null> {
  const [counts] = await db
    .select({
      mine: sql<number>`count(*) filter (where ${audit.userId} = ${userId})::int`,
      all: sql<number>`count(*)::int`,
    })
    .from(audit)
    .where(gt(audit.createdAt, sql`now() - interval '24 hours'`));

  if (counts.mine >= PER_USER_PER_DAY) {
    return `You've run ${PER_USER_PER_DAY} audits in the last 24 hours, the daily limit. Try again tomorrow.`;
  }
  if (counts.all >= SITE_PER_DAY) {
    return "The site has reached its daily audit limit. Try again tomorrow.";
  }
  return null;
}

export async function createAudit(
  _prev: CreateAuditState,
  formData: FormData,
): Promise<CreateAuditState> {
  // Server Actions are public endpoints: always re-check the session here.
  const user = await getUser();
  if (!user) redirect("/login");

  const submitted = String(formData.get("url") ?? "");
  let url: URL;
  try {
    url = await assertPublicUrl(submitted);
  } catch (err) {
    if (err instanceof UnsafeUrlError) return { error: err.message, url: submitted };
    throw err;
  }

  // Every audit spends the owner's Claude and PageSpeed quota, and anyone can
  // sign up. Cap audits per user and for the whole site over the last 24 hours.
  const limitError = await checkDailyLimits(user.id);
  if (limitError) return { error: limitError, url: submitted };

  const [row] = await db
    .insert(audit)
    .values({ userId: user.id, url: url.toString() })
    .returning({ id: audit.id });

  // Respond right away; the pipeline keeps running after the response is sent.
  after(() => runAudit(row.id));

  redirect(`/audits/${row.id}`);
}
