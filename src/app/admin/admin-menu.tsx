"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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

export function AdminMenu({
  userEmail,
  isSuperAdmin = false,
  workspaceKind = "club",
  badges = {},
}: {
  userEmail: string | null;
  isSuperAdmin?: boolean;
  workspaceKind?: WorkspaceKind;
  /** Pending counts keyed by item.badgeKey — rendered as a small pill
   *  next to the menu label when > 0. */
  badges?: Record<string, number>;
}) {
  const items = workspaceKind === "coach" ? COACH_ITEMS : CLUB_ITEMS;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setOpen(false);
    router.push("/");
    router.refresh();
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="Open admin menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-9 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-700 hover:text-white"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-30 mt-2 w-56 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 shadow-xl"
        >
          <ul className="py-1 text-sm">
            {items.map((it) => {
              const badge = it.badgeKey ? badges[it.badgeKey] : 0;
              return (
                <li key={it.href}>
                  <Link
                    href={it.href}
                    onClick={() => setOpen(false)}
                    role="menuitem"
                    className="flex items-center justify-between gap-2 px-4 py-2.5 text-zinc-300 hover:bg-zinc-800 hover:text-white"
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

            {isSuperAdmin && (
              <>
                <li aria-hidden className="my-1 h-px bg-zinc-800" />
                <li aria-hidden className="px-4 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                  Super-admin
                </li>
                {SUPER_ADMIN_ITEMS.map((it) => (
                  <li key={it.href}>
                    <Link
                      href={it.href}
                      onClick={() => setOpen(false)}
                      role="menuitem"
                      className="block px-4 py-2.5 text-zinc-300 hover:bg-zinc-800 hover:text-white"
                    >
                      {it.label}
                    </Link>
                  </li>
                ))}
              </>
            )}

            <li aria-hidden className="my-1 h-px bg-zinc-800" />

            {userEmail && (
              <li aria-hidden className="px-4 py-1.5 text-[11px] text-zinc-500">
                Signed in as <span className="text-zinc-300">{userEmail}</span>
              </li>
            )}
            <li>
              <button
                type="button"
                role="menuitem"
                onClick={signOut}
                className="block w-full px-4 py-2.5 text-left text-zinc-300 hover:bg-zinc-800 hover:text-white"
              >
                Sign out
              </button>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
