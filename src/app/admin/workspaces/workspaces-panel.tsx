"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Row = {
  id: string;
  name: string;
  owner_email: string;
  created_at: string;
  role: string;
};

export function WorkspacesPanel({
  activeId,
  workspaces,
  canCreate,
}: {
  activeId: string;
  workspaces: Row[];
  canCreate: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      const res = await fetch("/api/admin/workspaces", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Failed");
      setName("");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreating(false);
    }
  }

  function switchTo(id: string) {
    if (id === activeId) return;
    startTransition(async () => {
      await fetch("/api/admin/active-workspace", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ workspace_id: id }),
      });
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {canCreate && (
        <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="mb-1 text-sm font-semibold text-white">Create a workspace</h2>
          <p className="mb-4 text-xs text-zinc-500">
            e.g. &ldquo;Cocolias&rdquo;, &ldquo;El Mulo&rdquo;. You&apos;ll be added as the owner. Switch
            to it from the workspace picker to manage its tournaments.
          </p>
          <form onSubmit={create} className="flex flex-wrap gap-3">
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Workspace name"
              disabled={creating}
              className="flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white focus:border-emerald-600 focus:outline-none"
            />
            <button
              type="submit"
              disabled={creating || !name.trim()}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:bg-zinc-800"
            >
              {creating ? "Creating…" : "Create"}
            </button>
          </form>
          {error && (
            <p className="mt-3 rounded-lg border border-red-900 bg-red-950/40 px-3 py-2 text-xs text-red-300">
              {error}
            </p>
          )}
        </section>
      )}

      <section className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
        <div className="border-b border-zinc-800 px-5 py-3">
          <h2 className="text-sm font-semibold text-white">Your workspaces ({workspaces.length})</h2>
        </div>
        <ul className="divide-y divide-zinc-800">
          {workspaces.map((w) => {
            const isActive = w.id === activeId;
            return (
              <li key={w.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm">
                    <span className="font-medium text-white">{w.name}</span>
                    <span className={`rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${
                      w.role === "owner"
                        ? "border-amber-700 text-amber-400"
                        : w.role === "admin"
                          ? "border-emerald-700 text-emerald-400"
                          : "border-zinc-700 text-zinc-400"
                    }`}>{w.role}</span>
                    {isActive && (
                      <span className="rounded border border-emerald-700 bg-emerald-950/40 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-emerald-300">
                        Active
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-zinc-500">Owner: {w.owner_email}</p>
                </div>
                {!isActive && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => switchTo(w.id)}
                    className="rounded-md border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-200 hover:border-emerald-600 hover:text-emerald-400"
                  >
                    Switch to this workspace
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
