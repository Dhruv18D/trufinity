import Link from "next/link";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <header className="w-full border-b border-black/[.06] dark:border-white/[.08]">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-3">
          <Link href="/" className="text-lg font-semibold tracking-tight text-black dark:text-zinc-50">
            Trufinity
          </Link>
          <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            Business Intelligence Dashboard
          </span>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-12 sm:px-6">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
