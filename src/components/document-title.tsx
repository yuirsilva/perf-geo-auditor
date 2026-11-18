"use client";

import { useEffect } from "react";

/**
 * Puts the audit's status in the browser tab, so someone who switched tabs
 * during a 60–100 s audit can see when it's done. The effect has no deps on
 * purpose: it re-applies after every auto-refresh, in case Next.js rewrote the
 * <title> from the layout's metadata.
 */
export function DocumentTitle({ title }: { title: string }) {
  useEffect(() => {
    document.title = title;
  });
  return null;
}
