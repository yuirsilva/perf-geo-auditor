import { Status, type StatusProps, type StatusValue } from "@/components/glaze/ui/status";
import type { Audit } from "@/db/schema";

// Work on the way stays ink (running); only the outcomes take colour.
const STATUS: Record<Audit["status"], { status: StatusValue; word: string }> = {
  queued: { status: "queued", word: "Queued" },
  collecting: { status: "running", word: "Collecting data" },
  diagnosing: { status: "running", word: "Diagnosing" },
  done: { status: "ok", word: "Done" },
  failed: { status: "fail", word: "Failed" },
};

export function AuditStatus({ status, ...props }: { status: Audit["status"] } & Omit<StatusProps, "status">) {
  const { status: value, word } = STATUS[status];
  return (
    <Status status={value} {...props}>
      {word}
    </Status>
  );
}
