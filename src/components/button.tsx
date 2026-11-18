import type { ComponentProps } from "react";

// Shared by <Button> and links styled as buttons. Press feedback is a quick
// scale on :active; hover is a subtle opacity change (Tailwind gates hover: to
// real hover devices).
const baseClass =
  "relative inline-flex items-center justify-center rounded-md font-medium " +
  "transition-[transform,opacity,background-color] duration-150 ease-out-strong active:scale-[0.97] " +
  "disabled:pointer-events-none disabled:opacity-70";

/** Primary: solid, for the one main action on a screen. */
export const buttonClass = `${baseClass} bg-foreground px-4 py-2 text-background hover:opacity-90`;

/** Quiet: outlined and smaller, for secondary actions like signing out. */
export const quietButtonClass = `${baseClass} border border-border px-3 py-1.5 text-sm hover:bg-card`;

export function Spinner({ className = "" }: { className?: string }) {
  // A fast spin reads as a faster wait.
  return (
    <span
      aria-hidden
      className={`inline-block size-4 shrink-0 animate-[spin_600ms_linear_infinite] rounded-full border-2 border-current border-r-transparent ${className}`}
    />
  );
}

/**
 * While pending, the label stays in place (transparent) and a spinner sits on
 * top, so the button keeps its width and the layout never moves under the cursor.
 */
export function Button({
  pending = false,
  variant = "primary",
  disabled,
  className = "",
  children,
  ...props
}: ComponentProps<"button"> & { pending?: boolean; variant?: "primary" | "quiet" }) {
  return (
    <button
      {...props}
      disabled={pending || disabled}
      aria-busy={pending || undefined}
      className={`${variant === "quiet" ? quietButtonClass : buttonClass} ${className}`}
    >
      <span className={pending ? "opacity-0" : undefined}>{children}</span>
      {pending && (
        <span className="absolute inset-0 grid place-items-center">
          <Spinner />
        </span>
      )}
    </button>
  );
}
