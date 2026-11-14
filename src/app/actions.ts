"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { audit } from "@/db/schema";
import { getUser } from "@/lib/auth";
import { assertPublicUrl, UnsafeUrlError } from "@/lib/audit/url-guard";
import { runAudit } from "@/lib/audit/run";

export type CreateAuditState = { error: string | null };

export async function createAudit(
  _prev: CreateAuditState,
  formData: FormData,
): Promise<CreateAuditState> {
  // Server Actions are public endpoints: always re-check the session here.
  const user = await getUser();
  if (!user) redirect("/login");

  let url: URL;
  try {
    url = await assertPublicUrl(String(formData.get("url") ?? ""));
  } catch (err) {
    if (err instanceof UnsafeUrlError) return { error: err.message };
    throw err;
  }

  const [row] = await db
    .insert(audit)
    .values({ userId: user.id, url: url.toString() })
    .returning({ id: audit.id });

  // Respond right away; the pipeline keeps running after the response is sent.
  after(() => runAudit(row.id));

  redirect(`/audits/${row.id}`);
}
