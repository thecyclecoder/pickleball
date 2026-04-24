import Link from "next/link";
import { getLocale, t } from "@/lib/i18n";
import { LanguageSwitcher } from "./language-switcher";

export async function PublicHeader({ active }: { active?: "tournaments" | null }) {
  const locale = await getLocale();
  const d = t(locale);
  return (
    <header className="border-b border-zinc-900">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <Link href="/" className="text-lg font-semibold tracking-tight text-white">
          {d.siteName}
        </Link>
        <nav className="flex items-center gap-5 text-sm text-zinc-400">
          <Link
            href="/tournaments"
            className={active === "tournaments" ? "text-white" : "hover:text-white"}
          >
            {d.nav_tournaments}
          </Link>
          <Link href="/login" className="hover:text-white">{d.nav_admin}</Link>
          <LanguageSwitcher current={locale} />
        </nav>
      </div>
    </header>
  );
}
