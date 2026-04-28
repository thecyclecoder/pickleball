"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CLINIC_RATING_OPTIONS } from "@/lib/types";

export function ClinicRegisterForm({
  clinicSlug,
  isFull,
  locale,
}: {
  clinicSlug: string;
  isFull: boolean;
  locale: "en" | "es";
}) {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [age, setAge] = useState("");
  const [rating, setRating] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const L =
    locale === "es"
      ? {
          firstName: "Nombre",
          lastName: "Apellido",
          email: "Correo",
          phone: "WhatsApp / teléfono",
          phoneHint: "Para recordatorios y cambios de última hora.",
          age: "Edad",
          rating: "Tu nivel de juego",
          ratingHint: "Si nunca has jugado, elige Principiante.",
          ratingPlaceholder: "Selecciona…",
          beginner: "Principiante",
          submit: "Inscribirme",
          submitWaitlist: "Unirme a lista de espera",
          submitting: "Enviando…",
        }
      : {
          firstName: "First name",
          lastName: "Last name",
          email: "Email",
          phone: "WhatsApp / phone",
          phoneHint: "Used for reminders and last-minute updates.",
          age: "Age",
          rating: "Your skill level",
          ratingHint: "Pick Beginner if you haven't played before.",
          ratingPlaceholder: "Select…",
          beginner: "Beginner",
          submit: "Sign me up",
          submitWaitlist: "Join the waitlist",
          submitting: "Submitting…",
        };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/clinics/${clinicSlug}/register`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          email,
          phone: phone || undefined,
          age: Number(age),
          rating_self: rating,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Registration failed");
      router.push(`/clinics/${clinicSlug}/registered/${body.registration_id}`);
    } catch (e) {
      setError((e as Error).message);
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-5 rounded-xl border border-zinc-800 bg-zinc-900 p-5 sm:space-y-6 sm:p-6"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={L.firstName} required value={firstName} onChange={setFirstName} autoComplete="given-name" />
        <Field label={L.lastName} required value={lastName} onChange={setLastName} autoComplete="family-name" />
        <Field
          label={L.email}
          type="email"
          required
          value={email}
          onChange={setEmail}
          autoComplete="email"
        />
        <Field
          label={L.age}
          type="number"
          required
          value={age}
          onChange={setAge}
          inputMode="numeric"
        />
      </div>
      <div>
        <Field
          label={L.phone}
          type="tel"
          value={phone}
          onChange={setPhone}
          autoComplete="tel"
          inputMode="tel"
        />
        <p className="mt-1 text-[11px] text-zinc-500">{L.phoneHint}</p>
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-400">
          {L.rating}
        </label>
        <select
          required
          value={rating}
          onChange={(e) => setRating(e.target.value)}
          className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-white focus:border-emerald-600 focus:outline-none"
        >
          <option value="">{L.ratingPlaceholder}</option>
          {CLINIC_RATING_OPTIONS.map((r) => (
            <option key={r} value={r}>
              {r === "beginner" ? L.beginner : r}
            </option>
          ))}
        </select>
        <p className="mt-1 text-[11px] text-zinc-500">{L.ratingHint}</p>
      </div>

      {error && (
        <p className="rounded-lg border border-red-800 bg-red-950/40 px-3 py-2 text-xs text-red-300">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-zinc-800"
      >
        {submitting ? L.submitting : isFull ? L.submitWaitlist : L.submit}
      </button>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
  autoComplete,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  autoComplete?: string;
  inputMode?: "text" | "email" | "tel" | "search" | "url" | "numeric" | "decimal" | "none";
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-400">
        {label}
      </label>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        inputMode={inputMode}
        className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-white focus:border-emerald-600 focus:outline-none"
      />
    </div>
  );
}
