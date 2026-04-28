"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Workspace, WorkspaceKind } from "@/lib/types";

export function SettingsForm({
  workspace,
  canEdit,
  isOwner,
}: {
  workspace: Workspace;
  canEdit: boolean;
  isOwner: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState(workspace.name);
  const [kind, setKind] = useState<WorkspaceKind>(workspace.kind);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const payload: Record<string, unknown> = { name };
      if (isOwner && kind !== workspace.kind) payload.kind = kind;
      const res = await fetch("/api/admin/workspace", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Failed");
      setMessage("Saved");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-6">
      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="mb-4 text-sm font-semibold text-white">Workspace</h2>
        <label className="mb-1.5 block text-xs uppercase tracking-wider text-zinc-400">Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={!canEdit}
          className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white focus:border-emerald-600 focus:outline-none disabled:opacity-60"
        />

        <label className="mt-5 mb-1.5 block text-xs uppercase tracking-wider text-zinc-400">
          Workspace type
        </label>
        <div className="grid gap-2 sm:grid-cols-2">
          <KindOption
            label="Club"
            description="Runs tournaments + clinics. No coach profile."
            value="club"
            selected={kind === "club"}
            disabled={!isOwner}
            onSelect={() => isOwner && setKind("club")}
          />
          <KindOption
            label="Coach"
            description="Solo coach storefront: profile + lessons + clinics. No tournaments."
            value="coach"
            selected={kind === "coach"}
            disabled={!isOwner}
            onSelect={() => isOwner && setKind("coach")}
          />
        </div>
        {!isOwner && (
          <p className="mt-2 text-xs text-zinc-500">Only the workspace owner can change this.</p>
        )}

        <p className="mt-4 text-xs text-zinc-500">
          Payment details (QR code + instructions) are set per-tournament under{" "}
          <span className="text-zinc-300">Tournaments → edit → Payment</span>. Each tournament can
          have its own.
        </p>
      </section>

      {error && (
        <p className="rounded-lg border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}
      {message && (
        <p className="rounded-lg border border-emerald-900 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-300">
          {message}
        </p>
      )}

      {canEdit && (
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:bg-zinc-800"
          >
            {saving ? "Saving…" : "Save settings"}
          </button>
        </div>
      )}
    </form>
  );
}

function KindOption({
  label,
  description,
  value,
  selected,
  disabled,
  onSelect,
}: {
  label: string;
  description: string;
  value: string;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled && !selected}
      aria-pressed={selected}
      data-kind={value}
      className={`text-left rounded-lg border p-3 transition-colors ${
        selected
          ? "border-emerald-600 bg-emerald-950/30"
          : "border-zinc-800 bg-zinc-950 hover:border-zinc-700"
      } ${disabled && !selected ? "cursor-not-allowed opacity-60" : ""}`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`inline-block h-2 w-2 rounded-full ${
            selected ? "bg-emerald-500" : "bg-zinc-600"
          }`}
        />
        <span className="text-sm font-medium text-white">{label}</span>
      </div>
      <p className="mt-1 text-xs text-zinc-400">{description}</p>
    </button>
  );
}
