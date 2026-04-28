"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LESSON_TYPES, lessonTypeLabel, type Lesson, type LessonType } from "@/lib/types";

type FormState = {
  player_first_name: string;
  player_last_name: string;
  player_email: string;
  player_phone: string;
  starts_at: string; // local datetime input format yyyy-mm-ddThh:mm
  duration_minutes: number;
  timezone: string;
  location: string;
  google_maps_url: string;
  lesson_type: LessonType | "";
  price_cents: string; // form string, parsed on submit
  notes: string;
  send_invite: boolean;
};

const TIMEZONES = [
  "America/Puerto_Rico",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
];

function toLocalInput(iso: string): string {
  // iso is "...Z" — convert to local YYYY-MM-DDTHH:MM in browser timezone.
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toIsoFromLocal(local: string): string {
  // Treat as local time → ISO. The Date constructor parses
  // "YYYY-MM-DDTHH:MM" as local time, which is what the user typed.
  const d = new Date(local);
  return d.toISOString();
}

export function LessonForm({
  mode,
  initial,
  conversionFromRequestId,
}: {
  mode: "create" | "edit";
  initial?: Partial<Lesson> & {
    /** When converting from a lesson request, the form is pre-filled
     *  but we also need to forward the source request id so the API
     *  can mark it scheduled. */
    lesson_request_id?: string | null;
  };
  conversionFromRequestId?: string | null;
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>({
    player_first_name: initial?.player_first_name ?? "",
    player_last_name: initial?.player_last_name ?? "",
    player_email: initial?.player_email ?? "",
    player_phone: initial?.player_phone ?? "",
    starts_at: initial?.starts_at ? toLocalInput(initial.starts_at) : "",
    duration_minutes: initial?.duration_minutes ?? 60,
    timezone: initial?.timezone ?? "America/Puerto_Rico",
    location: initial?.location ?? "",
    google_maps_url: initial?.google_maps_url ?? "",
    lesson_type: (initial?.lesson_type ?? "") as LessonType | "",
    price_cents: initial?.price_cents != null ? String((initial.price_cents / 100).toFixed(2)) : "",
    notes: initial?.notes ?? "",
    send_invite: true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        player_first_name: form.player_first_name,
        player_last_name: form.player_last_name,
        player_email: form.player_email,
        player_phone: form.player_phone || null,
        starts_at: toIsoFromLocal(form.starts_at),
        duration_minutes: Number(form.duration_minutes),
        timezone: form.timezone,
        location: form.location || null,
        google_maps_url: form.google_maps_url || null,
        lesson_type: form.lesson_type || null,
        price_cents:
          form.price_cents.trim() === ""
            ? null
            : Math.round(parseFloat(form.price_cents) * 100),
        notes: form.notes || null,
        send_invite: form.send_invite,
        ...(mode === "create" && conversionFromRequestId
          ? { lesson_request_id: conversionFromRequestId }
          : {}),
      };

      const url = mode === "create"
        ? "/api/admin/lessons"
        : `/api/admin/lessons/${initial?.id}`;
      const method = mode === "create" ? "POST" : "PATCH";
      const res = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Failed to save");
      const lessonId = body.lesson?.id ?? initial?.id;
      router.push(`/admin/lessons/${lessonId}`);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-6">
      <Section title="Player">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="First name" required value={form.player_first_name} onChange={(v) => update("player_first_name", v)} />
          <Field label="Last name" required value={form.player_last_name} onChange={(v) => update("player_last_name", v)} />
          <Field label="Email" type="email" required value={form.player_email} onChange={(v) => update("player_email", v)} />
          <Field label="WhatsApp / phone" type="tel" value={form.player_phone} onChange={(v) => update("player_phone", v)} />
        </div>
      </Section>

      <Section title="Schedule">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field
            label="Start"
            type="datetime-local"
            required
            value={form.starts_at}
            onChange={(v) => update("starts_at", v)}
          />
          <div>
            <Label>Duration (minutes)</Label>
            <input
              type="number"
              min={15}
              max={1440}
              step={15}
              required
              value={form.duration_minutes}
              onChange={(e) => update("duration_minutes", Number(e.target.value))}
              className={inputCls}
            />
          </div>
          <div>
            <Label>Timezone</Label>
            <select
              value={form.timezone}
              onChange={(e) => update("timezone", e.target.value)}
              className={inputCls}
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Location" value={form.location} onChange={(v) => update("location", v)} placeholder="Cocolias Pickleball Court" />
          <Field label="Google Maps URL (optional)" value={form.google_maps_url} onChange={(v) => update("google_maps_url", v)} />
        </div>
      </Section>

      <Section title="Lesson details">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Type</Label>
            <select
              value={form.lesson_type}
              onChange={(e) => update("lesson_type", e.target.value as LessonType | "")}
              className={inputCls}
            >
              <option value="">— Not specified —</option>
              {LESSON_TYPES.map((t) => (
                <option key={t} value={t}>{lessonTypeLabel(t)}</option>
              ))}
            </select>
          </div>
          <div>
            <Label>Price ($)</Label>
            <input
              type="number"
              step="0.01"
              min={0}
              value={form.price_cents}
              onChange={(e) => update("price_cents", e.target.value)}
              placeholder="60"
              className={inputCls}
            />
          </div>
        </div>
        <div>
          <Label>Notes (private — coach only)</Label>
          <textarea
            rows={3}
            value={form.notes}
            onChange={(e) => update("notes", e.target.value)}
            className={inputCls}
          />
        </div>
      </Section>

      <Section title="Notification">
        <label className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white">
          <input
            type="checkbox"
            checked={form.send_invite}
            onChange={(e) => update("send_invite", e.currentTarget.checked)}
            className="h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-emerald-600"
          />
          {mode === "create"
            ? "Email the player a confirmation with calendar invite"
            : "Send updated calendar invite if the time changed"}
        </label>
      </Section>

      {error && (
        <p className="rounded-lg border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-3 border-t border-zinc-800 pt-5">
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
          {saving ? "Saving…" : mode === "create" ? "Schedule lesson" : "Save changes"}
        </button>
      </div>
    </form>
  );
}

const inputCls =
  "w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white focus:border-emerald-600 focus:outline-none";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <h2 className="text-sm font-semibold text-white">{title}</h2>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-400">
      {children}
    </label>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={inputCls}
      />
    </div>
  );
}
