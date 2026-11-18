"use client";

import { useActionState } from "react";
import { createAudit, type CreateAuditState } from "@/app/actions";
import { Button } from "./button";

const initialState: CreateAuditState = { error: null };

/** Starts a fresh audit of the same URL, so a failed run is one click from a retry. */
export function RerunButton({ url }: { url: string }) {
  const [state, formAction, pending] = useActionState(createAudit, initialState);
  return (
    <form action={formAction} className="flex flex-col items-start gap-2">
      <input type="hidden" name="url" value={url} />
      <Button type="submit" variant="quiet" pending={pending}>
        Run again
      </Button>
      {state.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
    </form>
  );
}
