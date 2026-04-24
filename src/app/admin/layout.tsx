import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentMembership } from "@/lib/auth";
import { AccessDenied } from "./access-denied";
import { SignOutButton } from "./sign-out-button";
import { Logo } from "@/components/logo";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const res = await getCurrentMembership();
  if (res.status === "anon") redirect("/login");
  if (res.status === "denied") return <AccessDenied email={res.user.email ?? undefined} />;

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-900">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-6">
            <Link href="/admin" aria-label="Buen Tiro" className="flex items-center gap-2 text-white">
              <Logo height={24} />
              <span className="hidden text-xs uppercase tracking-widest text-zinc-500 sm:inline">Admin</span>
            </Link>
            <nav className="hidden gap-5 text-sm text-zinc-400 sm:flex">
              <Link href="/admin" className="hover:text-white">Dashboard</Link>
              <Link href="/admin/tournaments" className="hover:text-white">Tournaments</Link>
              <Link href="/admin/members" className="hover:text-white">Members</Link>
              <Link href="/admin/settings" className="hover:text-white">Settings</Link>
            </nav>
          </div>
          <div className="flex items-center gap-3 text-xs text-zinc-500">
            <span className="hidden sm:inline">{res.user.email}</span>
            <SignOutButton />
          </div>
        </div>
        <nav className="flex gap-4 overflow-x-auto border-t border-zinc-900 px-6 py-2 text-xs text-zinc-400 sm:hidden">
          <Link href="/admin">Dashboard</Link>
          <Link href="/admin/tournaments">Tournaments</Link>
          <Link href="/admin/members">Members</Link>
          <Link href="/admin/settings">Settings</Link>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
