"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CATEGORY_RATINGS,
  CATEGORY_TYPES,
  largestSrc,
  pickSrc,
  type CategoryType,
  type TournamentImage,
} from "@/lib/types";

type TournamentFormInput = {
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
  images: TournamentImage[];
  payment_qr_url: string;
  payment_instructions: string;
  payment_instructions_es: string;
};

type CategoryDraft = {
  id?: string; // server id if existing
  type: CategoryType;
  rating: string;
  label: string;
  label_es: string;
  team_limit: number;
  sort_order: number;
};

const TIMEZONES = [
  "America/Puerto_Rico",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
];

export function TournamentForm({
  mode,
  initialTournament,
  initialCategories,
}: {
  mode: "create" | "edit";
  initialTournament?: TournamentFormInput;
  initialCategories?: CategoryDraft[];
}) {
  const router = useRouter();
  const [form, setForm] = useState<TournamentFormInput>(
    initialTournament ?? {
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
      images: [],
      payment_qr_url: "",
      payment_instructions: "",
      payment_instructions_es: "",
    }
  );
  const [categories, setCategories] = useState<CategoryDraft[]>(initialCategories ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  function update<K extends keyof TournamentFormInput>(key: K, value: TournamentFormInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
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
        images: form.images,
        flyer_image_url: form.images[0] ? largestSrc(form.images[0]) : null,
        payment_qr_url: form.payment_qr_url || null,
        payment_instructions: form.payment_instructions || null,
        payment_instructions_es: form.payment_instructions_es || null,
      };

      let tournamentId = form.id;
      if (mode === "create") {
        const res = await fetch("/api/admin/tournaments", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || "Failed to create");
        tournamentId = body.tournament.id;
      } else {
        if (!form.id) throw new Error("Missing tournament id");
        const res = await fetch(`/api/admin/tournaments/${form.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || "Failed to save");
      }

      // Save categories
      if (tournamentId) {
        // Insert new categories (those without id)
        for (const c of categories) {
          if (c.id) continue;
          const r = await fetch(`/api/admin/tournaments/${tournamentId}/categories`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(c),
          });
          if (!r.ok) {
            const b = await r.json();
            throw new Error(b.error || "Failed to add category");
          }
        }

        // Patch existing categories
        for (const c of categories) {
          if (!c.id) continue;
          await fetch(`/api/admin/tournaments/${tournamentId}/categories/${c.id}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(c),
          });
        }

        // Delete removed categories
        const keptIds = new Set(categories.filter((c) => c.id).map((c) => c.id));
        for (const c of initialCategories ?? []) {
          if (c.id && !keptIds.has(c.id)) {
            await fetch(`/api/admin/tournaments/${tournamentId}/categories/${c.id}`, {
              method: "DELETE",
            });
          }
        }
      }

      if (mode === "create" && tournamentId) {
        router.push(`/admin/tournaments/${tournamentId}`);
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
      {/* Images */}
      <Section title="Flyer images" description="9:16 ratio (Instagram Reel) works best. First image is the cover.">
        <div className="space-y-3">
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
                  <div className="flex justify-end gap-0.5">
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
              {uploadingImage ? "Uploading…" : <><span className="mb-1 text-2xl leading-none">+</span><span>Add image</span></>}
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
        </div>
      </Section>

      <Section title="Basic info">
        <BilingualField
          label="Title"
          valueEn={form.title}
          valueEs={form.title_es}
          onChangeEn={(v) => update("title", v)}
          onChangeEs={(v) => update("title_es", v)}
          required
        />
        <BilingualField
          label="Short description"
          valueEn={form.description}
          valueEs={form.description_es}
          onChangeEn={(v) => update("description", v)}
          onChangeEs={(v) => update("description_es", v)}
          textarea
          rows={2}
        />
        <BilingualField
          label="Details (rules, prizes, format)"
          valueEn={form.details}
          valueEs={form.details_es}
          onChangeEn={(v) => update("details", v)}
          onChangeEs={(v) => update("details_es", v)}
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
            onChange={(v) => update("start_date", v)}
            required
          />
          <LabeledInput
            label="End date (optional)"
            type="date"
            value={form.end_date}
            onChange={(v) => update("end_date", v)}
          />
          <LabeledInput
            label="Start time"
            type="time"
            value={form.start_time}
            onChange={(v) => update("start_time", v)}
            required
          />
        </div>
        <div className="mt-3">
          <Label>Timezone</Label>
          <select
            value={form.timezone}
            onChange={(e) => update("timezone", e.target.value)}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white focus:border-emerald-600 focus:outline-none"
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
          onChangeEn={(v) => update("location", v)}
          onChangeEs={(v) => update("location_es", v)}
          required
        />
        <BilingualField
          label="Street address"
          valueEn={form.address}
          valueEs={form.address_es}
          onChangeEn={(v) => update("address", v)}
          onChangeEs={(v) => update("address_es", v)}
        />
        <LabeledInput
          label="Google Maps URL"
          value={form.google_maps_url}
          onChange={(v) => update("google_maps_url", v)}
          placeholder="https://maps.google.com/…"
        />
      </Section>

      <Section title="Categories">
        <CategoryEditor categories={categories} setCategories={setCategories} />
      </Section>

      <Section title="Payment" description="QR code for Venmo/ATH and payment instructions shown on the registration form.">
        <PaymentEditor
          qrUrl={form.payment_qr_url}
          instructions={form.payment_instructions}
          instructionsEs={form.payment_instructions_es}
          onChangeQr={(v) => update("payment_qr_url", v)}
          onChangeInstructions={(v) => update("payment_instructions", v)}
          onChangeInstructionsEs={(v) => update("payment_instructions_es", v)}
        />
      </Section>

      <Section title="Visibility">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Status</Label>
            <select
              value={form.status}
              onChange={(e) => update("status", e.target.value as TournamentFormInput["status"])}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white focus:border-emerald-600 focus:outline-none"
            >
              <option value="draft">Draft (private)</option>
              <option value="published">Published (public)</option>
              <option value="cancelled">Cancelled</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          <label className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white">
            <input
              type="checkbox"
              checked={form.registration_open}
              onChange={(e) => update("registration_open", e.currentTarget.checked)}
              className="h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-emerald-600 focus:ring-emerald-600"
            />
            Registration open
          </label>
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
          {saving ? "Saving…" : mode === "create" ? "Create tournament" : "Save changes"}
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
          onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChangeEn(e.target.value)}
          rows={textarea ? rows : undefined}
          required={required}
          className={common}
        />
      </div>
      <div>
        <Label>{label} (ES, optional)</Label>
        <Cmp
          value={valueEs}
          onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChangeEs(e.target.value)}
          rows={textarea ? rows : undefined}
          className={common}
        />
      </div>
    </div>
  );
}

