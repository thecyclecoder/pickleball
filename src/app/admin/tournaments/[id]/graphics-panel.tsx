"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export type GraphicRow = {
  id: string;
  type: string;
  target_key: string | null;
  svg: string | null;
  png_url: string | null;
  approved: boolean;
  updated_at: string;
};

export type PoolForGraphics = {
  id: string;
  letter: string;
  category_id: string;
  categoryDisplay: string;
};

export type CategoryForGraphics = {
  id: string;
  display: string;
};

export function GraphicsPanel({
  tournamentId,
  graphics,
  pools,
  categories,
}: {
  tournamentId: string;
  graphics: GraphicRow[];
  pools: PoolForGraphics[];
  categories: CategoryForGraphics[];
}) {
  const template = graphics.find((g) => g.type === "template") ?? null;

  return (
    <details className="group rounded-xl border border-zinc-800 bg-zinc-900">
      <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-3 [&::-webkit-details-marker]:hidden">
        <h3 className="text-sm font-semibold text-white">Graphics</h3>
        <svg
          className="h-4 w-4 text-zinc-500 transition-transform group-open:rotate-180"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </summary>

      <div className="space-y-6 border-t border-zinc-800 px-5 py-5">
        <TemplateUploadTile tournamentId={tournamentId} template={template} />

        {!template && (
          <p className="rounded-md border border-amber-900/60 bg-amber-950/30 px-3 py-2 text-xs text-amber-200">
            Upload a template first. Variants below render data on top of it.
          </p>
        )}

        {template && (
          <>
            <Section title="Pool results">
              {pools.length === 0 && (
                <p className="text-xs text-zinc-500">
                  Generate pools in the Pools &amp; bracket section first.
                </p>
              )}
              {pools.map((p) => (
                <VariantTile
                  key={p.id}
                  tournamentId={tournamentId}
                  type="pool_result"
                  targetKey={p.id}
                  label={`Pool ${p.letter}${
                    categories.length > 1 ? ` · ${p.categoryDisplay}` : ""
                  }`}
                  existing={
                    graphics.find(
                      (g) => g.type === "pool_result" && g.target_key === p.id
                    ) ?? null
                  }
                />
              ))}
            </Section>

            <Section title="Bracket">
              {categories.map((c) => (
                <div key={c.id} className="space-y-3">
                  {categories.length > 1 && (
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                      {c.display}
                    </p>
                  )}
                  <VariantTile
                    tournamentId={tournamentId}
                    type="bracket_qf"
                    targetKey={c.id}
                    label="Quarterfinals"
                    existing={
                      graphics.find(
                        (g) => g.type === "bracket_qf" && g.target_key === c.id
                      ) ?? null
                    }
                  />
                  <VariantTile
                    tournamentId={tournamentId}
                    type="bracket_sf"
                    targetKey={c.id}
                    label="Semifinals"
                    existing={
                      graphics.find(
                        (g) => g.type === "bracket_sf" && g.target_key === c.id
                      ) ?? null
                    }
                  />
                  <VariantTile
                    tournamentId={tournamentId}
                    type="bracket_f"
                    targetKey={c.id}
                    label="Final"
                    existing={
                      graphics.find(
                        (g) => g.type === "bracket_f" && g.target_key === c.id
                      ) ?? null
                    }
                  />
                </div>
              ))}
            </Section>

            <Section title="Tournament results">
              {categories.map((c) => (
                <VariantTile
                  key={c.id}
                  tournamentId={tournamentId}
                  type="tournament_result"
                  targetKey={c.id}
                  label={
                    categories.length > 1 ? `Champions · ${c.display}` : "Champions"
                  }
                  existing={
                    graphics.find(
                      (g) =>
                        g.type === "tournament_result" && g.target_key === c.id
                    ) ?? null
                  }
                />
              ))}
            </Section>
          </>
        )}
      </div>
    </details>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h4 className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
        {title}
      </h4>
      {children}
    </div>
  );
}

