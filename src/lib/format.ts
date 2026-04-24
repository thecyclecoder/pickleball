export function formatTournamentDate(start: string, end: string | null, timezone: string): string {
  const opts: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: timezone,
  };
  const startDate = new Date(`${start}T12:00:00Z`);
  const startStr = startDate.toLocaleDateString("en-US", opts);
  if (!end || end === start) return startStr;
  const endDate = new Date(`${end}T12:00:00Z`);
  const endStr = endDate.toLocaleDateString("en-US", opts);
  return `${startStr} – ${endStr}`;
}

export function formatTime(time: string, timezone: string): string {
  // time is "HH:MM:SS" or "HH:MM"
  const [h, m] = time.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m ?? 0, 0, 0);
  const base = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const tzShort = shortTz(timezone);
  return tzShort ? `${base} ${tzShort}` : base;
}

function shortTz(tz: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "short",
    }).formatToParts(new Date());
    return parts.find((p) => p.type === "timeZoneName")?.value ?? "";
  } catch {
    return "";
  }
}