function CategoryEditor({
  categories,
  setCategories,
}: {
  categories: CategoryDraft[];
  setCategories: (c: CategoryDraft[]) => void;
}) {
  function add() {
    setCategories([
      ...categories,
      {
        type: "MD",
        rating: "4.0",
        label: "",
        label_es: "",
        team_limit: 16,
        sort_order: categories.length,
      },
    ]);
  }
  function update(i: number, patch: Partial<CategoryDraft>) {
    setCategories(categories.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }
  function remove(i: number) {
    setCategories(categories.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-3">
      {categories.length === 0 && (
        <p className="rounded-lg border border-dashed border-zinc-800 p-4 text-center text-xs text-zinc-500">
          No categories yet.
        </p>
      )}
      {categories.map((c, i) => (
        <div key={i} className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
          <div className="grid gap-3 sm:grid-cols-5">
            <div>
              <Label>Type</Label>
              <select
                value={c.type}
                onChange={(e) => update(i, { type: e.target.value as CategoryType })}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-2 text-sm text-white"
              >
                {CATEGORY_TYPES.map((tp) => (
                  <option key={tp} value={tp}>
                    {tp}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Rating</Label>
              <select
                value={c.rating}
                onChange={(e) => update(i, { rating: e.target.value })}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-2 text-sm text-white"
              >
                {CATEGORY_RATINGS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Team limit</Label>
              <input
                type="number"
                min={1}
                value={c.team_limit}
                onChange={(e) => update(i, { team_limit: Number(e.target.value) })}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-2 text-sm text-white"
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Label override (optional)</Label>
              <input
                value={c.label}
                placeholder="e.g. Men's 4.0 Doubles"
                onChange={(e) => update(i, { label: e.target.value })}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-2 text-sm text-white"
              />
            </div>
          </div>
          <div className="mt-3 flex items-end gap-3">
            <div className="flex-1">
              <Label>Label (ES, optional)</Label>
              <input
                value={c.label_es}
                placeholder="e.g. Dobles Masculino 4.0"
                onChange={(e) => update(i, { label_es: e.target.value })}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-2 text-sm text-white"
              />
            </div>
            <button
              type="button"
              onClick={() => remove(i)}
              className="mb-[1px] rounded-lg border border-red-900 bg-red-950/40 px-3 py-2 text-xs text-red-300 hover:bg-red-950"
            >
              Remove
            </button>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 hover:border-emerald-600 hover:text-emerald-400"
      >
        + Add category
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
  const [error, setError] = useState<string | null>(null);

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.currentTarget.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/upload-flyer", { method: "POST", body: fd });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Upload failed");
      // Use the largest variant as the QR source (crisp on any device)
      onChangeQr(largestSrc(body.image));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <Label>QR code (Venmo or ATH Móvil)</Label>
        {qrUrl ? (
          <div className="flex items-start gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrUrl}
              alt="Payment QR"
              className="h-32 w-32 rounded-lg bg-white object-contain p-2"
            />
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => onChangeQr("")}
                className="text-xs text-red-400 hover:text-red-300"
              >
                Remove QR
              </button>
            </div>
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
        {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
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
