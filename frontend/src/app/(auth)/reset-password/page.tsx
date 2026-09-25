import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { AuthCard } from "../auth-card";

export const metadata: Metadata = {
  title: "Reset password · Trufinity",
  robots: { index: false, follow: false },
  // Defence in depth: never leak this page's URL to other origins.
  referrer: "no-referrer",
};

export default function ResetPasswordPage() {
  return (
    <AuthCard title="Choose a new password" description="Enter a new password for your Trufinity account.">
      <ResetPasswordForm />
    </AuthCard>
  );
}
