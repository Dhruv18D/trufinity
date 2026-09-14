"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/ui/Logo";
import { Icon } from "@/components/ui/Icon";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface FormErrors {
  email?: string;
  password?: string;
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  function validate(): FormErrors {
    const nextErrors: FormErrors = {};
    if (!email.trim()) {
      nextErrors.email = "Email is required.";
    } else if (!EMAIL_PATTERN.test(email.trim())) {
      nextErrors.email = "Enter a valid email address.";
    }
    if (!password) {
      nextErrors.password = "Password is required.";
    } else if (password.length < 6) {
      nextErrors.password = "Password must be at least 6 characters.";
    }
    return nextErrors;
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    // UI-only for now — sign-in will be wired up once the auth API is available.
    router.push("/dashboard");
  }

  return (
    <div className="flex min-h-screen">
      <div className="flex w-full flex-col justify-center px-6 py-12 sm:px-10 lg:w-[440px] lg:shrink-0 lg:px-14">
        <Logo className="mb-10" />

        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Welcome back</h1>
        <p className="mt-2 text-sm text-foreground/55">
          Sign in to see today&apos;s executive brief and business performance.
        </p>

        <form onSubmit={handleSubmit} noValidate className="mt-8 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-foreground/80">Email</span>
            <div
              className={`flex items-center gap-2 rounded-lg border bg-surface px-3 py-2.5 focus-within:border-teal-dark ${
                errors.email ? "border-danger" : "border-border-subtle"
              }`}
            >
              <Icon name="mail" className="h-4 w-4 text-foreground/40" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@trufinity.ca"
                aria-invalid={!!errors.email}
                className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-foreground/35"
              />
            </div>
            {errors.email && <span className="text-xs font-medium text-danger">{errors.email}</span>}
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-foreground/80">Password</span>
            <div
              className={`flex items-center gap-2 rounded-lg border bg-surface px-3 py-2.5 focus-within:border-teal-dark ${
                errors.password ? "border-danger" : "border-border-subtle"
              }`}
            >
              <Icon name="lock" className="h-4 w-4 text-foreground/40" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                aria-invalid={!!errors.password}
                className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-foreground/35"
              />
            </div>
            {errors.password && <span className="text-xs font-medium text-danger">{errors.password}</span>}
          </label>

          <div className="flex items-center justify-between text-sm">
            <label className="flex items-center gap-2 text-foreground/60">
              <input type="checkbox" className="h-3.5 w-3.5 rounded border-border-subtle accent-teal-dark" />
              Remember me
            </label>
            <button type="button" className="font-medium text-teal-dark hover:underline">
              Forgot password?
            </button>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:opacity-70"
          >
            {submitting ? "Signing in…" : "Sign in"}
            <Icon name="chevron-right" className="h-4 w-4" />
          </button>
        </form>

        <p className="mt-8 text-xs text-foreground/40">
          Secure authenticated access. Contact your administrator if you need a login created.
        </p>
      </div>

      <div className="relative hidden flex-1 items-center justify-center overflow-hidden bg-ink lg:flex">
        <div className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-teal/20 blur-3xl" />
        <div className="absolute -bottom-32 right-0 h-96 w-96 rounded-full bg-brand/20 blur-3xl" />
        <div className="relative z-10 max-w-md px-10 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-teal">Daily Executive Brief</p>
          <h2 className="mt-4 text-3xl font-semibold leading-tight text-white">
            One clear view of your business, every morning.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-white/60">
            Revenue, red flags, escalations, and marketing performance — pulled together automatically so you
            always know what needs your attention today.
          </p>
        </div>
      </div>
    </div>
  );
}
