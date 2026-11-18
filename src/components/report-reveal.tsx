"use client";

import { useState, type ReactNode } from "react";

/**
 * Turns on the report's entrance animation only when the audit was still
 * running when the page first loaded. State survives router.refresh(), so the
 * sections that arrive with the finished diagnosis fade in once, while opening
 * an old, finished audit shows it instantly. The CSS lives in globals.css.
 */
export function ReportReveal({ running, children }: { running: boolean; children: ReactNode }) {
  const [reveal] = useState(running);
  return <div data-reveal={reveal || undefined}>{children}</div>;
}
