"use client";

import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

/**
 * Formats a timestamp in the viewer's own locale and time zone. Server-side
 * formatting would use the server's zone (UTC on Vercel), so the server renders
 * a neutral UTC value and the browser swaps in local time after hydration.
 */
export function LocalTime({ date, withTime = false }: { date: Date; withTime?: boolean }) {
  const isClient = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const options: Intl.DateTimeFormatOptions = withTime
    ? { dateStyle: "medium", timeStyle: "short" }
    : { dateStyle: "medium" };
  const text = new Intl.DateTimeFormat(
    isClient ? undefined : "en",
    isClient ? options : { ...options, timeZone: "UTC" },
  ).format(date);
  return <time dateTime={date.toISOString()}>{text}</time>;
}
