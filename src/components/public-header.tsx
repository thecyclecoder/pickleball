import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getLocale, t } from "@/lib/i18n";
import { LanguageSwitcher } from "./language-switcher";
import { Logo } from "./logo";

export async function PublicHeader({ active }: { active?: "tournaments" | "me" | null }) {
  const locale = await getLocale();
  const d = t(locale);
  const user = await getCurrentUser();
  return (
    <header className="border-b border-zinc-900">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6 sm:py-5">
        <Link href="/" aria-label="Buen Tiro" className="text-white">
          <Logo height={28} />
        </Link>
        <nav className="flex items-center gap-3 text-sm text-zinc-400 sm:gap-5">
          <Link
            href="/tournaments"
            className={active === "tournaments" ? "text-white" : "hover:text-white"}
          >
            {d.nav_tournaments}
          </Link>
          {user ? (
            <Link
              href="/me"
              className={active === "me" ? "text-white" : "hover:text-white"}
            >
              {locale === "es" ? "Mi perfil" : "My profile"}
            </Link>
          ) : (
            <Link href="/login" className="hover:text-white">
              {locale === "es" ? "Entrar" : "Sign in"}
            </Link>
          )}
          <LanguageSwitcher current={locale} />
        </nav>
      </div>
    </header>
  );
}
