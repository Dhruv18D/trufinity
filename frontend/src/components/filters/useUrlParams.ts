"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";

/**
 * Merges param updates into the current URL (undefined removes a param) and navigates in a
 * transition, so the server components re-fetch with the new filters. Reads `window.location`
 * at call time instead of `useSearchParams`, which keeps pages prerender-safe.
 */
export function useUrlParams() {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const setParams = (updates: Record<string, string | undefined>) => {
    const params = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(updates)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    params.delete("page");
    const qs = params.toString();
    startTransition(() => router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false }));
  };

  return { setParams, isPending };
}
