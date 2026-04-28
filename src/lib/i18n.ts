import { cookies, headers } from "next/headers";

export const LOCALES = ["en", "es"] as const;
export type Locale = (typeof LOCALES)[number];
export const LOCALE_COOKIE = "locale";
export const DEFAULT_LOCALE: Locale = "en";

export async function getLocale(): Promise<Locale> {
  // Explicit user choice (set by the LanguageSwitcher) always wins.
  const store = await cookies();
  const v = store.get(LOCALE_COOKIE)?.value;
  if (v === "es" || v === "en") return v;

  // No cookie yet → sniff the browser's Accept-Language header. This is
  // intentionally browser-preference-based, not geolocation-based, since a
  // PR resident might prefer English (and a tourist in PR might prefer
  // Spanish) — the OS language setting reflects what they want to read.
  const h = await headers();
  const accept = h.get("accept-language") ?? "";
  return prefersSpanish(accept) ? "es" : "en";
}

/** Parse an Accept-Language header and return true if Spanish ranks
 *  higher than English (or English isn't there at all). */
function prefersSpanish(acceptLanguage: string): boolean {
  const items = acceptLanguage
    .split(",")
    .map((s) => {
      const [code, qStr] = s.trim().split(";q=");
      const q = qStr ? parseFloat(qStr) : 1.0;
      return { lang: code.toLowerCase(), q: Number.isFinite(q) ? q : 1.0 };
    })
    .filter((x) => x.lang)
    .sort((a, b) => b.q - a.q);

  for (const item of items) {
    if (item.lang.startsWith("es")) return true;
    if (item.lang.startsWith("en")) return false;
  }
  return false;
}

export function pick<T extends string | null | undefined>(en: T, es: T, locale: Locale): T {
  if (locale === "es" && es && String(es).trim()) return es;
  return en;
}

// All dict entries are plain strings so the dict can be serialized across
// the server/client boundary (React forbids passing functions to client
// components). Dynamic strings live in exported helper functions below.
const UI = {
  en: {
    siteName: "Buen Tiro",
    nav_tournaments: "Tournaments",
    nav_admin: "Admin",
    hero_kicker: "Puerto Rico Pickleball",
    hero_title: "Find your next tournament.",
    hero_desc:
      "Tournaments, clinics, and private lessons across Puerto Rico — sign up in a tap, get reminders, and track every match on your profile.",
    hero_cta: "View tournaments",
    upcoming: "Upcoming",
    see_all: "See all →",
    page_tournaments_title: "Tournaments",
    page_tournaments_desc: "Upcoming pickleball tournaments in Puerto Rico.",
    no_tournaments: "No tournaments listed yet. Check back soon.",
    no_flyer: "No flyer",
    waitlist_only: "Waitlist only",
    registration_closed: "Registration closed",
    back_to_list: "← All tournaments",
    label_date: "Date",
    label_start_time: "Start time",
    label_location: "Location",
    label_registration: "Registration",
    registration_open: "Open",
    directions: "Get directions →",
    section_details: "Details",
    section_categories: "Categories",
    waitlist_suffix: "· waitlist",
    no_categories: "No categories yet.",
    section_register: "Register your team",
    section_registered_teams: "Registered teams",
    no_teams_yet: "No teams registered yet.",
    form_category: "Category",
    form_waitlist_only: "— waitlist only",
    form_player1: "Player 1 (Captain)",
    form_player2: "Player 2",
    form_first_name: "First name",
    form_last_name: "Last name",
    form_email: "Email",
    form_rating: "Rating",
    form_rating_placeholder: "Select…",
    form_submit_register: "Register team",
    form_submit_waitlist: "Join waitlist",
    form_submitting: "Submitting…",
    payment_info: "Payment info",
    success_registered_title: "Team registered!",
    success_registered_desc: "Your team is registered. Complete payment below to confirm your spot.",
    success_waitlisted_title: "You're on the waitlist!",
    success_waitlisted_desc:
      "The category was full, so your team is on the waitlist. We'll reach out if a spot opens.",
    register_another: "Register another team",
    footer: "Buen Tiro",
  },
  es: {
    siteName: "Buen Tiro",
    nav_tournaments: "Torneos",
    nav_admin: "Admin",
    hero_kicker: "Pickleball de Puerto Rico",
    hero_title: "Encuentra tu próximo torneo.",
    hero_desc:
      "Torneos, clínicas y lecciones privadas en todo Puerto Rico — inscríbete en un toque, recibe recordatorios y guarda cada partido en tu perfil.",
    hero_cta: "Ver torneos",
    upcoming: "Próximos",
    see_all: "Ver todos →",
    page_tournaments_title: "Torneos",
    page_tournaments_desc: "Próximos torneos de pickleball en Puerto Rico.",
    no_tournaments: "Aún no hay torneos publicados. Vuelve pronto.",
    no_flyer: "Sin flyer",
    waitlist_only: "Solo lista de espera",
    registration_closed: "Inscripción cerrada",
    back_to_list: "← Todos los torneos",
    label_date: "Fecha",
    label_start_time: "Hora de inicio",
    label_location: "Lugar",
    label_registration: "Inscripción",
    registration_open: "Abierta",
    directions: "Cómo llegar →",
    section_details: "Detalles",
    section_categories: "Categorías",
    waitlist_suffix: "· lista de espera",
    no_categories: "Aún no hay categorías.",
    section_register: "Inscribe tu equipo",
    section_registered_teams: "Equipos inscritos",
    no_teams_yet: "Aún no hay equipos inscritos.",
    form_category: "Categoría",
    form_waitlist_only: "— solo lista de espera",
    form_player1: "Jugador 1 (Capitán)",
    form_player2: "Jugador 2",
    form_first_name: "Nombre",
    form_last_name: "Apellido",
    form_email: "Correo",
    form_rating: "Nivel",
    form_rating_placeholder: "Selecciona…",
    form_submit_register: "Inscribir equipo",
    form_submit_waitlist: "Unirme a lista de espera",
    form_submitting: "Enviando…",
    payment_info: "Información de pago",
    success_registered_title: "¡Equipo inscrito!",
    success_registered_desc:
      "Tu equipo está inscrito. Completa el pago abajo para confirmar tu cupo.",
    success_waitlisted_title: "¡Estás en la lista de espera!",
    success_waitlisted_desc:
      "La categoría estaba llena, por lo que tu equipo está en la lista de espera. Te avisaremos si se abre un cupo.",
    register_another: "Inscribir otro equipo",
    footer: "Buen Tiro",
  },
} as const;

