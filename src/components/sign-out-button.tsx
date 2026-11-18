"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/glaze/ui/button";
import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <Button
      size="sm"
      variant="secondary"
      pending={pending}
      pendingLabel="Signing out"
      onClick={async () => {
        setPending(true);
        await authClient.signOut();
        router.push("/");
        router.refresh();
      }}
    >
      Sign out
    </Button>
  );
}
