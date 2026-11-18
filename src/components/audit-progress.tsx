import type { Audit } from "@/db/schema";
import { Spinner } from "./button";

const STEPS = [
  { status: "collecting", label: "Collect data" },
  { status: "diagnosing", label: "Diagnose" },
  { status: "done", label: "Report" },
] as const;

/** Where a running audit is: done steps get a check, the current one spins. */
export function AuditProgress({ status }: { status: Audit["status"] }) {
  // "queued" sits before the first step; findIndex returns -1 for it.
  const current = STEPS.findIndex((s) => s.status === status);

  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
      {STEPS.map((step, i) => {
        const state = i < current ? "done" : i === current ? "active" : "pending";
        return (
          <li
            key={step.status}
            aria-current={state === "active" ? "step" : undefined}
            className="flex items-center gap-2"
          >
            {i > 0 && (
              <span aria-hidden className={`h-px w-6 sm:w-10 ${i <= current ? "bg-foreground" : "bg-border"}`} />
            )}
            <span
              className={`flex items-center gap-1.5 ${
                state === "pending" ? "text-muted" : "text-foreground"
              } ${state === "active" ? "font-medium" : ""}`}
            >
              {state === "done" ? (
                <CheckIcon />
              ) : state === "active" ? (
                <Spinner />
              ) : (
                <span aria-hidden className="size-4 rounded-full border-2 border-border" />
              )}
              {step.label}
              {state === "done" && <span className="sr-only">(done)</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function CheckIcon() {
  return (
    <svg aria-hidden viewBox="0 0 16 16" className="size-4 shrink-0">
      <circle cx="8" cy="8" r="8" className="fill-foreground" />
      <path
        d="M4.75 8.25 7 10.5l4.25-4.75"
        fill="none"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-background"
      />
    </svg>
  );
}
