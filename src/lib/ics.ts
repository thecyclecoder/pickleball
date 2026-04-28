/**
 * ICS (RFC 5545) generation for lesson calendar events + Google Calendar
 * deep-link helper.
 *
 * Both produce the same end result — the event lands on the recipient's
 * calendar — but cover different surface areas:
 *   • ICS file: universal. Works for Apple Calendar, Outlook, etc., and
 *     can be subscribed to as a feed if we ever expose one. Sent as an
 *     attachment-equivalent link in lesson emails so the player taps to
 *     add it.
 *   • Google Calendar URL: fastest path on Chrome/Android since it
 *     pre-fills the event in Google Calendar UI directly. Rendered as a
 *     primary CTA button.
 */

export type CalendarEvent = {
  uid: string;
  startsAt: Date | string;
  durationMinutes: number;
  summary: string;
  description?: string;
  location?: string;
  status?: "scheduled" | "cancelled" | "completed" | "no_show";
};

export function generateIcs(event: CalendarEvent): string {
  const start = new Date(event.startsAt);
  const end = new Date(start.getTime() + event.durationMinutes * 60_000);
  const status = event.status === "cancelled" ? "CANCELLED" : "CONFIRMED";

  // ICS spec requires CRLF line endings and lines folded at 75 octets.
  // We skip strict folding (modern calendar clients are lenient) but do
  // join with CRLF and escape the few characters the spec cares about.
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Buen Tiro//Lessons//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `DTSTAMP:${formatIcsUtc(new Date())}`,
    `DTSTART:${formatIcsUtc(start)}`,
    `DTEND:${formatIcsUtc(end)}`,
    `SUMMARY:${escapeIcs(event.summary)}`,
    event.location ? `LOCATION:${escapeIcs(event.location)}` : null,
    event.description ? `DESCRIPTION:${escapeIcs(event.description)}` : null,
    `STATUS:${status}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter((l): l is string => l !== null);

  return lines.join("\r\n");
}

/** Build a calendar.google.com new-event URL with the event pre-filled. */
export function googleCalendarUrl(event: CalendarEvent): string {
  const start = new Date(event.startsAt);
  const end = new Date(start.getTime() + event.durationMinutes * 60_000);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.summary,
    dates: `${formatGoogleUtc(start)}/${formatGoogleUtc(end)}`,
  });
  if (event.location) params.set("location", event.location);
  if (event.description) params.set("details", event.description);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** Outlook web compose URL — alternative for Outlook users. */
export function outlookCalendarUrl(event: CalendarEvent): string {
  const start = new Date(event.startsAt);
  const end = new Date(start.getTime() + event.durationMinutes * 60_000);
  const params = new URLSearchParams({
    rru: "addevent",
    subject: event.summary,
    startdt: start.toISOString(),
    enddt: end.toISOString(),
  });
  if (event.location) params.set("location", event.location);
  if (event.description) params.set("body", event.description);
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}

function formatIcsUtc(d: Date): string {
  // YYYYMMDDTHHMMSSZ — UTC, no separators, trailing Z.
  return d
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

function formatGoogleUtc(d: Date): string {
  // Google's `dates` param uses the same compact UTC form as ICS.
  return formatIcsUtc(d);
}

function escapeIcs(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}
