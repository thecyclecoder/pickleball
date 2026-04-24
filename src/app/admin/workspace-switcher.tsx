"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type WorkspaceOption = { id: string; name: string };

export function WorkspaceSwitcher({
  activeId,
  options,
  canCreate,
}: {
  activeId: string;
  options: WorkspaceOption[];
  canCreate: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const active = options.find((o) => o.id === activeId);

  // Close on click outside
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  async function switchTo(id: string) {
    if (id === activeId || pending) return;
    setPending(id);
    try {
      await fetch("/api/admin/active-workspace", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ workspace_id: id }),
      });
      router.refresh();
      setOpen(false);
    } finally {
      setPending(null);
    }
  }

  // If the user has only one workspace and can't create more, just render a label
  if (options.length <= 1 && !canCreate) {
    return (
      <span className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-300">
        {active?.name ?? "Workspace"}
      </span>
    );
  }

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-200 hover:border-zinc-700 hover:text-white"
      >
        <span className="max-w-[140px] truncate">{active?.name ?? "Select workspace"}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-1.5 w-56 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 shadow-xl">
          <ul className="py-1">
            {options.map((opt) => (
              <li key={opt.id}>
                <button
                  type="button"
                  onClick={() => switchTo(opt.id)}
                  className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm ${
                    opt.id === activeId
                      ? "bg-emerald-950/40 text-emerald-300"
                      : "text-zinc-200 hover:bg-zinc-800"
                  }`}
                >
                  <span className="truncate">{opt.name}</span>
                  {opt.id === activeId && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              </li>
            ))}
          </ul>
          {canCreate && (
            <>
              <div className="border-t border-zinc-800" />
              <Link
                href="/admin/workspaces"
                onClick={() => setOpen(false)}
                className="block px-3 py-2 text-sm text-emerald-400 hover:bg-zinc-800"
              >
                + New workspace
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}
