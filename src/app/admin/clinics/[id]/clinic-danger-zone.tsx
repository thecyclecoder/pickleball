"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ClinicDangerZone({
  clinicId,
  clinicTitle,
}: {
  clinicId: string;
  clinicTitle: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    const entered = prompt(
      `Type "${clinicTitle}" to confirm deletion. All coaches and registrations will be removed.`
    );
    if (entered !== clinicTitle) return;
    setBusy(true);
    const res = await fetch(`/api/admin/clinics/${clinicId}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/admin/clinics");
      router.refresh();
    } else {
      const body = await res.json().catch(() => ({}));
      alert(body.error || "Failed to delete");
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-red-900 bg-red-950/20 p-5">
      <h3 className="text-sm font-semibold text-red-300">Danger zone</h3>
      <p className="mt-1 text-xs text-red-200/70">
        Permanently delete this clinic. Coaches and registrations go with it.
      </p>
      <button
        type="button"
        onClick={remove}
        disabled={busy}
        className="mt-3 rounded-lg border border-red-800 bg-red-900/40 px-4 py-2 text-sm text-red-200 hover:bg-red-900/60 disabled:opacity-50"
      >
        {busy ? "Deleting…" : "Delete clinic"}
      </button>
    </section>
  );
}
