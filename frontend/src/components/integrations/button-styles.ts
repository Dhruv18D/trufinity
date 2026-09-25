// Shared by server and client components, so it must not live in a "use client" module.
const variants = {
  primary:
    "bg-black text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-black dark:hover:bg-zinc-200",
  secondary:
    "border border-black/[.12] bg-white text-black hover:bg-zinc-50 dark:border-white/[.15] dark:bg-zinc-950 dark:text-zinc-50 dark:hover:bg-zinc-900",
};

export type ButtonVariant = keyof typeof variants;

export const buttonClassName = (variant: ButtonVariant) =>
  `inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-4 text-sm font-medium transition ` +
  `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:focus-visible:outline-zinc-300 ` +
  `disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant]}`;
