const features = [
  {
    title: "Daily Executive Brief",
    description:
      "A concise, day-to-day summary of business performance, ready the moment you need it.",
  },
  {
    title: "Real-time Alerts",
    description:
      "Get notified about the numbers that matter, as soon as they cross a threshold.",
  },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <header className="w-full border-b border-black/[.06] dark:border-white/[.08]">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-3">
          <span className="text-lg font-semibold tracking-tight text-black dark:text-zinc-50">
            Trufinity
          </span>
          <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            Business Intelligence Dashboard
          </span>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-20 px-6 py-20">
        <section className="flex flex-col items-start gap-6 text-left">
          <h1 className="text-4xl font-semibold tracking-tight text-black dark:text-zinc-50 sm:text-5xl">
            Trufinity
          </h1>
          <p className="max-w-2xl text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            Trufinity is a responsive business intelligence dashboard that
            brings your business data, daily executive brief, alerts, and
            supporting details together in one simple, actionable interface.
            It presents data and insights delivered by the backend — while
            business calculations and rule-based processing stay handled by
            the backend and data layer.
          </p>
        </section>

        <section className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-xl border border-black/[.06] bg-white p-6 dark:border-white/[.08] dark:bg-zinc-950"
            >
              <h2 className="text-base font-semibold text-black dark:text-zinc-50">
                {feature.title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                {feature.description}
              </p>
            </div>
          ))}
        </section>
      </main>

      <footer className="w-full border-t border-black/[.06] dark:border-white/[.08]">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6 text-sm text-zinc-500 dark:text-zinc-400">
          <span>&copy; {new Date().getFullYear()} Trufinity</span>
          <span>Built with Next.js, React &amp; TypeScript</span>
        </div>
      </footer>
    </div>
  );
}
