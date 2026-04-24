"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { Locale } from "@/lib/i18n";

export function LanguageSwitcher({ current }: { current: Locale }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState<Locale>(current);

  function set(next: Locale) {
    if (next === value || pending) return;
    setValue(next);
    startTransition(async () => {
      await fetch("/api/locale", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ locale: next }),
      });
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-0.5 rounded-md border border-zinc-800 bg-zinc-900 p-0.5 text-xs">
      {(["en", "es"] as Locale[]).map((loc) => (
        <button
          key={loc}
          type="button"
          onClick={() => set(loc)}
          className={`rounded px-2 py-1 font-medium uppercase transition-colors ${
            value === loc ? "bg-emerald-600 text-white" : "text-zinc-400 hover:text-white"
          }`}
          aria-pressed={value === loc}
        >
          {loc}
        </button>
      ))}
    </div>
  );
}
