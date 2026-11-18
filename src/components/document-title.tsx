"use client";

import { useEffect } from "react";

/**
 * Puts the audit's status in the browser tab, so someone who switched tabs during a 60–100 s audit can see when
 * it's done. Next.js writes the layout's metadata title into <head> on its own schedule, which can land after this
 * effect (it does when the report streams in behind Skullet's boundary), so this also watches <head> and puts the
 * status title back whenever something else replaces it. On unmount it stops, and the next page sets its own.
 */
export function DocumentTitle({ title }: { title: string }) {
  useEffect(() => {
    const apply = () => {
      if (document.title !== title) document.title = title;
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.head, { subtree: true, childList: true, characterData: true });
    return () => observer.disconnect();
  }, [title]);
  return null;
}
