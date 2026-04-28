"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LESSON_STATUSES, type Lesson, type LessonStatus } from "@/lib/types";

export function LessonActions({ lesson }: { lesson: Lesson }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);

  function patch(body: Record<string, unknown>) {
    setBusy(JSON.stringify(body));
    startTransition(async () => {
      await fetch(`/api/admin/lessons/${lesson.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      router.refresh();
      setBusy(null);
    });
  }

  async function remove() {
    if (!confirm("Delete this lesson? This cannot be undone.")) return;
    setBusy("delete");
    await fetch(`/api/admin/lessons/${lesson.id}`, { method: "DELETE" });
    router.push("/admin/lessons");
  }

  const paid = !!lesson.paid_at;

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-zinc-500">Status</p>
          <div className="mt-1 flex items-center gap-2">
            <select
              value={lesson.status}
              disabled={pending}
              onChange={(e) => patch({ status: e.target.value as LessonStatus })}
              className="rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-sm text-white"
            >
              {LESSON_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s === "no_show" ? "No-show" : s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
            <label
              className={`flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1 text-xs ${
                paid
                  ? "border-emerald-800 bg-emerald-950/40 text-emerald-300"
                  : "border-zinc-800 bg-zinc-900 text-zinc-300"
              } ${pending ? "opacity-60" : ""}`}
            >
              <input
                type="checkbox"
                disabled={pending}
                checked={paid}
                onChange={(e) => patch({ paid: e.currentTarget.checked })}
                className="h-3.5 w-3.5 rounded border-zinc-700 bg-zinc-900 text-emerald-600"
              />
              {paid ? "Paid" : "Mark paid"}
            </label>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {lesson.status !== "completed" && (
            <button
              type="button"
              disabled={pending}
              onClick={() => patch({ status: "completed", paid: true })}
              className="rounded-md border border-emerald-700 bg-emerald-950/40 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-950/60 disabled:opacity-60"
            >
              Mark completed + paid
            </button>
          )}
          <button
            type="button"
            disabled={pending}
            onClick={remove}
            className="rounded-md border border-red-900/60 bg-red-950/30 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-950/50 disabled:opacity-60"
          >
            {busy === "delete" ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </section>
  );
}
