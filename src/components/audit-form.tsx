"use client";

import { useActionState } from "react";
import { createAudit, type CreateAuditState } from "@/app/actions";
import { Field, FieldError, FieldLabel, Form } from "@/components/glaze/ui/field";
import { Input, InputAction } from "@/components/glaze/ui/input";

const initialState: CreateAuditState = { error: null };

/** A one-line form: the URL with its one ink action inside the pill. Server errors come back on the field. */
export function AuditForm() {
  const [state, formAction, pending] = useActionState(createAudit, initialState);

  return (
    <Form action={formAction} pending={pending} errors={state.error ? { url: state.error } : undefined}>
      <Field name="url">
        <FieldLabel>Page URL</FieldLabel>
        <Input
          // Remounts with the submitted value after each failed try, so the reset refills it.
          key={state.url ?? ""}
          defaultValue={state.url}
          name="url"
          type="text"
          inputMode="url"
          autoComplete="url"
          required
          placeholder="https://example.com"
          trailing={
            <InputAction type="submit" size="text" variant="primary" pending={pending} pendingLabel="Starting">
              Audit page
            </InputAction>
          }
        />
        <FieldError match="valueMissing">Enter a page&apos;s address, like https://example.com.</FieldError>
        {/* The server's own message, from Form errors (Base UI doesn't flag these as customError, so no match);
            only while there is one, so an empty submit shows just the sentence above. */}
        {state.error && <FieldError />}
      </Field>
    </Form>
  );
}
