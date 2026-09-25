export function AuthCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-black/[.06] bg-white p-6 shadow-sm sm:p-8 dark:border-white/[.08] dark:bg-zinc-950">
      <div className="mb-6 flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">{title}</h1>
        <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">{description}</p>
      </div>
      {children}
    </section>
  );
}
