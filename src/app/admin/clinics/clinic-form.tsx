"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { largestSrc, pickSrc, type TournamentImage } from "@/lib/types";

export type ClinicFormInput = {
  id?: string;
  title: string;
  title_es: string;
  description: string;
  description_es: string;
  details: string;
  details_es: string;
  start_date: string;
  end_date: string;
  start_time: string;
  timezone: string;
  location: string;
  location_es: string;
  address: string;
  address_es: string;
  google_maps_url: string;
  status: "draft" | "published" | "cancelled" | "completed";
  registration_open: boolean;
  capacity: number | null;
  images: TournamentImage[];
  payment_qr_url: string;
  payment_instructions: string;
  payment_instructions_es: string;
};

export type CoachDraft = {
  id?: string;
  name: string;
  title: string;
  image_url: string;
  sort_order: number;
};

const TIMEZONES = [
  "America/Puerto_Rico",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
];

export function ClinicForm({
  mode,
  initialClinic,
  initialCoaches,
}: {
  mode: "create" | "edit";
  initialClinic?: ClinicFormInput;
  initialCoaches?: CoachDraft[];
}) {
  const router = useRouter();
  const [form, setForm] = useState<ClinicFormInput>(
    initialClinic ?? {
      title: "",
      title_es: "",
      description: "",
      description_es: "",
      details: "",
      details_es: "",
      start_date: "",
      end_date: "",
      start_time: "18:00",
      timezone: "America/Puerto_Rico",
      location: "",
      location_es: "",
      address: "",
      address_es: "",
      google_maps_url: "",
      status: "draft",
      registration_open: true,
      capacity: null,
      images: [],
      payment_qr_url: "",
      payment_instructions: "",
      payment_instructions_es: "",
    }
  );
  const [coaches, setCoaches] = useState<CoachDraft[]>(initialCoaches ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  function set<K extends keyof ClinicFormInput>(k: K, v: ClinicFormInput[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function uploadImages(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploadingImage(true);
    setError(null);
    try {
      const uploaded: TournamentImage[] = [];
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/admin/upload-flyer", { method: "POST", body: fd });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || "Upload failed");
        uploaded.push(body.image);
      }
      setForm((f) => ({ ...f, images: [...f.images, ...uploaded] }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploadingImage(false);
    }
  }

  function removeImage(idx: number) {
    setForm((f) => ({ ...f, images: f.images.filter((_, i) => i !== idx) }));
  }

  function moveImage(idx: number, dir: -1 | 1) {
    setForm((f) => {
      const next = [...f.images];
      const swap = idx + dir;
      if (swap < 0 || swap >= next.length) return f;
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return { ...f, images: next };
    });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        title: form.title,
        title_es: form.title_es || null,
        description: form.description || null,
        description_es: form.description_es || null,
        details: form.details || null,
        details_es: form.details_es || null,
        start_date: form.start_date,
        end_date: form.end_date || null,
        start_time: form.start_time,
        timezone: form.timezone,
        location: form.location,
        location_es: form.location_es || null,
        address: form.address || null,
        address_es: form.address_es || null,
        google_maps_url: form.google_maps_url || null,
        status: form.status,
        registration_open: form.registration_open,
        capacity: form.capacity,
        images: form.images,
        flyer_image_url: form.images[0] ? largestSrc(form.images[0]) : null,
        payment_qr_url: form.payment_qr_url || null,
        payment_instructions: form.payment_instructions || null,
        payment_instructions_es: form.payment_instructions_es || null,
      };

      let clinicId = form.id;
      if (mode === "create") {
        const res = await fetch("/api/admin/clinics", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || "Failed to create");
        clinicId = body.clinic.id;
      } else {
        const res = await fetch(`/api/admin/clinics/${form.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || "Failed to save");
      }

      // Sync coaches
      if (clinicId) {
        for (const c of coaches.filter((c) => !c.id)) {
          const r = await fetch(`/api/admin/clinics/${clinicId}/coaches`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(c),
          });
          if (!r.ok) {
            const b = await r.json();
            throw new Error(b.error || "Failed to add coach");
          }
        }
        for (const c of coaches.filter((c) => c.id)) {
          await fetch(`/api/admin/clinics/${clinicId}/coaches/${c.id}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(c),
          });
        }
        const keptIds = new Set(coaches.filter((c) => c.id).map((c) => c.id));
        for (const c of initialCoaches ?? []) {
          if (c.id && !keptIds.has(c.id)) {
            await fetch(`/api/admin/clinics/${clinicId}/coaches/${c.id}`, { method: "DELETE" });
          }
        }
      }

      if (mode === "create" && clinicId) {
        router.push(`/admin/clinics/${clinicId}`);
      } else {
        router.refresh();
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-8">
      <Section title="Flyer images" description="9:16 ratio works best as a phone-camera style image.">
        <div className="flex flex-wrap gap-3">
          {form.images.map((img, i) => (
            <div
              key={i}
              className="group relative overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950"
              style={{ width: 90, height: 160 }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={pickSrc(img, 480)} alt="" className="h-full w-full object-cover" />
              <div className="absolute inset-0 flex flex-col justify-between bg-black/40 p-1 opacity-0 transition-opacity group-hover:opacity-100">
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    className="rounded bg-red-600 px-1.5 py-0.5 text-[10px] text-white hover:bg-red-500"
                  >
                    ✕
                  </button>
                </div>
                <div className="flex justify-between">
                  <button
                    type="button"
                    disabled={i === 0}
                    onClick={() => moveImage(i, -1)}
                    className="rounded bg-zinc-900 px-1.5 py-0.5 text-[10px] text-white disabled:opacity-40"
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    disabled={i === form.images.length - 1}
                    onClick={() => moveImage(i, 1)}
                    className="rounded bg-zinc-900 px-1.5 py-0.5 text-[10px] text-white disabled:opacity-40"
                  >
                    →
                  </button>
                </div>
              </div>
            </div>
          ))}
          <label
            className={`flex h-40 w-[90px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-zinc-700 text-center text-[10px] text-zinc-400 hover:border-emerald-500 hover:text-emerald-400 ${
              uploadingImage ? "opacity-50" : ""
            }`}
          >
            {uploadingImage ? "Uploading…" : (
              <>
                <span className="mb-1 text-2xl leading-none">+</span>
                <span>Add image</span>
              </>
            )}
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => uploadImages(e.currentTarget.files)}
              disabled={uploadingImage}
            />
          </label>
        </div>
      </Section>

      <Section title="Basic info">
        <BilingualField
          label="Title"
          valueEn={form.title}
          valueEs={form.title_es}
          onChangeEn={(v) => set("title", v)}
          onChangeEs={(v) => set("title_es", v)}
          required
        />
        <BilingualField
          label="Short description"
          valueEn={form.description}
          valueEs={form.description_es}
          onChangeEn={(v) => set("description", v)}
          onChangeEs={(v) => set("description_es", v)}
          textarea
          rows={2}
        />
        <BilingualField
          label="Details"
          valueEn={form.details}
          valueEs={form.details_es}
          onChangeEn={(v) => set("details", v)}
          onChangeEs={(v) => set("details_es", v)}
          textarea
          rows={6}
        />
      </Section>

      <Section title="Schedule">
        <div className="grid gap-4 sm:grid-cols-3">
          <LabeledInput
            label="Start date"
            type="date"
            value={form.start_date}
            onChange={(v) => set("start_date", v)}
            required
          />
          <LabeledInput
            label="End date (optional)"
            type="date"
            value={form.end_date}
            onChange={(v) => set("end_date", v)}
          />
          <LabeledInput
            label="Start time"
            type="time"
            value={form.start_time}
            onChange={(v) => set("start_time", v)}
            required
          />
        </div>
        <div>
          <Label>Timezone</Label>
          <select
            value={form.timezone}
            onChange={(e) => set("timezone", e.target.value)}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white"
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
        </div>
      </Section>

      <Section title="Location">
        <BilingualField
          label="Venue name"
          valueEn={form.location}
          valueEs={form.location_es}
          onChangeEn={(v) => set("location", v)}
          onChangeEs={(v) => set("location_es", v)}
          required
        />
        <BilingualField
          label="Street address"
          valueEn={form.address}
          valueEs={form.address_es}
          onChangeEn={(v) => set("address", v)}
          onChangeEs={(v) => set("address_es", v)}
        />
        <LabeledInput
          label="Google Maps URL"
          value={form.google_maps_url}
          onChange={(v) => set("google_maps_url", v)}
          placeholder="https://maps.google.com/…"
        />
      </Section>

      <Section title="Capacity & registration">
        <div className="grid gap-4 sm:grid-cols-2">
          <LabeledInput
            label="Capacity"
            type="number"
            value={form.capacity == null ? "" : String(form.capacity)}
            onChange={(v) => set("capacity", v === "" ? null : Number(v))}
            placeholder="leave blank for unlimited"
          />
          <label className="mt-7 flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white">
            <input
              type="checkbox"
              checked={form.registration_open}
              onChange={(e) => set("registration_open", e.currentTarget.checked)}
              className="h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-emerald-600"
            />
            Registration open
          </label>
        </div>
      </Section>

      <Section title="Coaches" description="Listed on the public clinic page in the order you set here.">
        <CoachEditor coaches={coaches} setCoaches={setCoaches} />
      </Section>

      <Section title="Payment" description="QR code (Venmo or ATH) + instructions shown on the registration page.">
        <PaymentEditor
          qrUrl={form.payment_qr_url}
          instructions={form.payment_instructions}
          instructionsEs={form.payment_instructions_es}
          onChangeQr={(v) => set("payment_qr_url", v)}
          onChangeInstructions={(v) => set("payment_instructions", v)}
          onChangeInstructionsEs={(v) => set("payment_instructions_es", v)}
        />
      </Section>

      <Section title="Visibility">
        <div>
          <Label>Status</Label>
          <select
            value={form.status}
            onChange={(e) => set("status", e.target.value as ClinicFormInput["status"])}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white"
          >
            <option value="draft">Draft (private)</option>
            <option value="published">Published (public)</option>
            <option value="cancelled">Cancelled</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </Section>

      {error && (
        <div className="rounded-lg border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">{error}</div>
      )}

      <div className="flex items-center justify-end gap-3 border-t border-zinc-800 pt-5">
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
          {saving ? "Saving…" : mode === "create" ? "Create clinic" : "Save changes"}
        </button>
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

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-400">
      {children}
    </label>
  );
}

function LabeledInput({
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
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white focus:border-emerald-600 focus:outline-none"
      />
    </div>
  );
}

function BilingualField({
  label,
  valueEn,
  valueEs,
  onChangeEn,
  onChangeEs,
  textarea,
  rows = 2,
  required,
}: {
  label: string;
  valueEn: string;
  valueEs: string;
  onChangeEn: (v: string) => void;
  onChangeEs: (v: string) => void;
  textarea?: boolean;
  rows?: number;
  required?: boolean;
}) {
  const Cmp = textarea ? "textarea" : "input";
  const common =
    "w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white focus:border-emerald-600 focus:outline-none";
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div>
        <Label>{label} (EN)</Label>
        <Cmp
          value={valueEn}
          onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
            onChangeEn(e.target.value)
          }
          rows={textarea ? rows : undefined}
          required={required}
          className={common}
        />
      </div>
      <div>
        <Label>{label} (ES, optional)</Label>
        <Cmp
          value={valueEs}
          onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
            onChangeEs(e.target.value)
          }
          rows={textarea ? rows : undefined}
          className={common}
        />
      </div>
    </div>
  );
}

