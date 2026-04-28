"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CLINIC_RATING_OPTIONS,
  clinicRatingLabel,
  lessonTypeLabel,
  type ClinicRating,
  type LessonType,
} from "@/lib/types";

export function LessonRequestForm({
  coachSlug,
  coachLessonTypes,
  coachSkillLevels,
  locale,
}: {
  coachSlug: string;
  coachLessonTypes: LessonType[];
  coachSkillLevels: ClinicRating[];
  locale: "en" | "es";
}) {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [skill, setSkill] = useState("");
  const [lessonType, setLessonType] = useState("");
  const [goals, setGoals] = useState("");
  const [scheduleNotes, setScheduleNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If the coach hasn't picked any skill levels, fall back to the full list.
  const skillOptions = coachSkillLevels.length > 0 ? coachSkillLevels : (CLINIC_RATING_OPTIONS as readonly ClinicRating[]);

  const L =
    locale === "es"
      ? {
          firstName: "Nombre",
          lastName: "Apellido",
          email: "Correo",
          phone: "Teléfono (opcional)",
          skill: "Tu nivel de juego",
          skillPlaceholder: "Selecciona…",
          lessonType: "Tipo de lección",
          lessonTypePlaceholder: "Sin preferencia",
          goals: "Tus objetivos (opcional)",
          goalsPlaceholder: "¿En qué quieres trabajar?",
          schedule: "Disponibilidad (opcional)",
          schedulePlaceholder: "Mañanas, fines de semana, etc.",
          submit: "Solicitar lección",
          submitting: "Enviando…",
        }
      : {
          firstName: "First name",
          lastName: "Last name",
          email: "Email",
          phone: "Phone (optional)",
          skill: "Your skill level",
          skillPlaceholder: "Select…",
          lessonType: "Lesson type",
          lessonTypePlaceholder: "No preference",
          goals: "Your goals (optional)",
          goalsPlaceholder: "What do you want to work on?",
          schedule: "Availability (optional)",
          schedulePlaceholder: "Weekday mornings, weekends, etc.",
          submit: "Request a lesson",
          submitting: "Submitting…",
        };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/coaches/${coachSlug}/request`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          email,
          phone: phone || undefined,
          skill_level: skill,
          lesson_type: lessonType || undefined,
          goals: goals || undefined,
          schedule_notes: scheduleNotes || undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Submission failed");
      router.push(`/coaches/${coachSlug}/requested/${body.request_id}`);
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
        <Field label={L.email} type="email" required value={email} onChange={setEmail} autoComplete="email" />
        <Field label={L.phone} type="tel" value={phone} onChange={setPhone} autoComplete="tel" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>{L.skill}</Label>
          <select
            required
            value={skill}
            onChange={(e) => setSkill(e.target.value)}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-white focus:border-emerald-600 focus:outline-none"
          >
            <option value="">{L.skillPlaceholder}</option>
            {skillOptions.map((r) => (
              <option key={r} value={r}>
                {clinicRatingLabel(r, locale)}
              </option>
            ))}
          </select>
        </div>
        {coachLessonTypes.length > 0 && (
          <div>
            <Label>{L.lessonType}</Label>
            <select
              value={lessonType}
              onChange={(e) => setLessonType(e.target.value)}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-white focus:border-emerald-600 focus:outline-none"
            >
              <option value="">{L.lessonTypePlaceholder}</option>
              {coachLessonTypes.map((lt) => (
                <option key={lt} value={lt}>
                  {lessonTypeLabel(lt, locale)}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div>
        <Label>{L.goals}</Label>
        <textarea
          rows={3}
          value={goals}
          onChange={(e) => setGoals(e.target.value)}
          placeholder={L.goalsPlaceholder}
          className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-white focus:border-emerald-600 focus:outline-none"
        />
      </div>
      <div>
        <Label>{L.schedule}</Label>
        <textarea
          rows={2}
          value={scheduleNotes}
          onChange={(e) => setScheduleNotes(e.target.value)}
          placeholder={L.schedulePlaceholder}
          className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-white focus:border-emerald-600 focus:outline-none"
        />
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
        {submitting ? L.submitting : L.submit}
      </button>
    </form>
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
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  autoComplete?: string;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-white focus:border-emerald-600 focus:outline-none"
      />
    </div>
  );
}
