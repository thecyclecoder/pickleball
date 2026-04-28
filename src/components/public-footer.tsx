import Link from "next/link";
import { getLocale, t } from "@/lib/i18n";

export async function PublicFooter() {
  const locale = await getLocale();
  const d = t(locale);
  const labels =
    locale === "es"
      ? { privacy: "Privacidad", terms: "Términos" }
      : { privacy: "Privacy", terms: "Terms" };
  return (
    <footer className="border-t border-zinc-900">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-6 text-xs text-zinc-600">
        <p>© {new Date().getFullYear()} {d.footer}</p>
        <nav className="flex items-center gap-4">
          <Link href="/privacy" className="hover:text-zinc-400">
            {labels.privacy}
          </Link>
          <Link href="/terms" className="hover:text-zinc-400">
            {labels.terms}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
