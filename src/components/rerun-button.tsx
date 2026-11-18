"use client";

import { useActionState } from "react";
import { createAudit, type CreateAuditState } from "@/app/actions";
import { Button } from "@/components/glaze/ui/button";

const initialState: CreateAuditState = { error: null };

/** Starts a fresh audit of the same URL, so a failed run is one press from a retry. */
export function RerunButton({ url }: { url: string }) {
  const [state, formAction, pending] = useActionState(createAudit, initialState);
  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="url" value={url} />
      <Button type="submit" size="sm" variant="secondary" pending={pending} pendingLabel="Starting">
        Run again
      </Button>
      <p role="status" className="type-caption text-fail-text">
        {state.error}
      </p>
    </form>
  );
}
