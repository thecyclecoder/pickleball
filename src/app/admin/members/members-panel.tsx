"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { WorkspaceMember } from "@/lib/types";

export function MembersPanel({
  members,
  canManage,
  currentMemberId,
}: {
  members: WorkspaceMember[];
  canManage: boolean;
  currentMemberId: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState<string | null>(null);
  const [lastInvitedId, setLastInvitedId] = useState<string | null>(null);

  function inviteUrl(memberId: string) {
    if (typeof window === "undefined") return `/invite/${memberId}`;
    return `${window.location.origin}/invite/${memberId}`;
  }

  async function addMember(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/admin/members", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error || "Failed");
        return;
      }
      setEmail("");
      setRole("member");
      setLastInvitedId(body.member.id);
      router.refresh();
    });
  }

  async function remove(id: string, memberEmail: string) {
    if (!confirm(`Remove ${memberEmail} from this workspace?`)) return;
    startTransition(async () => {
      await fetch(`/api/admin/members/${id}`, { method: "DELETE" });
      router.refresh();
    });
  }

  async function copy(text: string, id: string) {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied((v) => (v === id ? null : v)), 2000);
  }

  return (
    <div className="space-y-6">
      {canManage && (
        <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="mb-1 text-sm font-semibold text-white">Invite by email</h2>
          <p className="mb-4 text-xs text-zinc-500">
            Creates an invite link. Share it with the person; they sign in with Google using this email.
          </p>
          <form onSubmit={addMember} className="flex flex-wrap gap-3">
            <input
              type="email"
              required
              value={email}
              placeholder="someone@example.com"
              onChange={(e) => setEmail(e.target.value)}
              disabled={pending}
              className="flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white focus:border-emerald-600 focus:outline-none"
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as "admin" | "member")}
              disabled={pending}
              className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:bg-zinc-800"
            >
              {pending ? "Saving…" : "Generate invite"}
            </button>
          </form>
          {error && (
            <p className="mt-3 rounded-lg border border-red-900 bg-red-950/40 px-3 py-2 text-xs text-red-300">
              {error}
            </p>
          )}
        </section>
      )}

      <section className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
        <div className="border-b border-zinc-800 px-5 py-3">
          <h2 className="text-sm font-semibold text-white">All members ({members.length})</h2>
        </div>
        <ul className="divide-y divide-zinc-800">
          {members.map((m) => {
            const pending = !m.joined_at;
            const highlighted = m.id === lastInvitedId;
            const url = inviteUrl(m.id);
            return (
              <li
                key={m.id}
                className={`px-5 py-4 ${highlighted ? "bg-emerald-950/20" : ""}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm">
                      <span className="font-medium text-white">{m.email}</span>
                      <span className={`rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${
                        m.role === "owner"
                          ? "border-amber-700 text-amber-400"
                          : m.role === "admin"
                            ? "border-emerald-700 text-emerald-400"
                            : "border-zinc-700 text-zinc-400"
                      }`}>{m.role}</span>
                      {pending && (
                        <span className="rounded border border-zinc-700 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-zinc-400">
                          Pending
                        </span>
                      )}
                    </p>
                    {m.joined_at && (
                      <p className="text-xs text-zinc-500">
                        Joined {new Date(m.joined_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  {canManage && m.role !== "owner" && m.id !== currentMemberId && (
                    <button
                      type="button"
                      onClick={() => remove(m.id, m.email)}
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      Remove
                    </button>
                  )}
                </div>
                {pending && (
                  <div className="mt-3 flex items-stretch gap-2 rounded-lg border border-zinc-800 bg-zinc-950 p-2">
                    <code className="flex-1 truncate px-2 py-1 text-xs text-zinc-300">{url}</code>
                    <button
                      type="button"
                      onClick={() => copy(url, m.id)}
                      className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs text-zinc-200 hover:border-emerald-600 hover:text-emerald-400"
                    >
                      {copied === m.id ? "Copied!" : "Copy link"}
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
