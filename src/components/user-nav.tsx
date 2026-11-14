import Link from "next/link";
import { getUser } from "@/lib/auth";
import { SignOutButton } from "./sign-out-button";

export async function UserNav() {
  const user = await getUser();
  if (!user) {
    return (
      <Link href="/login" className="text-sm text-accent hover:underline">
        Sign in
      </Link>
    );
  }
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-muted">{user.email}</span>
      <SignOutButton />
    </div>
  );
}
