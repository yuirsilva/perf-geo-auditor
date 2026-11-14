"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Re-renders the server component tree on an interval while an audit is running. */
export function AutoRefresh({ intervalMs }: { intervalMs: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(t);
  }, [router, intervalMs]);
  return null;
}
