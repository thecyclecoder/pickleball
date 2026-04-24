"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RATING_OPTIONS } from "@/lib/types";

type CategoryOpt = {
  id: string;
  label: string;
  is_full: boolean;
  spots_label: string;
};

type Payment = {
  venmo_qr_url?: string;
  ath_qr_url?: string;
  venmo_handle?: string;
  ath_handle?: string;
};

type Labels = {
  form_category: string;
  form_player1: string;
  form_player2: string;
  form_first_name: string;
  form_last_name: string;
  form_email: string;
  form_rating: string;
  form_rating_placeholder: string;
  form_submit_register: string;
  form_submit_waitlist: string;
  form_submitting: string;
  payment_info: string;
  success_registered_title: string;
  success_registered_desc: string;
  success_waitlisted_title: string;
  success_waitlisted_desc: string;
  register_another: string;
};

type PlayerFields = {
  first_name: string;
  last_name: string;
  email: string;
  rating: string;
};

const emptyPlayer: PlayerFields = { first_name: "", last_name: "", email: "", rating: "" };

export function RegisterForm({
  tournamentSlug,
  categories,
  payment,
  labels,
}: {
  tournamentSlug: string;
  categories: CategoryOpt[];
  payment: Payment;
  labels: Labels;
}) {
  const router = useRouter();
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [p1, setP1] = useState<PlayerFields>({ ...emptyPlayer });
  const [p2, setP2] = useState<PlayerFields>({ ...emptyPlayer });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<null | { status: "registered" | "waitlisted" }>(null);

  const selectedCategory = categories.find((c) => c.id === categoryId);
  const showPayment = payment.venmo_qr_url || payment.ath_qr_url || payment.venmo_handle || payment.ath_handle;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/tournaments/${tournamentSlug}/register`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ category_id: categoryId, player1: p1, player2: p2 }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Registration failed");
      setSuccess({ status: body.status });
      setP1({ ...emptyPlayer });
      setP2({ ...emptyPlayer });
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="rounded-xl border border-emerald-700/40 bg-emerald-950/30 p-5 sm:p-6">
        <h3 className="mb-2 text-lg font-semibold text-emerald-300">
          {success.status === "waitlisted" ? labels.success_waitlisted_title : labels.success_registered_title}
        </h3>
        <p className="mb-4 text-sm text-emerald-100/80">
          {success.status === "waitlisted" ? labels.success_waitlisted_desc : labels.success_registered_desc}
        </p>
        {showPayment && <PaymentPanel payment={payment} />}
        <button
          onClick={() => setSuccess(null)}
          className="mt-4 text-xs text-emerald-400 hover:text-emerald-300"
        >
          {labels.register_another}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5 rounded-xl border border-zinc-800 bg-zinc-900 p-5 sm:space-y-6 sm:p-6">
      <div>
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-400">
          {labels.form_category}
        </label>
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          required
          className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-white focus:border-emerald-600 focus:outline-none"
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label} {c.spots_label}
            </option>
          ))}
        </select>
      </div>

      <PlayerFieldset title={labels.form_player1} player={p1} onChange={setP1} labels={labels} />
      <PlayerFieldset title={labels.form_player2} player={p2} onChange={setP2} labels={labels} />

      {error && (
        <p className="rounded-lg border border-red-800 bg-red-950/40 px-3 py-2 text-xs text-red-300">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting || !categoryId}
        className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-zinc-800"
      >
        {submitting
          ? labels.form_submitting
          : selectedCategory?.is_full
            ? labels.form_submit_waitlist
            : labels.form_submit_register}
      </button>

      {showPayment && (
        <div className="pt-2">
          <p className="mb-3 text-xs uppercase tracking-wider text-zinc-500">{labels.payment_info}</p>
          <PaymentPanel payment={payment} />
        </div>
      )}
    </form>
  );
}

function PlayerFieldset({
  title,
  player,
  onChange,
  labels,
}: {
  title: string;
  player: PlayerFields;
  onChange: (p: PlayerFields) => void;
  labels: Labels;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold text-white">{title}</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField
          label={labels.form_first_name}
          value={player.first_name}
          onChange={(v) => onChange({ ...player, first_name: v })}
          required
          autoComplete="given-name"
        />
        <TextField
          label={labels.form_last_name}
          value={player.last_name}
          onChange={(v) => onChange({ ...player, last_name: v })}
          required
          autoComplete="family-name"
        />
        <TextField
          label={labels.form_email}
          type="email"
          value={player.email}
          onChange={(v) => onChange({ ...player, email: v })}
          required
          autoComplete="email"
          inputMode="email"
        />
        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-400">
            {labels.form_rating}
          </label>
          <select
            required
            value={player.rating}
            onChange={(e) => onChange({ ...player, rating: e.target.value })}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-white focus:border-emerald-600 focus:outline-none"
          >
            <option value="">{labels.form_rating_placeholder}</option>
            {RATING_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
      </div>
    </fieldset>
  );
}

function TextField({
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

function PaymentPanel({ payment }: { payment: Payment }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {(payment.venmo_qr_url || payment.venmo_handle) && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4 text-center">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-400">Venmo</p>
          {payment.venmo_qr_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={payment.venmo_qr_url} alt="Venmo QR" className="mx-auto mb-2 h-40 w-40 rounded bg-white object-contain p-2" />
          )}
          {payment.venmo_handle && <p className="text-sm text-white">{payment.venmo_handle}</p>}
        </div>
      )}
      {(payment.ath_qr_url || payment.ath_handle) && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4 text-center">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-400">ATH Móvil</p>
          {payment.ath_qr_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={payment.ath_qr_url} alt="ATH Móvil QR" className="mx-auto mb-2 h-40 w-40 rounded bg-white object-contain p-2" />
          )}
          {payment.ath_handle && <p className="text-sm text-white">{payment.ath_handle}</p>}
        </div>
      )}
    </div>
  );
}
