"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { TournamentFormat } from "@/lib/types";

type FormState = {
  name: string;
  description: string;
  pool_play_games_to: number;
  pool_play_win_by: number;
  pool_play_best_of: number;
  pool_play_advance_per_pool: number;
  has_quarterfinals: boolean;
  quarterfinals_games_to: number;
  quarterfinals_win_by: number;
  quarterfinals_best_of: number;
  has_semifinals: boolean;
  semifinals_games_to: number;
  semifinals_win_by: number;
  semifinals_best_of: number;
  has_finals: boolean;
  finals_games_to: number;
  finals_win_by: number;
  finals_best_of: number;
};

const BEST_OF_OPTIONS = [1, 3, 5];

export function FormatForm({
  mode,
  initial,
}: {
  mode: "create" | "edit";
  initial?: TournamentFormat;
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>({
    name: initial?.name ?? "",
    description: initial?.description ?? "",
    pool_play_games_to: initial?.pool_play_games_to ?? 11,
    pool_play_win_by: initial?.pool_play_win_by ?? 2,
    pool_play_best_of: initial?.pool_play_best_of ?? 1,
    pool_play_advance_per_pool: initial?.pool_play_advance_per_pool ?? 2,
    has_quarterfinals: initial?.has_quarterfinals ?? false,
    quarterfinals_games_to: initial?.quarterfinals_games_to ?? 11,
    quarterfinals_win_by: initial?.quarterfinals_win_by ?? 2,
    quarterfinals_best_of: initial?.quarterfinals_best_of ?? 1,
    has_semifinals: initial?.has_semifinals ?? true,
    semifinals_games_to: initial?.semifinals_games_to ?? 15,
    semifinals_win_by: initial?.semifinals_win_by ?? 2,
    semifinals_best_of: initial?.semifinals_best_of ?? 1,
    has_finals: initial?.has_finals ?? true,
    finals_games_to: initial?.finals_games_to ?? 11,
    finals_win_by: initial?.finals_win_by ?? 2,
    finals_best_of: initial?.finals_best_of ?? 3,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const payload = {
        ...form,
        description: form.description || null,
      };
      const res = await fetch(
        mode === "create" ? "/api/admin/formats" : `/api/admin/formats/${initial!.id}`,
        {
          method: mode === "create" ? "POST" : "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Failed");
      router.push("/admin/formats");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!initial) return;
    if (!confirm(`Delete the format "${initial.name}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/admin/formats/${initial.id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(body.error || "Failed to delete");
      return;
    }
    router.push("/admin/formats");
    router.refresh();
  }

  return (
    <form onSubmit={save} className="space-y-8">
      <Section title="Basics">
        <Field label="Name" required>
          <input
            required
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder={'e.g. "Standard 4.0 format"'}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white focus:border-emerald-600 focus:outline-none"
          />
        </Field>
        <Field label="Description (optional)">
          <textarea
            rows={2}
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="Used to differentiate formats at a glance"
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white focus:border-emerald-600 focus:outline-none"
          />
        </Field>
      </Section>

      <Section
        title="Pool play"
        description="Round-robin inside each pool. Top N advance to the bracket."
      >
        <div className="grid gap-4 sm:grid-cols-4">
          <NumberField
            label="Games to"
            value={form.pool_play_games_to}
            onChange={(v) => set("pool_play_games_to", v)}
            min={1}
          />
          <NumberField
            label="Win by"
            value={form.pool_play_win_by}
            onChange={(v) => set("pool_play_win_by", v)}
            min={1}
          />
          <BestOfField
            value={form.pool_play_best_of}
            onChange={(v) => set("pool_play_best_of", v)}
          />
          <NumberField
            label="Advance per pool"
            value={form.pool_play_advance_per_pool}
            onChange={(v) => set("pool_play_advance_per_pool", v)}
            min={1}
          />
        </div>
      </Section>

      <StageSection
        label="Quarterfinals"
        enabled={form.has_quarterfinals}
        onToggle={(v) => set("has_quarterfinals", v)}
        gamesTo={form.quarterfinals_games_to}
        onGamesTo={(v) => set("quarterfinals_games_to", v)}
        winBy={form.quarterfinals_win_by}
        onWinBy={(v) => set("quarterfinals_win_by", v)}
        bestOf={form.quarterfinals_best_of}
        onBestOf={(v) => set("quarterfinals_best_of", v)}
        note="Enable when 8 teams advance from pools."
      />
      <StageSection
        label="Semifinals"
        enabled={form.has_semifinals}
        onToggle={(v) => set("has_semifinals", v)}
        gamesTo={form.semifinals_games_to}
        onGamesTo={(v) => set("semifinals_games_to", v)}
        winBy={form.semifinals_win_by}
        onWinBy={(v) => set("semifinals_win_by", v)}
        bestOf={form.semifinals_best_of}
        onBestOf={(v) => set("semifinals_best_of", v)}
      />
      <StageSection
        label="Finals"
        enabled={form.has_finals}
        onToggle={(v) => set("has_finals", v)}
        gamesTo={form.finals_games_to}
        onGamesTo={(v) => set("finals_games_to", v)}
        winBy={form.finals_win_by}
        onWinBy={(v) => set("finals_win_by", v)}
        bestOf={form.finals_best_of}
        onBestOf={(v) => set("finals_best_of", v)}
      />

      {error && (
        <div className="rounded-lg border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between border-t border-zinc-800 pt-5">
        {mode === "edit" ? (
          <button
            type="button"
            onClick={remove}
            className="text-sm text-red-400 hover:text-red-300"
          >
            Delete format
          </button>
        ) : (
          <span />
        )}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-lg border border-zinc-800 px-4 py-2 text-sm text-zinc-300 hover:border-zinc-700 hover:text-white"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:bg-zinc-800"
          >
            {saving ? "Saving…" : mode === "create" ? "Create format" : "Save changes"}
          </button>
        </div>
      </div>
    </form>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <h2 className="text-sm font-semibold text-white">{title}</h2>
      {description && <p className="mt-1 text-xs text-zinc-500">{description}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

function StageSection({
  label,
  enabled,
  onToggle,
  gamesTo,
  onGamesTo,
  winBy,
  onWinBy,
  bestOf,
  onBestOf,
  note,
}: {
  label: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  gamesTo: number;
  onGamesTo: (v: number) => void;
  winBy: number;
  onWinBy: (v: number) => void;
  bestOf: number;
  onBestOf: (v: number) => void;
  note?: string;
}) {
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <header className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-white">{label}</h2>
          {note && <p className="mt-0.5 text-xs text-zinc-500">{note}</p>}
        </div>
        <label className="flex items-center gap-2 text-xs text-zinc-300">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => onToggle(e.currentTarget.checked)}
            className="h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-emerald-600"
          />
          Enabled
        </label>
      </header>
      {enabled && (
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField label="Games to" value={gamesTo} onChange={onGamesTo} min={1} />
          <NumberField label="Win by" value={winBy} onChange={onWinBy} min={1} />
          <BestOfField value={bestOf} onChange={onBestOf} />
        </div>
      )}
    </section>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-400">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
}) {
  return (
    <Field label={label}>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        min={min}
        className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white focus:border-emerald-600 focus:outline-none"
      />
    </Field>
  );
}

function BestOfField({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <Field label="Best of">
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white focus:border-emerald-600 focus:outline-none"
      >
        {BEST_OF_OPTIONS.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
    </Field>
  );
}
