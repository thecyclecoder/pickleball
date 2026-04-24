"use client";

import { useEffect, useState } from "react";
import {
  getPushSubscriptionStatus,
  subscribeToPush,
  unsubscribeFromPush,
  type PushStatus,
} from "@/lib/push";

export function PushToggle() {
  const [status, setStatus] = useState<PushStatus>("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPushSubscriptionStatus().then(setStatus);
  }, []);

  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      if (status === "subscribed") {
        const res = await unsubscribeFromPush();
        if (res.success) setStatus("not_subscribed");
        else setError("Couldn't unsubscribe");
      } else {
        const res = await subscribeToPush();
        if (res.success) setStatus("subscribed");
        else if (res.reason === "denied") setStatus("denied");
        else setError(res.reason ?? "Couldn't subscribe");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <h2 className="mb-1 text-sm font-semibold text-white">Push notifications</h2>
      <p className="mb-4 text-xs text-zinc-500">
        Get a push on this device when a new team registers for a tournament in this workspace.
        Toggle each device separately — your desktop and phone are tracked independently.
      </p>

      {status === "loading" && (
        <p className="text-xs text-zinc-500">Checking…</p>
      )}

      {status === "not_supported" && (
        <p className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-400">
          Push notifications aren&apos;t supported here. On iOS, add Buen Tiro to your home
          screen first.
        </p>
      )}

      {status === "denied" && (
        <p className="rounded-lg border border-red-900 bg-red-950/30 px-3 py-2 text-xs text-red-300">
          Notifications are blocked by your browser. Allow notifications for buentiro.app in your
          browser or device settings, then come back and toggle on.
        </p>
      )}

      {(status === "subscribed" || status === "not_subscribed") && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="text-xl">{status === "subscribed" ? "🔔" : "🔕"}</span>
            <div>
              <p className="text-sm text-white">
                {status === "subscribed" ? "Enabled on this device" : "Disabled on this device"}
              </p>
              <p className="text-xs text-zinc-500">
                {status === "subscribed"
                  ? "You'll receive pushes here when a new team signs up."
                  : "Tap to turn on push notifications for this device."}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={toggle}
            disabled={busy}
            aria-pressed={status === "subscribed"}
            className={`relative h-7 w-12 flex-shrink-0 rounded-full transition-colors ${
              status === "subscribed" ? "bg-emerald-600" : "bg-zinc-700"
            } ${busy ? "opacity-60" : ""}`}
          >
            <span
              className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition-all ${
                status === "subscribed" ? "left-5" : "left-0.5"
              }`}
            />
          </button>
        </div>
      )}

      {error && (
        <p className="mt-3 rounded-lg border border-red-900 bg-red-950/30 px-3 py-2 text-xs text-red-300">
          {error}
        </p>
      )}
    </section>
  );
}
