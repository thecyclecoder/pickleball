"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  LESSON_REQUEST_STATUSES,
  clinicRatingLabel,
  lessonTypeLabel,
  type ClinicRating,
  type LessonRequest,
  type LessonRequestReply,
  type LessonType,
} from "@/lib/types";

export function LessonRequestsPanel({
  requests,
  replies,
}: {
  requests: LessonRequest[];
  replies: LessonRequestReply[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [working, setWorking] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [composer, setComposer] = useState<string | null>(null);
  const [composerText, setComposerText] = useState("");
  const [sending, setSending] = useState(false);
  const [composerError, setComposerError] = useState<string | null>(null);

  const repliesByRequest = useMemo(() => {
    const map = new Map<string, LessonRequestReply[]>();
    for (const r of replies) {
      const list = map.get(r.lesson_request_id) ?? [];
      list.push(r);
      map.set(r.lesson_request_id, list);
    }
    return map;
  }, [replies]);

  function action(id: string, body: Record<string, unknown>) {
    setWorking(id);
    startTransition(async () => {
      await fetch(`/api/admin/lesson-requests/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      router.refresh();
      setWorking(null);
    });
  }

  async function remove(id: string) {
    if (!confirm("Delete this lesson request? This cannot be undone.")) return;
    setWorking(id);
    await fetch(`/api/admin/lesson-requests/${id}`, { method: "DELETE" });
    router.refresh();
    setWorking(null);
  }

  function openComposer(id: string, prefill?: string) {
    setComposer(id);
    setComposerText(prefill ?? "");
    setComposerError(null);
    setExpanded(id);
  }

  async function sendReply(id: string) {
    if (!composerText.trim()) {
      setComposerError("Type a message first.");
      return;
    }
    setSending(true);
    setComposerError(null);
    try {
      const res = await fetch(`/api/admin/lesson-requests/${id}/reply`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: composerText }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Failed to send");
      setComposer(null);
      setComposerText("");
      router.refresh();
    } catch (e) {
      setComposerError((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  const newCount = requests.filter((r) => r.status === "new").length;

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900">
      <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-3">
        <h2 className="text-sm font-semibold text-white">Lesson requests</h2>
        <span className="text-xs text-zinc-500">
          {requests.length} total
          {newCount > 0 && (
            <>
              {" · "}
              <span className="text-emerald-400">{newCount} new</span>
            </>
          )}
        </span>
      </div>
      {requests.length === 0 ? (
        <p className="px-5 py-6 text-center text-sm text-zinc-500">
          No lesson requests yet. They&apos;ll show up here when someone requests a lesson on your public profile.
        </p>
      ) : (
        <ul className="divide-y divide-zinc-800">
          {requests.map((r) => {
            const busy = pending && working === r.id;
            const paid = !!r.paid_at;
            const isOpen = expanded === r.id;
            const isComposing = composer === r.id;
            const myReplies = repliesByRequest.get(r.id) ?? [];
            const hasReplied = myReplies.length > 0;
            return (
              <li key={r.id} className="px-5 py-3 text-sm">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setExpanded((v) => (v === r.id ? null : r.id))}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="flex items-center gap-2">
                      <span className="font-medium text-white">
                        {r.first_name} {r.last_name}
                      </span>
                      <span className="text-xs text-zinc-500">
                        {clinicRatingLabel(r.skill_level as ClinicRating)}
                        {r.lesson_type && (
                          <>
                            {" · "}
                            {lessonTypeLabel(r.lesson_type as LessonType)}
                          </>
                        )}
                      </span>
                      {r.confirmed_at && (
                        <span className="rounded border border-emerald-700 bg-emerald-950/40 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-emerald-300">
                          Confirmed
                        </span>
                      )}
                      {hasReplied && (
                        <span className="rounded border border-emerald-700 bg-emerald-950/40 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-emerald-300">
                          Replied
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-zinc-500">
                      {r.email}
                      {r.phone && <> · {r.phone}</>}
                      {" · "}
                      {new Date(r.created_at).toLocaleDateString()}
                    </p>
                  </button>
                  <button
                    type="button"
                    disabled={busy || sending}
                    onClick={() => openComposer(r.id)}
                    className="rounded-md border border-emerald-700 bg-emerald-950/40 px-2.5 py-1 text-xs font-medium text-emerald-300 hover:bg-emerald-950/60 disabled:opacity-60"
                  >
                    Reply
                  </button>
                  {r.status === "new" && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => action(r.id, { status: "contacted" })}
                      className="rounded-md border border-zinc-800 bg-zinc-950 px-2.5 py-1 text-xs text-zinc-200 hover:border-zinc-700 disabled:opacity-60"
                    >
                      Mark replied
                    </button>
                  )}
                  <select
                    disabled={busy}
                    value={r.status}
                    onChange={(e) => action(r.id, { status: e.target.value })}
                    className="rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs text-white"
                    aria-label="Status"
                  >
                    {LESSON_REQUEST_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </option>
                    ))}
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
                      onChange={(e) => action(r.id, { paid: e.currentTarget.checked })}
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
                </div>
                {isOpen && (
                  <div className="mt-3 space-y-3 rounded-lg border border-zinc-800 bg-zinc-950/40 p-3 text-xs text-zinc-300">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-zinc-500">Reply directly</p>
                      <p>
                        <a
                          href={`mailto:${r.email}`}
                          className="text-emerald-400 hover:text-emerald-300"
                        >
                          {r.email}
                        </a>
                        {r.phone && (
                          <>
                            {" · "}
                            <a
                              href={`tel:${r.phone}`}
                              className="text-emerald-400 hover:text-emerald-300"
                            >
                              {r.phone}
                            </a>
                          </>
                        )}
                      </p>
                    </div>
                    {r.goals && (
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-zinc-500">Goals</p>
                        <p className="whitespace-pre-wrap">{r.goals}</p>
                      </div>
                    )}
                    {r.schedule_notes && (
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-zinc-500">
                          Schedule notes
                        </p>
                        <p className="whitespace-pre-wrap">{r.schedule_notes}</p>
                      </div>
                    )}
                    {myReplies.length > 0 && (
                      <div>
                        <p className="mb-1.5 text-[10px] uppercase tracking-wider text-zinc-500">
                          Your replies
                        </p>
                        <ul className="space-y-2">
                          {myReplies.map((rep) => (
                            <li
                              key={rep.id}
                              className="rounded-md border border-emerald-900/60 bg-emerald-950/20 px-3 py-2"
                            >
                              <p className="text-[10px] uppercase tracking-wider text-emerald-400">
                                {rep.sender_email} ·{" "}
                                {new Date(rep.created_at).toLocaleString()}
                              </p>
                              <p className="mt-1 whitespace-pre-wrap text-emerald-50">
                                {rep.body}
                              </p>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {isComposing && (
                      <div>
                        <p className="mb-1.5 text-[10px] uppercase tracking-wider text-zinc-500">
                          New reply (sent from Buen Tiro, branded)
                        </p>
                        <textarea
                          rows={5}
                          value={composerText}
                          onChange={(e) => setComposerText(e.target.value)}
                          placeholder={`Hi ${r.first_name}, thanks for reaching out…`}
                          className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-white focus:border-emerald-600 focus:outline-none"
                        />
                        {composerError && (
                          <p className="mt-1 text-xs text-red-400">{composerError}</p>
                        )}
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <p className="text-[10px] text-zinc-500">
                            They&apos;ll see your message in a Buen Tiro email — replies go
                            to your inbox.
                          </p>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setComposer(null);
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
                              onClick={() => sendReply(r.id)}
                              className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
                            >
                              {sending ? "Sending…" : "Send reply"}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