function TemplateUploadTile({
  tournamentId,
  template,
}: {
  tournamentId: string;
  template: GraphicRow | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setError(null);
    setBusy(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`/api/admin/tournaments/${tournamentId}/template`, {
      method: "POST",
      body: fd,
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Upload failed");
      setBusy(false);
      return;
    }
    router.refresh();
    setBusy(false);
  }

  async function remove() {
    if (!confirm("Remove the template image? Variants will stop generating until a new one is uploaded.")) return;
    setBusy(true);
    const res = await fetch(`/api/admin/tournaments/${tournamentId}/template`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Delete failed");
    }
    router.refresh();
    setBusy(false);
  }

  return (
    <div className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-950 p-4">
      <div>
        <p className="text-sm font-semibold text-white">Tournament template</p>
        <p className="mt-0.5 text-xs text-zinc-400">
          Upload a 1080×1350 image. The system overlays pool results, bracket, and
          champion data in the empty middle area (roughly y=320–820 of the image).
        </p>
      </div>

      {template?.png_url && (
        <a
          href={template.png_url}
          target="_blank"
          rel="noopener noreferrer"
          className="block overflow-hidden rounded-lg border border-zinc-800 bg-black"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={template.png_url}
            alt="Template preview"
            className="block h-auto w-full max-w-md"
          />
        </a>
      )}

      {error && (
        <p className="rounded-md border border-red-900/60 bg-red-950/30 px-3 py-2 text-xs text-red-300">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(e) => {
            const f = e.currentTarget.files?.[0];
            if (f) upload(f);
            e.currentTarget.value = "";
          }}
          disabled={busy}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {busy ? "Uploading…" : template ? "Replace template" : "Upload template"}
        </button>
        {template && (
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className="rounded-md border border-red-900/60 bg-red-950/30 px-3 py-1.5 text-xs text-red-300 hover:bg-red-950/50 disabled:opacity-50"
          >
            Remove
          </button>
        )}
      </div>
    </div>
  );
}

function VariantTile({
  tournamentId,
  type,
  targetKey,
  label,
  existing,
}: {
  tournamentId: string;
  type: string;
  targetKey: string | null;
  label: string;
  existing: GraphicRow | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"generate" | "delete" | "approve" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setError(null);
    setBusy("generate");
    const res = await fetch(`/api/admin/tournaments/${tournamentId}/graphics/${type}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(targetKey ? { target_key: targetKey } : {}),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Generation failed");
      setBusy(null);
      return;
    }
    router.refresh();
    setBusy(null);
  }

  async function toggleApprove() {
    if (!existing) return;
    setBusy("approve");
    setError(null);
    const res = await fetch(`/api/admin/tournaments/${tournamentId}/graphics/${type}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        approved: !existing.approved,
        target_key: targetKey,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Approve failed");
    }
    router.refresh();
    setBusy(null);
  }

  async function remove() {
    if (!existing) return;
    if (!confirm(`Drop "${label}"?`)) return;
    setBusy("delete");
    const params = targetKey ? `?target_key=${encodeURIComponent(targetKey)}` : "";
    const res = await fetch(
      `/api/admin/tournaments/${tournamentId}/graphics/${type}${params}`,
      { method: "DELETE" }
    );
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Delete failed");
    }
    router.refresh();
    setBusy(null);
  }

  return (
    <div className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-950 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-white">{label}</p>
        {existing && (
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${
              existing.approved
                ? "bg-emerald-950/60 text-emerald-300"
                : "bg-amber-950/60 text-amber-300"
            }`}
          >
            {existing.approved ? "Approved" : "Draft"}
          </span>
        )}
      </div>
      {existing?.png_url && (
        <a
          href={existing.png_url}
          target="_blank"
          rel="noopener noreferrer"
          className="block overflow-hidden rounded-md border border-zinc-800 bg-black"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={existing.png_url} alt={label} className="block h-auto w-full max-w-xs" />
        </a>
      )}
      {error && (
        <p className="rounded-md border border-red-900/60 bg-red-950/30 px-2 py-1 text-[11px] text-red-300">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={generate}
          disabled={busy !== null}
          className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {busy === "generate" ? "Generating…" : existing ? "Regenerate" : "Generate"}
        </button>
        {existing && (
          <>
            <button
              type="button"
              onClick={toggleApprove}
              disabled={busy !== null}
              className={`rounded-md px-3 py-1 text-xs font-medium disabled:opacity-50 ${
                existing.approved
                  ? "border border-zinc-700 bg-zinc-900 text-zinc-200 hover:border-zinc-600"
                  : "border border-emerald-700 bg-emerald-950/40 text-emerald-200 hover:bg-emerald-950/60"
              }`}
            >
              {busy === "approve"
                ? "…"
                : existing.approved
                  ? "Unapprove"
                  : "Approve"}
            </button>
            <button
              type="button"
              onClick={remove}
              disabled={busy !== null}
              className="rounded-md border border-red-900/60 bg-red-950/30 px-3 py-1 text-xs text-red-300 hover:bg-red-950/50 disabled:opacity-50"
            >
              {busy === "delete" ? "…" : "Delete"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
