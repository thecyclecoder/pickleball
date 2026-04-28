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

/** Format a full lesson timestamp like "Sat, May 2, 2026 · 9:00 AM AST". */
export function formatLessonWhen(startsAt: string | Date, timezone: string): string {
  const d = typeof startsAt === "string" ? new Date(startsAt) : startsAt;
  const date = d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: timezone,
  });
  const time = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: timezone,
  });
  const tzShort = shortTz(timezone);
  return `${date} · ${time}${tzShort ? ` ${tzShort}` : ""}`;
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h} hr${h === 1 ? "" : "s"}`;
  return `${h} hr${h === 1 ? "" : "s"} ${m} min`;
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
