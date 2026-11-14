"use client";

import { useActionState } from "react";
import { createAudit, type CreateAuditState } from "@/app/actions";

const initialState: CreateAuditState = { error: null };

export function AuditForm() {
  const [state, formAction, pending] = useActionState(createAudit, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-2 sm:flex-row">
      <label htmlFor="url" className="sr-only">
        Page URL
      </label>
      <input
        id="url"
        name="url"
        type="text"
        inputMode="url"
        required
        placeholder="https://example.com"
        className="flex-1 rounded-md border border-border bg-background px-3 py-2"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-foreground px-4 py-2 font-medium text-background disabled:opacity-60"
      >
        {pending ? "Starting…" : "Audit page"}
      </button>
      {state.error && (
        <p role="alert" className="text-sm text-red-600 sm:basis-full">
          {state.error}
        </p>
      )}
    </form>
  );
}
