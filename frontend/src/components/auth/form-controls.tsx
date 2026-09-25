"use client";

import { useId, useState, type InputHTMLAttributes } from "react";

const inputClassName =
  "block w-full rounded-lg border bg-white px-3 py-2 text-sm text-black shadow-xs outline-none transition " +
  "placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 " +
  "disabled:cursor-not-allowed disabled:opacity-60 " +
  "dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-zinc-300 dark:focus:ring-zinc-300/10";

interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  label: string;
  name: string;
  error?: string | undefined;
  hint?: string;
}

function describedBy(errorId: string, hintId: string, error?: string, hint?: string): string | undefined {
  const ids = [error ? errorId : null, hint ? hintId : null].filter(Boolean);
  return ids.length > 0 ? ids.join(" ") : undefined;
}

function FieldMessages({ errorId, hintId, error, hint }: { errorId: string; hintId: string; error?: string | undefined; hint?: string | undefined }) {
  return (
    <>
      {hint && !error && (
        <p id={hintId} className="text-xs text-zinc-500 dark:text-zinc-400">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs font-medium text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </>
  );
}

const borderClass = (error?: string) =>
  error ? "border-red-500 dark:border-red-500" : "border-black/[.12] dark:border-white/[.15]";

export function TextField({ label, name, error, hint, className, ...props }: FieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-black dark:text-zinc-50">
        {label}
      </label>
      <input
        id={id}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(errorId, hintId, error, hint)}
        className={`${inputClassName} ${borderClass(error)} ${className ?? ""}`}
        {...props}
      />
      <FieldMessages errorId={errorId} hintId={hintId} error={error} hint={hint} />
    </div>
  );
}

export function PasswordField({ label, name, error, hint, className, ...props }: FieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const [visible, setVisible] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-black dark:text-zinc-50">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(errorId, hintId, error, hint)}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className={`${inputClassName} ${borderClass(error)} pr-16 ${className ?? ""}`}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-controls={id}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 flex items-center rounded-r-lg px-3 text-xs font-medium text-zinc-600 hover:text-black focus-visible:outline-2 focus-visible:outline-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50 dark:focus-visible:outline-zinc-300"
        >
          {visible ? "Hide" : "Show"}
          <span className="sr-only"> password</span>
        </button>
      </div>
      <FieldMessages errorId={errorId} hintId={hintId} error={error} hint={hint} />
    </div>
  );
}

export function FormAlert({ tone, children }: { tone: "error" | "success"; children: React.ReactNode }) {
  const toneClass =
    tone === "error"
      ? "border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
      : "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300";
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-lg border px-3 py-2 text-sm ${toneClass}`}>
      {children}
    </div>
  );
}

export function SubmitButton({ pending, children, pendingLabel }: { pending: boolean; children: React.ReactNode; pendingLabel: string }) {
  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-black px-4 text-sm font-medium text-white transition hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 disabled:cursor-not-allowed disabled:opacity-70 dark:bg-zinc-50 dark:text-black dark:hover:bg-zinc-200 dark:focus-visible:outline-zinc-300"
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
