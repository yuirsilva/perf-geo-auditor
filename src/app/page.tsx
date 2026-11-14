import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { Suspense } from "react";
import { AuditForm } from "@/components/audit-form";
import { StatusBadge } from "@/components/status-badge";
import { db } from "@/db";
import { audit } from "@/db/schema";
import { getUser } from "@/lib/auth";

export default function Home() {
  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Find out <em>why</em> your page is slow, and how AI search sees it.
        </h1>
        <p className="max-w-2xl text-muted">
          Combines real-user Core Web Vitals (CrUX), a Lighthouse run and a crawl of your HTML,
          then has Claude trace each problem to its root cause and write the fix.
        </p>
      </section>

      <Suspense fallback={<div className="h-24 rounded-lg bg-card" />}>
        <Dashboard />
      </Suspense>
    </div>
  );
}

async function Dashboard() {
  const user = await getUser();
  if (!user) {
    return (
      <Link
        href="/login"
        className="w-fit rounded-md bg-foreground px-4 py-2 font-medium text-background"
      >
        Sign in to run an audit
      </Link>
    );
  }

  const recent = await db
    .select({ id: audit.id, url: audit.url, status: audit.status, createdAt: audit.createdAt })
    .from(audit)
    .where(eq(audit.userId, user.id))
    .orderBy(desc(audit.createdAt))
    .limit(20);

  return (
    <div className="flex flex-col gap-8">
      <AuditForm />
      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted">
          Your audits
        </h2>
        {recent.length === 0 ? (
          <p className="text-muted">No audits yet. Try your own site or a client&apos;s.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {recent.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/audits/${a.id}`}
                  className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-card"
                >
                  <span className="truncate">{a.url}</span>
                  <span className="flex shrink-0 items-center gap-3 text-sm text-muted">
                    {a.createdAt.toLocaleDateString()}
                    <StatusBadge status={a.status} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
