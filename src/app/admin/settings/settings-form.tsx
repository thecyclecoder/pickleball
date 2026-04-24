"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Workspace } from "@/lib/types";

export function SettingsForm({ workspace, canEdit }: { workspace: Workspace; canEdit: boolean }) {
  const router = useRouter();
  const [name, setName] = useState(workspace.name);
  const [venmoHandle, setVenmoHandle] = useState(workspace.payment_info?.venmo_handle ?? "");
  const [athHandle, setAthHandle] = useState(workspace.payment_info?.ath_handle ?? "");
  const [venmoQr, setVenmoQr] = useState(workspace.payment_info?.venmo_qr_url ?? "");
  const [athQr, setAthQr] = useState(workspace.payment_info?.ath_qr_url ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function uploadQr(e: React.ChangeEvent<HTMLInputElement>, setUrl: (s: string) => void) {
    const file = e.currentTarget.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    setError(null);
    const res = await fetch("/api/admin/upload-flyer", { method: "POST", body: fd });
    const body = await res.json();
    if (!res.ok) {
      setError(body.error || "Upload failed");
      return;
    }
    setUrl(body.url);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/workspace", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          payment_info: {
            venmo_handle: venmoHandle || undefined,
            ath_handle: athHandle || undefined,
            venmo_qr_url: venmoQr || undefined,
            ath_qr_url: athQr || undefined,
          },
        }),
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
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="mb-1 text-sm font-semibold text-white">Payment info</h2>
        <p className="mb-4 text-xs text-zinc-500">
          Shown to teams on the registration page. Handles and/or QR codes — either works.
        </p>
        <div className="grid gap-6 sm:grid-cols-2">
          <QrField
            title="Venmo"
            handle={venmoHandle}
            onHandle={setVenmoHandle}
            qrUrl={venmoQr}
            onUpload={(e) => uploadQr(e, setVenmoQr)}
            onClearQr={() => setVenmoQr("")}
            canEdit={canEdit}
          />
          <QrField
            title="ATH Móvil"
            handle={athHandle}
            onHandle={setAthHandle}
            qrUrl={athQr}
            onUpload={(e) => uploadQr(e, setAthQr)}
            onClearQr={() => setAthQr("")}
            canEdit={canEdit}
          />
        </div>
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

function QrField({
  title,
  handle,
  onHandle,
  qrUrl,
  onUpload,
  onClearQr,
  canEdit,
}: {
  title: string;
  handle: string;
  onHandle: (v: string) => void;
  qrUrl: string;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClearQr: () => void;
  canEdit: boolean;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-300">{title}</p>
      <label className="mb-1 block text-[10px] uppercase tracking-wider text-zinc-500">Handle</label>
      <input
        value={handle}
        onChange={(e) => onHandle(e.target.value)}
        disabled={!canEdit}
        placeholder="@yourname"
        className="mb-3 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white disabled:opacity-60"
      />
      <label className="mb-1 block text-[10px] uppercase tracking-wider text-zinc-500">QR code</label>
      {qrUrl ? (
        <div className="space-y-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrUrl} alt={`${title} QR`} className="h-32 w-32 rounded bg-white object-contain p-2" />
          {canEdit && (
            <button type="button" onClick={onClearQr} className="text-[10px] text-red-400 hover:text-red-300">
              Remove QR
            </button>
          )}
        </div>
      ) : (
        canEdit && (
          <label className="flex h-20 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-zinc-700 text-center text-[10px] text-zinc-400 hover:border-emerald-500 hover:text-emerald-400">
            <span>Upload QR image</span>
            <input type="file" accept="image/*" className="hidden" onChange={onUpload} />
          </label>
        )
      )}
    </div>
  );
}
