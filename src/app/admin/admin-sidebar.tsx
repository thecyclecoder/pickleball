"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Item = { href: string; label: string; badgeKey?: string };
type WorkspaceKind = "club" | "coach";

const CLUB_ITEMS: Item[] = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/tournaments", label: "Tournaments" },
  { href: "/admin/clinics", label: "Clinics" },
  { href: "/admin/formats", label: "Formats" },
  { href: "/admin/players", label: "Players" },
  { href: "/admin/members", label: "Members" },
  { href: "/admin/workspaces", label: "Workspaces" },
  { href: "/admin/settings", label: "Settings" },
];

const COACH_ITEMS: Item[] = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/lesson-requests", label: "Lesson requests", badgeKey: "lessonRequests" },
  { href: "/admin/lessons", label: "Lessons" },
  { href: "/admin/clinics", label: "Clinics" },
  { href: "/admin/coach", label: "Coach profile" },
  { href: "/admin/players", label: "Players" },
  { href: "/admin/members", label: "Members" },
  { href: "/admin/workspaces", label: "Workspaces" },
  { href: "/admin/settings", label: "Settings" },
];

const SUPER_ADMIN_ITEMS: Item[] = [
  { href: "/admin/coaches", label: "All coach profiles" },
];

/** Active when the current pathname matches the item's href exactly OR
 *  is a sub-route. /admin matches exactly only — every admin page would
 *  be a sub-route otherwise. */
function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminSidebar({
  userEmail,
  isSuperAdmin = false,
  workspaceKind = "club",
  badges = {},
}: {
  userEmail: string | null;
  isSuperAdmin?: boolean;
  workspaceKind?: WorkspaceKind;
  badges?: Record<string, number>;
}) {
  const items = workspaceKind === "coach" ? COACH_ITEMS : CLUB_ITEMS;
  const pathname = usePathname() ?? "/admin";
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r border-zinc-900 bg-zinc-950 lg:flex">
      <div className="border-b border-zinc-900 px-5 py-4">
        <Link href="/admin" className="text-xs font-semibold uppercase tracking-widest text-zinc-400 hover:text-white">
          Admin
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3 text-sm">
        <ul className="space-y-0.5">
          {items.map((it) => {
            const badge = it.badgeKey ? badges[it.badgeKey] : 0;
            const active = isActive(pathname, it.href);
            return (
              <li key={it.href}>
                <Link
                  href={it.href}
                  className={`flex items-center justify-between gap-2 rounded-md px-3 py-2 ${
                    active
                      ? "bg-zinc-900 text-white"
                      : "text-zinc-400 hover:bg-zinc-900/60 hover:text-zinc-100"
                  }`}
                >
                  <span>{it.label}</span>
                  {badge > 0 && (
                    <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                      {badge}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>

        {isSuperAdmin && (
          <>
            <p className="mt-5 px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
              Super-admin
            </p>
            <ul className="space-y-0.5">
              {SUPER_ADMIN_ITEMS.map((it) => {
                const active = isActive(pathname, it.href);
                return (
                  <li key={it.href}>
                    <Link
                      href={it.href}
                      className={`block rounded-md px-3 py-2 ${
                        active
                          ? "bg-zinc-900 text-white"
                          : "text-zinc-400 hover:bg-zinc-900/60 hover:text-zinc-100"
                      }`}
                    >
                      {it.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </nav>

      <div className="border-t border-zinc-900 px-3 py-3 text-xs">
        {userEmail && (
          <p className="truncate px-2 pb-2 text-[11px] text-zinc-500" title={userEmail}>
            {userEmail}
          </p>
        )}
        <button
          type="button"
          onClick={signOut}
          className="block w-full rounded-md px-3 py-2 text-left text-zinc-400 hover:bg-zinc-900 hover:text-white"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
