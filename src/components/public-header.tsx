import { getCurrentMembership } from "@/lib/auth";
import { getLocale } from "@/lib/i18n";
import { LanguageSwitcher } from "./language-switcher";
import { HomeLink } from "./home-link";
import { PublicMenu } from "./public-menu";

export async function PublicHeader({
  active,
}: {
  active?: "tournaments" | "me" | null;
}) {
  void active; // active highlighting is handled per-page; menu is a dropdown
  const locale = await getLocale();
  const membership = await getCurrentMembership();
  const signedIn = membership.status !== "anon";
  const canAdmin = membership.status === "ok";

  return (
    <header className="border-b border-zinc-900">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6 sm:py-5">
        <HomeLink height={28} />
        <div className="flex items-center gap-2 sm:gap-3">
          <LanguageSwitcher current={locale} />
          <PublicMenu locale={locale} signedIn={signedIn} canAdmin={canAdmin} />
        </div>
      </div>
    </header>
  );
}
