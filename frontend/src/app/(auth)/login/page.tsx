import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { getCurrentUser } from "@/lib/auth/session";
import { safeRedirectPath } from "@/lib/auth/validation";
import { AuthCard } from "../auth-card";

export const metadata: Metadata = {
  title: "Sign in · Trufinity",
  robots: { index: false, follow: false },
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = safeRedirectPath(params.next);

  // Already signed in: skip the form.
  if (await getCurrentUser()) redirect(next);

  const notice =
    params.reset === "success"
      ? "Your password has been reset. Sign in with your new password."
      : params.signed_out === "1"
        ? "You have been signed out."
        : undefined;

  return (
    <AuthCard title="Sign in" description="Welcome back. Sign in to your Trufinity account.">
      <LoginForm next={next} notice={notice} />
    </AuthCard>
  );
}