function CoachEditor({
  coaches,
  setCoaches,
}: {
  coaches: CoachDraft[];
  setCoaches: (c: CoachDraft[]) => void;
}) {
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);

  function add() {
    setCoaches([
      ...coaches,
      { name: "", title: "", image_url: "", sort_order: coaches.length },
    ]);
  }
  function update(i: number, patch: Partial<CoachDraft>) {
    setCoaches(coaches.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }
  function remove(i: number) {
    setCoaches(coaches.filter((_, idx) => idx !== i));
  }
  async function uploadImage(i: number, file: File) {
    setUploadingIdx(i);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/upload-flyer", { method: "POST", body: fd });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Upload failed");
      update(i, { image_url: largestSrc(body.image) });
    } finally {
      setUploadingIdx(null);
    }
  }

  return (
    <div className="space-y-3">
      {coaches.length === 0 && (
        <p className="rounded-lg border border-dashed border-zinc-800 p-4 text-center text-xs text-zinc-500">
          No coaches yet.
        </p>
      )}
      {coaches.map((c, i) => (
        <div key={i} className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
          <div className="flex flex-wrap items-start gap-3">
            {/* Image */}
            <div className="flex-shrink-0">
              <Label>Photo</Label>
              {c.image_url ? (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={c.image_url}
                    alt={c.name || "Coach"}
                    className="h-20 w-20 rounded-lg object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => update(i, { image_url: "" })}
                    className="absolute -right-1 -top-1 rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] text-white"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <label
                  className={`flex h-20 w-20 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-zinc-700 text-[10px] text-zinc-400 hover:border-emerald-500 hover:text-emerald-400 ${
                    uploadingIdx === i ? "opacity-50" : ""
                  }`}
                >
                  {uploadingIdx === i ? "…" : <><span className="text-xl leading-none">+</span><span>Photo</span></>}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.currentTarget.files?.[0];
                      if (f) uploadImage(i, f);
                    }}
                    disabled={uploadingIdx === i}
                  />
                </label>
              )}
            </div>
            {/* Fields */}
            <div className="flex-1 grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Name</Label>
                <input
                  value={c.name}
                  required
                  onChange={(e) => update(i, { name: e.target.value })}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-2 text-sm text-white"
                />
              </div>
              <div>
                <Label>Title</Label>
                <input
                  value={c.title}
                  placeholder="e.g. Head Coach, USAPA Certified"
                  onChange={(e) => update(i, { title: e.target.value })}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-2 text-sm text-white"
                />
              </div>
              <div className="sm:col-span-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  Remove coach
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 hover:border-emerald-600 hover:text-emerald-400"
      >
        + Add coach
      </button>
    </div>
  );
}

