import Link from "next/link";
import { Button } from "@/components/glaze/ui/button";
import { getUser } from "@/lib/auth";
import { SignOutButton } from "./sign-out-button";

export async function UserNav() {
  const user = await getUser();
  if (!user) {
    return (
      <Button render={<Link href="/login" />} nativeButton={false} size="sm" variant="secondary">
        Sign in
      </Button>
    );
  }
  return <UserNavView email={user.email} />;
}

/** The signed-in header. Also rendered with a sample email for the skeleton, so it must not fetch. */
export function UserNavView({ email }: { email: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="type-body-sm truncate text-text-2 max-sm:hidden">{email}</span>
      <SignOutButton />
    </div>
  );
}
