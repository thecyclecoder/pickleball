"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { EmailAlias } from "@/lib/types";

export function EmailAliasesPanel({
  aliases,
  members,
  canEdit,
}: {
  aliases: EmailAlias[];
  members: { email: string; name: string | null }[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [localPart, setLocalPart] = useState("");
  const [forwardTo, setForwardTo] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/email-aliases", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          local_part: localPart.trim(),
          forward_to_email: forwardTo.trim(),
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Failed to create");
      setLocalPart("");
      setForwardTo("");
      setShowForm(false);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreating(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this email alias? Future inbound mail will bounce.")) return;
    setBusy(id);
    await fetch(`/api/admin/email-aliases/${id}`, { method: "DELETE" });
    router.refresh();
    setBusy(null);
  }

  function toggleActive(id: string, active: boolean) {
    setBusy(id);
    startTransition(async () => {
      await fetch(`/api/admin/email-aliases/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ active }),
      });
      router.refresh();
      setBusy(null);
    });
  }

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-white">Email addresses</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Create custom <code className="text-zinc-300">@buentiro.app</code> addresses that forward to a real
            inbox. Anyone who emails the alias gets a branded forward; replies go directly to the original sender.
          </p>
        </div>
        {canEdit && !showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="rounded-md border border-emerald-700 bg-emerald-950/40 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-950/60"
          >
            + Create email
          </button>
        )}
      </div>

      {showForm && canEdit && (
        <form onSubmit={create} className="mt-4 space-y-3 rounded-lg border border-zinc-800 bg-zinc-950 p-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr]">
            <div>
              <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                Address
              </label>
              <div className="flex items-center overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900">
                <input
                  required
                  value={localPart}
                  onChange={(e) => setLocalPart(e.target.value.toLowerCase())}
                  placeholder="dylan"
                  pattern="[a-z0-9][a-z0-9._-]*"
                  maxLength={64}
                  className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-white outline-none"
                />
                <span className="border-l border-zinc-800 px-3 py-2 text-xs text-zinc-500">
                  @buentiro.app
                </span>
              </div>
            </div>
            <div className="hidden self-end pb-2 sm:block">
              <span className="text-zinc-500">→</span>
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                Forward to
              </label>
              <input
                type="email"
                required
                value={forwardTo}
                list="member-emails"
                onChange={(e) => setForwardTo(e.target.value)}
                placeholder="real@gmail.com"
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-emerald-600"
              />
              {members.length > 0 && (
                <datalist id="member-emails">
                  {members.map((m) => (
                    <option key={m.email} value={m.email}>
                      {m.name ?? m.email}
                    </option>
                  ))}
                </datalist>
              )}
            </div>
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setError(null);
                setLocalPart("");
                setForwardTo("");
              }}
              className="rounded-md border border-zinc-800 px-3 py-1 text-xs text-zinc-300 hover:border-zinc-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating}
              className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
            >
              {creating ? "Creating…" : "Create"}
            </button>
          </div>
        </form>
      )}

      {aliases.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-zinc-800 px-4 py-6 text-center text-xs text-zinc-500">
          No email aliases yet. Create one above to start receiving mail at a{" "}
          <code className="text-zinc-300">@buentiro.app</code> address.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-zinc-800 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
          {aliases.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
              <div className="min-w-0 flex-1">
                <p className={a.active ? "text-white" : "text-zinc-500 line-through"}>
                  <strong>{a.local_part}</strong>@buentiro.app
                </p>
                <p className="text-xs text-zinc-500">→ {a.forward_to_email}</p>
              </div>
              {canEdit && (
                <>
                  <label
                    className={`flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1 text-xs ${
                      a.active
                        ? "border-emerald-800 bg-emerald-950/40 text-emerald-300"
                        : "border-zinc-800 bg-zinc-900 text-zinc-400"
                    } ${pending && busy === a.id ? "opacity-60" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={a.active}
                      disabled={pending}
                      onChange={(e) => toggleActive(a.id, e.currentTarget.checked)}
                      className="h-3.5 w-3.5 rounded border-zinc-700 bg-zinc-900 text-emerald-600"
                    />
                    {a.active ? "Active" : "Paused"}
                  </label>
                  <button
                    type="button"
                    onClick={() => remove(a.id)}
                    disabled={busy === a.id}
                    className="text-xs text-red-400 hover:text-red-300 disabled:opacity-60"
                  >
                    Delete
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
