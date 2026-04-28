"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  LESSON_REQUEST_STATUSES,
  clinicRatingLabel,
  lessonTypeLabel,
  type ClinicRating,
  type LessonRequest,
  type LessonRequestReply,
  type LessonRequestStatus,
  type LessonType,
} from "@/lib/types";
import { whatsappUrl } from "@/lib/phone";

export function LessonRequestDetail({
  request,
  replies,
  coachName,
}: {
  request: LessonRequest;
  replies: LessonRequestReply[];
  coachName?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [composerText, setComposerText] = useState("");
  const [composerOpen, setComposerOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [composerError, setComposerError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  function action(body: Record<string, unknown>) {
    setBusyAction(JSON.stringify(body));
    startTransition(async () => {
      await fetch(`/api/admin/lesson-requests/${request.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      router.refresh();
      setBusyAction(null);
    });
  }

  async function remove() {
    if (!confirm("Delete this lesson request? This cannot be undone.")) return;
    setBusyAction("delete");
    await fetch(`/api/admin/lesson-requests/${request.id}`, { method: "DELETE" });
    router.push("/admin/lesson-requests");
  }

  async function sendReply() {
    if (!composerText.trim()) {
      setComposerError("Type a message first.");
      return;
    }
    setSending(true);
    setComposerError(null);
    try {
      const res = await fetch(`/api/admin/lesson-requests/${request.id}/reply`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: composerText }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Failed to send");
      setComposerText("");
      setComposerOpen(false);
      router.refresh();
    } catch (e) {
      setComposerError((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  const greeting = coachName
    ? `Hi ${request.first_name}, this is ${coachName} following up on your lesson request from Buen Tiro.`
    : `Hi ${request.first_name}, following up on your lesson request from Buen Tiro.`;
  const wa = request.phone ? whatsappUrl(request.phone, greeting) : null;

  const hasReplies = replies.length > 0;

  return (
    <div className="space-y-6">
      {/* Status + actions */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-zinc-500">Status</p>
            <div className="mt-1 flex items-center gap-2">
              <select
                value={request.status}
                disabled={pending}
                onChange={(e) => action({ status: e.target.value })}
                className="rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-sm text-white"
              >
                {LESSON_REQUEST_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </select>
              {request.status === "new" && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => action({ status: "contacted" })}
                  className="rounded-md border border-zinc-800 bg-zinc-950 px-2.5 py-1 text-xs text-zinc-200 hover:border-zinc-700 disabled:opacity-60"
                >
                  Mark replied
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => router.push(`/admin/lessons/new?from=${request.id}`)}
              className="rounded-md border border-emerald-700 bg-emerald-950/40 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-950/60"
            >
              Convert to lesson
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={remove}
              className="rounded-md border border-red-900/60 bg-red-950/30 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-950/50 disabled:opacity-60"
            >
              {busyAction === "delete" ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>
      </section>

      {/* Request details */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="mb-3 text-sm font-semibold text-white">Request details</h2>
        <dl className="grid gap-4 sm:grid-cols-2">
          <Detail label="Skill level" value={clinicRatingLabel(request.skill_level as ClinicRating)} />
          <Detail
            label="Lesson type"
            value={request.lesson_type ? lessonTypeLabel(request.lesson_type as LessonType) : "No preference"}
          />
          {request.goals && (
            <Detail label="Goals" value={request.goals} fullWidth />
          )}
          {request.schedule_notes && (
            <Detail label="Availability" value={request.schedule_notes} fullWidth />
          )}
        </dl>
      </section>

      {/* Direct contact */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="mb-3 text-sm font-semibold text-white">Reply directly</h2>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={`mailto:${request.email}`}
            className="rounded-md border border-zinc-800 bg-zinc-950 px-2.5 py-1 text-xs text-zinc-200 hover:border-emerald-700 hover:text-emerald-400"
          >
            ✉ {request.email}
          </a>
          {wa && (
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md border border-emerald-700 bg-emerald-950/40 px-2.5 py-1 text-xs font-medium text-emerald-300 hover:bg-emerald-950/60"
            >
              WhatsApp
            </a>
          )}
          {request.phone && (
            <a
              href={`tel:${request.phone}`}
              className="rounded-md border border-zinc-800 bg-zinc-950 px-2.5 py-1 text-xs text-zinc-200 hover:border-emerald-700 hover:text-emerald-400"
            >
              ☎ {request.phone}
            </a>
          )}
        </div>
        <p className="mt-2 text-[11px] text-zinc-500">
          WhatsApp and direct phone replies happen off-platform. Use the composer below to reply
          through Buen Tiro and keep the thread tracked here.
        </p>
      </section>

      {/* Conversation */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Conversation</h2>
          {!composerOpen && (
            <button
              type="button"
              onClick={() => setComposerOpen(true)}
              className="rounded-md border border-emerald-700 bg-emerald-950/40 px-3 py-1 text-xs font-medium text-emerald-300 hover:bg-emerald-950/60"
            >
              {hasReplies ? "Reply" : "Send first reply"}
            </button>
          )}
        </div>

        {!hasReplies && !composerOpen && (
          <p className="rounded-lg border border-dashed border-zinc-800 px-4 py-4 text-center text-sm text-zinc-500">
            No messages yet.
          </p>
        )}

        {hasReplies && (
          <ul className="space-y-2">
            {replies.map((rep) => {
              const isPlayer =
                rep.direction === "inbound" &&
                rep.sender_email.toLowerCase() === request.email.toLowerCase();
              const tone = isPlayer
                ? "border-zinc-800 bg-zinc-950/60"
                : "border-emerald-900/60 bg-emerald-950/20";
              const labelTone = isPlayer ? "text-zinc-400" : "text-emerald-400";
              const bodyTone = isPlayer ? "text-zinc-100" : "text-emerald-50";
              return (
                <li
                  key={rep.id}
                  className={`rounded-md border px-3 py-2 ${tone} ${
                    isPlayer ? "" : "ml-6"
                  }`}
                >
                  <p className={`text-[10px] uppercase tracking-wider ${labelTone}`}>
                    {isPlayer ? "Player" : "You"} · {rep.sender_email} ·{" "}
                    {new Date(rep.created_at).toLocaleString()}
                  </p>
                  <p className={`mt-1 whitespace-pre-wrap ${bodyTone}`}>{rep.body}</p>
                </li>
              );
            })}
          </ul>
        )}

        {composerOpen && (
          <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
            <p className="mb-1.5 text-[10px] uppercase tracking-wider text-zinc-500">
              New reply (sent from Buen Tiro, branded)
            </p>
            <textarea
              rows={5}
              autoFocus
              value={composerText}
              onChange={(e) => setComposerText(e.target.value)}
              placeholder={`Hi ${request.first_name}, thanks for reaching out…`}
              className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white focus:border-emerald-600 focus:outline-none"
            />
            {composerError && <p className="mt-1 text-xs text-red-400">{composerError}</p>}
            <div className="mt-2 flex items-center justify-between gap-2">
              <p className="text-[10px] text-zinc-500">
                They&apos;ll see your message in a Buen Tiro email — replies are captured here.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setComposerOpen(false);
                    setComposerText("");
                    setComposerError(null);
                  }}
                  className="rounded-md border border-zinc-800 px-3 py-1 text-xs text-zinc-300 hover:border-zinc-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={sending}
                  onClick={sendReply}
                  className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
                >
                  {sending ? "Sending…" : "Send reply"}
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function Detail({
  label,
  value,
  fullWidth,
}: {
  label: string;
  value: string;
  fullWidth?: boolean;
}) {
  return (
    <div className={fullWidth ? "sm:col-span-2" : ""}>
      <dt className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-wrap text-sm text-zinc-100">{value}</dd>
    </div>
  );
}
