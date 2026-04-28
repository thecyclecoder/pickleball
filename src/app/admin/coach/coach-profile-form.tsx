"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CLINIC_RATING_OPTIONS,
  LESSON_TYPES,
  largestSrc,
  pickSrc,
  type ClinicRating,
  type CoachProfile,
  type LessonType,
  type TournamentImage,
} from "@/lib/types";

type FormState = {
  display_name: string;
  display_name_es: string;
  tagline: string;
  tagline_es: string;
  bio: string;
  bio_es: string;
  images: TournamentImage[];
  avatar_url: string;
  languages: string[];
  lesson_types: LessonType[];
  skill_levels: ClinicRating[];
  price_notes: string;
  price_notes_es: string;
  service_area: string;
  service_area_es: string;
  certifications: string;
  certifications_es: string;
  years_coaching: string;
  dupr_rating: string;
  status: "draft" | "published";
  accepting_requests: boolean;
};

const LANGUAGE_OPTIONS: { value: string; en: string; es: string }[] = [
  { value: "en", en: "English", es: "Inglés" },
  { value: "es", en: "Spanish", es: "Español" },
];

export function CoachProfileForm({ initial }: { initial: CoachProfile | null }) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>({
    display_name: initial?.display_name ?? "",
    display_name_es: initial?.display_name_es ?? "",
    tagline: initial?.tagline ?? "",
    tagline_es: initial?.tagline_es ?? "",
    bio: initial?.bio ?? "",
    bio_es: initial?.bio_es ?? "",
    images: initial?.images ?? [],
    avatar_url: initial?.avatar_url ?? "",
    languages: initial?.languages ?? [],
    lesson_types: initial?.lesson_types ?? [],
    skill_levels: initial?.skill_levels ?? [],
    price_notes: initial?.price_notes ?? "",
    price_notes_es: initial?.price_notes_es ?? "",
    service_area: initial?.service_area ?? "",
    service_area_es: initial?.service_area_es ?? "",
    certifications: initial?.certifications ?? "",
    certifications_es: initial?.certifications_es ?? "",
    years_coaching: initial?.years_coaching != null ? String(initial.years_coaching) : "",
    dupr_rating: initial?.dupr_rating != null ? String(initial.dupr_rating) : "",
    status: initial?.status ?? "draft",
    accepting_requests: initial?.accepting_requests ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function toggle<T extends string>(list: T[], value: T): T[] {
    return list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
  }

  async function uploadAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.currentTarget.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/upload-flyer", { method: "POST", body: fd });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Upload failed");
      set("avatar_url", largestSrc(body.image));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function uploadGallery(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploadingGallery(true);
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
      setUploadingGallery(false);
    }
  }

  function removeGalleryImage(idx: number) {
    setForm((f) => ({ ...f, images: f.images.filter((_, i) => i !== idx) }));
  }

  function moveGalleryImage(idx: number, dir: -1 | 1) {
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
    setMessage(null);
    try {
      const payload = {
        display_name: form.display_name,
        display_name_es: form.display_name_es || null,
        tagline: form.tagline || null,
        tagline_es: form.tagline_es || null,
        bio: form.bio || null,
        bio_es: form.bio_es || null,
        images: form.images,
        avatar_url: form.avatar_url || null,
        languages: form.languages,
        lesson_types: form.lesson_types,
        skill_levels: form.skill_levels,
        price_notes: form.price_notes || null,
        price_notes_es: form.price_notes_es || null,
        service_area: form.service_area || null,
        service_area_es: form.service_area_es || null,
        certifications: form.certifications || null,
        certifications_es: form.certifications_es || null,
        years_coaching: form.years_coaching === "" ? null : Number(form.years_coaching),
        dupr_rating: form.dupr_rating === "" ? null : Number(form.dupr_rating),
        status: form.status,
        accepting_requests: form.accepting_requests,
      };
      const res = await fetch("/api/admin/coach", {
        method: "PUT",
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

  async function remove() {
    if (!confirm("Delete your coach profile? Existing lesson requests are preserved.")) return;
    const res = await fetch("/api/admin/coach", { method: "DELETE" });
    if (res.ok) router.refresh();
  }

  return (
    <form onSubmit={save} className="space-y-8">
      {/* Profile photo + gallery */}
      <Section title="Photos">
        <div className="grid gap-5 sm:grid-cols-[auto_1fr]">
          <div>
            <Label>Profile photo</Label>
            {form.avatar_url ? (
              <div className="relative inline-block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={form.avatar_url}
                  alt={form.display_name || "Coach"}
                  className="h-32 w-32 rounded-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => set("avatar_url", "")}
                  className="absolute -right-1 -top-1 rounded-full bg-red-600 px-2 py-0.5 text-xs text-white"
                >
                  ✕
                </button>
              </div>
            ) : (
              <label
                className={`flex h-32 w-32 cursor-pointer flex-col items-center justify-center rounded-full border-2 border-dashed border-zinc-700 text-xs text-zinc-400 hover:border-emerald-500 hover:text-emerald-400 ${
                  uploadingAvatar ? "opacity-50" : ""
                }`}
              >
                {uploadingAvatar ? "…" : <><span className="text-xl leading-none">+</span><span>Photo</span></>}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={uploadAvatar}
                  disabled={uploadingAvatar}
                />
              </label>
            )}
          </div>
          <div>
            <Label>Gallery (optional)</Label>
            <p className="mb-2 text-xs text-zinc-500">
              Action shots or court photos shown on your public profile page.
            </p>
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
                        onClick={() => removeGalleryImage(i)}
                        className="rounded bg-red-600 px-1.5 py-0.5 text-[10px] text-white hover:bg-red-500"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="flex justify-between">
                      <button
                        type="button"
                        disabled={i === 0}
                        onClick={() => moveGalleryImage(i, -1)}
                        className="rounded bg-zinc-900 px-1.5 py-0.5 text-[10px] text-white disabled:opacity-40"
                      >
                        ←
                      </button>
                      <button
                        type="button"
                        disabled={i === form.images.length - 1}
                        onClick={() => moveGalleryImage(i, 1)}
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
                  uploadingGallery ? "opacity-50" : ""
                }`}
              >
                {uploadingGallery ? "Uploading…" : <><span className="mb-1 text-2xl leading-none">+</span><span>Add image</span></>}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => uploadGallery(e.currentTarget.files)}
                  disabled={uploadingGallery}
                />
              </label>
            </div>
          </div>
        </div>
      </Section>

      <Section title="Identity">
        <BilingualField
          label="Display name"
          valueEn={form.display_name}
          valueEs={form.display_name_es}
          onChangeEn={(v) => set("display_name", v)}
          onChangeEs={(v) => set("display_name_es", v)}
          required
        />
        <BilingualField
          label="Tagline"
          valueEn={form.tagline}
          valueEs={form.tagline_es}
          onChangeEn={(v) => set("tagline", v)}
          onChangeEs={(v) => set("tagline_es", v)}
          placeholder="USAPA-certified pro · 6.5 DUPR"
        />
        <BilingualField
          label="Bio"
          valueEn={form.bio}
          valueEs={form.bio_es}
          onChangeEn={(v) => set("bio", v)}
          onChangeEs={(v) => set("bio_es", v)}
          textarea
          rows={6}
          placeholder="A few paragraphs about your coaching style, background, and what students can expect."
        />
      </Section>

      <Section title="What you teach">
        <div>
          <Label>Lesson types offered</Label>
          <div className="flex flex-wrap gap-2">
            {LESSON_TYPES.map((t) => (
              <Pill
                key={t}
                active={form.lesson_types.includes(t)}
                onClick={() => set("lesson_types", toggle(form.lesson_types, t) as LessonType[])}
              >
                {t === "private" ? "Private" : t === "semi_private" ? "Semi-private" : "Group"}
              </Pill>
            ))}
          </div>
        </div>
        <div>
          <Label>Skill levels you teach</Label>
          <div className="flex flex-wrap gap-2">
            {CLINIC_RATING_OPTIONS.map((r) => (
              <Pill
                key={r}
                active={form.skill_levels.includes(r)}
                onClick={() => set("skill_levels", toggle(form.skill_levels, r) as ClinicRating[])}
              >
                {r === "beginner" ? "Beginner" : r}
              </Pill>
            ))}
          </div>
        </div>
        <div>
          <Label>Languages you can teach in</Label>
          <div className="flex flex-wrap gap-2">
            {LANGUAGE_OPTIONS.map((opt) => (
              <Pill
                key={opt.value}
                active={form.languages.includes(opt.value)}
                onClick={() => set("languages", toggle(form.languages, opt.value))}
              >
                {opt.en}
              </Pill>
            ))}
          </div>
        </div>
      </Section>

      <Section title="Pricing & details">
        <BilingualField
          label="Pricing notes"
          valueEn={form.price_notes}
          valueEs={form.price_notes_es}
          onChangeEn={(v) => set("price_notes", v)}
          onChangeEs={(v) => set("price_notes_es", v)}
          textarea
          rows={3}
          placeholder="$80/hr private · $40/person semi-private · contact for camps"
        />
        <BilingualField
          label="Service area / courts"
          valueEn={form.service_area}
          valueEs={form.service_area_es}
          onChangeEn={(v) => set("service_area", v)}
          onChangeEs={(v) => set("service_area_es", v)}
          textarea
          rows={2}
          placeholder="San Juan, Carolina · Cocolias Pickleball Club"
        />
        <BilingualField
          label="Certifications & background"
          valueEn={form.certifications}
          valueEs={form.certifications_es}
          onChangeEn={(v) => set("certifications", v)}
          onChangeEs={(v) => set("certifications_es", v)}
          textarea
          rows={3}
          placeholder="PPR Level II · 8 years coaching · Former APP touring pro"
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Years coaching</Label>
            <input
              type="number"
              min={0}
              value={form.years_coaching}
              onChange={(e) => set("years_coaching", e.target.value)}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <Label>DUPR rating</Label>
            <input
              type="number"
              step="0.1"
              min={0}
              max={9}
              value={form.dupr_rating}
              onChange={(e) => set("dupr_rating", e.target.value)}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white"
            />
          </div>
        </div>
      </Section>

      <Section title="Visibility">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Status</Label>
            <select
              value={form.status}
              onChange={(e) => set("status", e.target.value as FormState["status"])}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white"
            >
              <option value="draft">Draft (private)</option>
              <option value="published">Published (public)</option>
            </select>
          </div>
          <label className="mt-7 flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white">
            <input
              type="checkbox"
              checked={form.accepting_requests}
              onChange={(e) => set("accepting_requests", e.currentTarget.checked)}
              className="h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-emerald-600"
            />
            Accepting lesson requests
          </label>
        </div>
      </Section>

      {error && <p className="rounded-lg border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-300">{error}</p>}
      {message && <p className="rounded-lg border border-emerald-900 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-300">{message}</p>}

      <div className="flex items-center justify-between border-t border-zinc-800 pt-5">
        {initial ? (
          <button type="button" onClick={remove} className="text-sm text-red-400 hover:text-red-300">
            Delete profile
          </button>
        ) : (
          <span />
        )}
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:bg-zinc-800"
        >
          {saving ? "Saving…" : initial ? "Save changes" : "Create profile"}
        </button>
      </div>
    </form>
  );
}

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

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs transition-colors ${
        active
          ? "border-emerald-700 bg-emerald-950/40 text-emerald-300"
          : "border-zinc-800 bg-zinc-950 text-zinc-300 hover:border-zinc-700 hover:text-white"
      }`}
    >
      {children}
    </button>
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
  placeholder,
}: {
  label: string;
  valueEn: string;
  valueEs: string;
  onChangeEn: (v: string) => void;
  onChangeEs: (v: string) => void;
  textarea?: boolean;
  rows?: number;
  required?: boolean;
  placeholder?: string;
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
          placeholder={placeholder}
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
