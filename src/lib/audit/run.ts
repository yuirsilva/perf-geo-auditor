import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { audit } from "@/db/schema";
import { crawlPage } from "./crawl";
import { diagnose } from "./diagnose";
import { runPsi } from "./psi";

/**
 * The whole pipeline for one audit. Called from `after()` so the request returns
 * immediately and the audit page polls for progress.
 *
 * Week 2 upgrade: move this onto a real queue (Inngest, QStash, or a pg-boss worker)
 * so long runs survive serverless timeouts and can be retried.
 */
export async function runAudit(id: string): Promise<void> {
  const [row] = await db.select().from(audit).where(eq(audit.id, id));
  if (!row) return;

  try {
    await db.update(audit).set({ status: "collecting" }).where(eq(audit.id, id));
    const collectStart = Date.now();
    const [psi, crawl] = await Promise.all([runPsi(row.url), crawlPage(row.url)]);
    await db
      .update(audit)
      .set({ psi, crawl, collectMs: Date.now() - collectStart, status: "diagnosing" })
      .where(eq(audit.id, id));

    // Lighthouse got the site's bot protection instead of the page. The lab data
    // and audits describe that error page, so Claude could only guess at causes.
    // Stop here (no Claude call). A blocked crawl alone is fine: Lighthouse's data
    // is still real, and Claude is told the crawl failed.
    if (psi.httpError) {
      throw new Error(
        "The site blocked Google's PageSpeed test (it returned an HTTP error page, likely bot protection), " +
          "so the lab data describes that error page, not the site. No diagnosis was made and nothing was charged. " +
          "Try again later: some sites only block intermittently.",
      );
    }

    const diagnoseStart = Date.now();
    const result = await diagnose({ url: row.url, psi, crawl });
    await db
      .update(audit)
      .set({
        status: "done",
        diagnosis: result.diagnosis,
        model: result.model,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        costUsd: result.costUsd,
        diagnoseMs: Date.now() - diagnoseStart,
      })
      .where(eq(audit.id, id));
  } catch (err) {
    console.error(`[audit ${id}]`, err);
    // A failed DB query's message repeats the whole query and its params (the
    // diagnosis). Its cause is the short, useful part, and storing the long one
    // could hit the same error again and leave the audit stuck.
    const e = err as Error;
    const message = e.cause instanceof Error ? e.cause.message : e.message;
    await db
      .update(audit)
      .set({ status: "failed", error: message.slice(0, 1000) })
      .where(eq(audit.id, id));
  }
}
