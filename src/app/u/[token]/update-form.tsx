"use client";

import { useState } from "react";

export function UpdateForm({
  token,
  initialPhone,
  firstName,
}: {
  token: string;
  initialPhone: string;
  firstName: string;
}) {
  const [phone, setPhone] = useState(initialPhone);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/players/update`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, phone: phone.trim() }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Failed to save");
      setSavedAt(Date.now());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="mt-6 space-y-4">
      <div>
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-400">
          WhatsApp / phone
        </label>
        <input
          type="tel"
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+1 787 555 0123"
          autoComplete="tel"
          inputMode="tel"
          className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-3 text-base text-white focus:border-emerald-600 focus:outline-none"
        />
        <p className="mt-1.5 text-[11px] text-zinc-500">
          Used for live tournament updates. We don&apos;t share it.
        </p>
      </div>

      {error && (
        <p className="rounded-lg border border-red-800 bg-red-950/40 px-3 py-2 text-xs text-red-300">
          {error}
        </p>
      )}

      {savedAt && (
        <p className="rounded-lg border border-emerald-800 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-300">
          Saved! See you on the courts, {firstName}.
        </p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-500 disabled:bg-zinc-800"
      >
        {saving ? "Saving…" : initialPhone ? "Update number" : "Save number"}
      </button>
    </form>
  );
}