function PaymentEditor({
  qrUrl,
  instructions,
  instructionsEs,
  onChangeQr,
  onChangeInstructions,
  onChangeInstructionsEs,
}: {
  qrUrl: string;
  instructions: string;
  instructionsEs: string;
  onChangeQr: (v: string) => void;
  onChangeInstructions: (v: string) => void;
  onChangeInstructionsEs: (v: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.currentTarget.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/upload-flyer", { method: "POST", body: fd });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Upload failed");
      onChangeQr(largestSrc(body.image));
    } finally {
      setUploading(false);
    }
  }
  return (
    <div className="space-y-4">
      <div>
        <Label>QR code</Label>
        {qrUrl ? (
          <div className="flex items-start gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrUrl} alt="Payment QR" className="h-32 w-32 rounded-lg bg-white object-contain p-2" />
            <button
              type="button"
              onClick={() => onChangeQr("")}
              className="text-xs text-red-400 hover:text-red-300"
            >
              Remove QR
            </button>
          </div>
        ) : (
          <label
            className={`flex h-32 w-full max-w-xs cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-zinc-700 text-center text-xs text-zinc-400 hover:border-emerald-500 hover:text-emerald-400 ${
              uploading ? "opacity-50" : ""
            }`}
          >
            {uploading ? "Uploading…" : <><span className="mb-1 text-2xl leading-none">+</span><span>Upload QR image</span></>}
            <input type="file" accept="image/*" className="hidden" onChange={upload} disabled={uploading} />
          </label>
        )}
      </div>
      <BilingualField
        label="Payment instructions"
        valueEn={instructions}
        valueEs={instructionsEs}
        onChangeEn={onChangeInstructions}
        onChangeEs={onChangeInstructionsEs}
        textarea
        rows={4}
      />
    </div>
  );
}
