import Link from "next/link";
import { logoutAction } from "@/app/(auth)/actions";
import { getCurrentUser } from "@/lib/auth/session";
import { SignOutButton } from "./sign-out-button";

/** Header account area: signed-in user with a sign-out button, or a sign-in link. */
export async function AccountNav() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <Link
        href="/login"
        className="text-sm font-medium text-zinc-600 underline-offset-4 hover:text-black hover:underline dark:text-zinc-400 dark:hover:text-zinc-50"
      >
        Sign in
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <span className="hidden max-w-[16rem] truncate text-sm text-zinc-600 sm:inline dark:text-zinc-400" title={user.email}>
        {user.fullName ?? user.email}
      </span>
      <form action={logoutAction}>
        <SignOutButton />
      </form>
    </div>
  );
}
