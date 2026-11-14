import type { Audit } from "@/db/schema";

const LABELS: Record<Audit["status"], { text: string; className: string }> = {
  queued: { text: "Queued", className: "bg-card text-muted" },
  collecting: { text: "Collecting data", className: "bg-blue-500/15 text-blue-600 dark:text-blue-400" },
  diagnosing: { text: "Diagnosing", className: "bg-violet-500/15 text-violet-600 dark:text-violet-400" },
  done: { text: "Done", className: "bg-green-500/15 text-green-700 dark:text-green-400" },
  failed: { text: "Failed", className: "bg-red-500/15 text-red-600 dark:text-red-400" },
};

export function StatusBadge({ status }: { status: Audit["status"] }) {
  const { text, className } = LABELS[status];
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>{text}</span>;
}