export type Dict = (typeof UI)[Locale];

export function t(locale: Locale): Dict {
  return UI[locale];
}

// Dynamic string formatters — safe to call from both server and client code.
export function formatSpotsOpen(locale: Locale, n: number): string {
  if (locale === "es") {
    return `${n} espacio${n === 1 ? "" : "s"} disponible${n === 1 ? "" : "s"}`;
  }
  return `${n} team spot${n === 1 ? "" : "s"} open`;
}

export function formatTeamsOf(locale: Locale, a: number, b: number): string {
  return locale === "es" ? `${a} / ${b} equipos` : `${a} / ${b} teams`;
}

export function formatSpotsLeft(locale: Locale, n: number): string {
  if (locale === "es") {
    return `(${n} espacio${n === 1 ? "" : "s"} disponible${n === 1 ? "" : "s"})`;
  }
  return `(${n} spot${n === 1 ? "" : "s"} left)`;
}

const CATEGORY_TYPE_ES: Record<"MD" | "WD" | "MXD", string> = {
  MD: "Dobles Masculino",
  WD: "Dobles Femenino",
  MXD: "Dobles Mixto",
};
const CATEGORY_TYPE_EN: Record<"MD" | "WD" | "MXD", string> = {
  MD: "Men's Doubles",
  WD: "Women's Doubles",
  MXD: "Mixed Doubles",
};

export function categoryLabelI18n(
  category: { type: "MD" | "WD" | "MXD"; rating: string; label: string | null; label_es?: string | null },
  locale: Locale
): string {
  if (locale === "es" && category.label_es && category.label_es.trim()) return category.label_es;
  if (category.label && category.label.trim()) return category.label;
  const base = locale === "es" ? CATEGORY_TYPE_ES[category.type] : CATEGORY_TYPE_EN[category.type];
  const rating =
    category.rating === "open" ? (locale === "es" ? "Abierto" : "Open") : category.rating;
  return `${base} ${rating}`;
}
