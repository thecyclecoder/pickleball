"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { clinicRatingLabel, type ClinicRegistration } from "@/lib/types";

export function ClinicRegistrationsPanel({
  clinicId,
  capacity,
  registrations,
}: {
  clinicId: string;
  capacity: number | null;
  registrations: ClinicRegistration[];
}) {
  void clinicId;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [working, setWorking] = useState<string | null>(null);

  const active = registrations.filter((r) => r.status !== "cancelled");
  const paidCount = active.filter((r) => !!r.paid_at).length;

  function action(regId: string, body: Record<string, unknown>) {
    setWorking(regId);
    startTransition(async () => {
      await fetch(`/api/admin/clinic-registrations/${regId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      router.refresh();
      setWorking(null);
    });
  }

  function togglePaid(regId: string, paid: boolean) {
    setWorking(regId);
    startTransition(async () => {
      await fetch(`/api/admin/clinic-registrations/${regId}/paid`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ paid }),
      });
      router.refresh();
      setWorking(null);
    });
  }

  async function remove(regId: string) {
    if (!confirm("Delete this registration? The person's profile is preserved.")) return;
    setWorking(regId);
    await fetch(`/api/admin/clinic-registrations/${regId}`, { method: "DELETE" });
    router.refresh();
    setWorking(null);
  }

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900">
      <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-3">
        <h2 className="text-sm font-semibold text-white">Registrations</h2>
        <span className="text-xs text-zinc-500">
          {active.length} {capacity ? `/ ${capacity}` : ""} signed up · {paidCount} paid
        </span>
      </div>
      {registrations.length === 0 ? (
        <p className="px-5 py-6 text-center text-sm text-zinc-500">No signups yet.</p>
      ) : (
        <ul className="divide-y divide-zinc-800">
          {registrations.map((r) => {
            const busy = pending && working === r.id;
            const paid = !!r.paid_at;
            return (
              <li key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2">
                    <span className="font-medium text-white">
                      {r.first_name} {r.last_name}
                    </span>
                    <span className="text-xs text-zinc-500">
                      {clinicRatingLabel(r.rating_self)} · age {r.age}
                    </span>
                    {r.confirmed_at && (
                      <span className="rounded border border-emerald-700 bg-emerald-950/40 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-emerald-300">
                        Confirmed
                      </span>
                    )}
                  </p>
                  <p className="truncate text-xs text-zinc-500">{r.email}</p>
                </div>
                <select
                  disabled={busy}
                  value={r.status}
                  onChange={(e) => action(r.id, { status: e.target.value })}
                  className="rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs text-white"
                  aria-label="Status"
                >
                  <option value="registered">Registered</option>
                  <option value="waitlisted">Waitlisted</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                <label
                  className={`flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1 text-xs ${
                    paid
                      ? "border-emerald-800 bg-emerald-950/40 text-emerald-300"
                      : "border-zinc-800 bg-zinc-900 text-zinc-300"
                  } ${busy ? "opacity-60" : ""}`}
                >
                  <input
                    type="checkbox"
                    disabled={busy}
                    checked={paid}
                    onChange={(e) => togglePaid(r.id, e.currentTarget.checked)}
                    className="h-3.5 w-3.5 rounded border-zinc-700 bg-zinc-900 text-emerald-600"
                  />
                  {paid ? "Paid" : "Mark paid"}
                </label>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => remove(r.id)}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  Delete
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
