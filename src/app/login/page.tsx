import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";
import { getUser } from "@/lib/auth";

export default function LoginPage() {
  return (
    <>
      {/* Reads the session, so it sits behind its own boundary; the form renders without waiting for it. */}
      <Suspense fallback={null}>
        <SignedInRedirect />
      </Suspense>
      <LoginForm />
    </>
  );
}

/** Someone already signed in has nothing to do here, so send them home. */
async function SignedInRedirect() {
  if (await getUser()) redirect("/");
  return null;
}
