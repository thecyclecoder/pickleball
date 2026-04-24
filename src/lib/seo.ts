import type { Tournament } from "./types";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://buentiro.app";

/** Converts a tournament's date + start_time + timezone into a JS Date
 *  representing the intended wall-clock moment in that zone. */
function toZonedDate(date: string, time: string, timezone: string): Date {
  // Parse the local wall clock into a UTC instant using the given IANA zone
  // via Intl. We compute the offset for that wall-clock value, then subtract.
  const [hh = "0", mm = "0"] = time.split(":");
  const iso = `${date}T${hh.padStart(2, "0")}:${mm.padStart(2, "0")}:00`;
  const assumedUtc = new Date(iso + "Z");
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(assumedUtc);
  const get = (k: string) => Number(parts.find((p) => p.type === k)?.value ?? 0);
  const zonedAsUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") === 24 ? 0 : get("hour"),
    get("minute"),
    get("second")
  );
  const offset = zonedAsUtc - assumedUtc.getTime();
  return new Date(assumedUtc.getTime() - offset);
}

function offsetSuffix(timezone: string, at: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    timeZoneName: "shortOffset",
  }).formatToParts(at);
  const name = parts.find((p) => p.type === "timeZoneName")?.value ?? "";
  // e.g. "GMT-4" -> "-04:00"
  const m = name.match(/GMT([+-]?)(\d+)(?::?(\d+))?/i);
  if (!m) return "Z";
  const sign = m[1] === "-" ? "-" : "+";
  const hh = m[2].padStart(2, "0");
  const mm = (m[3] ?? "00").padStart(2, "0");
  return `${sign}${hh}:${mm}`;
}

/** Format a local datetime with its timezone offset, e.g.
 *  2026-05-10T18:00:00-04:00 — what schema.org and ICS consumers expect. */
export function localDateTimeWithOffset(
  date: string,
  time: string,
  timezone: string
): string {
  const d = toZonedDate(date, time, timezone);
  const [hh = "0", mm = "0"] = time.split(":");
  const iso = `${date}T${hh.padStart(2, "0")}:${mm.padStart(2, "0")}:00`;
  return `${iso}${offsetSuffix(timezone, d)}`;
}

export function tournamentCanonicalUrl(slug: string): string {
  return `${SITE_URL}/tournaments/${slug}`;
}

export type SeoImage = { url: string; width?: number; height?: number };

export function buildSportsEventJsonLd(args: {
  tournament: Pick<
    Tournament,
    | "slug"
    | "title"
    | "description"
    | "details"
    | "start_date"
    | "end_date"
    | "start_time"
    | "timezone"
    | "location"
    | "address"
    | "status"
    | "registration_open"
  >;
  workspaceName: string;
  coverImageUrls: string[];
}): Record<string, unknown> {
  const { tournament: t, workspaceName, coverImageUrls } = args;
  const startISO = localDateTimeWithOffset(t.start_date, t.start_time, t.timezone);
  const endISO = t.end_date
    ? localDateTimeWithOffset(t.end_date, "23:59", t.timezone)
    : localDateTimeWithOffset(t.start_date, "23:59", t.timezone);

  const status =
    t.status === "cancelled"
      ? "https://schema.org/EventCancelled"
      : t.status === "completed"
        ? "https://schema.org/EventScheduled"
        : "https://schema.org/EventScheduled";

  return {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: t.title,
    description: t.description || t.details || undefined,
    startDate: startISO,
    endDate: endISO,
    eventStatus: status,
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    sport: "Pickleball",
    url: tournamentCanonicalUrl(t.slug),
    image: coverImageUrls.length ? coverImageUrls : undefined,
    location: {
      "@type": "Place",
      name: t.location,
      address: t.address
        ? {
            "@type": "PostalAddress",
            streetAddress: t.address,
            addressRegion: "PR",
            addressCountry: "PR",
          }
        : {
            "@type": "PostalAddress",
            addressRegion: "PR",
            addressCountry: "PR",
          },
    },
    organizer: {
      "@type": "SportsOrganization",
      name: workspaceName,
      url: SITE_URL,
    },
    offers: t.registration_open
      ? {
          "@type": "Offers",
          availability: "https://schema.org/InStock",
          url: tournamentCanonicalUrl(t.slug),
          validFrom: new Date().toISOString(),
        }
      : undefined,
  };
}
