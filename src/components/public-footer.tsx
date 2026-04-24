import Link from "next/link";
import { getLocale, t } from "@/lib/i18n";

export async function PublicFooter() {
  const locale = await getLocale();
  const d = t(locale);
  return (
    <footer className="border-t border-zinc-900">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-6 text-xs text-zinc-600">
        <p>© {new Date().getFullYear()} {d.footer}</p>
        <Link href="/admin" className="text-zinc-600 hover:text-zinc-400">
          {d.nav_admin}
        </Link>
      </div>
    </footer>
  );
}
