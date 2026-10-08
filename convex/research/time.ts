import { ConvexError } from "convex/values";
import { addCivilDays, civilDate, resolveLocalTime } from "../../src/lib/time";
export function validateClock(a: {
  timeZone: string;
  clock: string;
  weekday: number;
}) {
  if (
    a.timeZone.length > 100 ||
    !a.timeZone ||
    /^[+-]/.test(a.timeZone) ||
    /[\u0000-\u0020]/.test(a.timeZone) ||
    !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(a.clock) ||
    !Number.isSafeInteger(a.weekday) ||
    a.weekday < 0 ||
    a.weekday > 6
  )
    throw new ConvexError("RESEARCH_TIME_INVALID");
  try {
    new Intl.DateTimeFormat("en", { timeZone: a.timeZone }).format(0);
  } catch {
    throw new ConvexError("RESEARCH_TIME_INVALID");
  }
}
export function nextOccurrence(
  a: {
    frequency: "manual" | "daily" | "weekly";
    timeZone: string;
    clock: string;
    weekday: number;
  },
  after: number,
): number | null {
  validateClock(a);
  if (!Number.isSafeInteger(after) || after < 0 || after > 8e12)
    throw new ConvexError("RESEARCH_TIME_INVALID");
  if (a.frequency === "manual") return null;
  const first = civilDate(new Date(after).toISOString(), a.timeZone);
  // ponytail: 15 civil days covers a skipped weekly DST occurrence; extend if supporting other recurrences.
  for (let day = 0; day < 15; day++) {
    const date = addCivilDays(first, day);
    if (
      a.frequency === "weekly" &&
      new Date(`${date}T12:00:00Z`).getUTCDay() !== a.weekday
    )
      continue;
    const candidate = resolveLocalTime(`${date}T${a.clock}`, a.timeZone)[0];
    if (candidate && Date.parse(candidate) > after)
      return Date.parse(candidate);
  }
  throw new ConvexError("RESEARCH_TIME_INVALID");
}

// Notifications use their own IANA zone; repeated end clocks use the later instant.
export function quietWindow(
  s: { timezone: string; quiet: { start: string; end: string } | null },
  now: number,
) {
  if (!s.quiet) return { availableAt: now, boundary: null };
  validateClock({ timeZone: s.timezone, clock: s.quiet.start, weekday: 0 });
  validateClock({ timeZone: s.timezone, clock: s.quiet.end, weekday: 0 });
  if (s.quiet.start === s.quiet.end)
    throw new ConvexError("RESEARCH_TIME_INVALID");
  const local = new Intl.DateTimeFormat("en-CA", {
    timeZone: s.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(
    local.formatToParts(now).map((p) => [p.type, p.value]),
  );
  const date = `${parts.year}-${parts.month}-${parts.day}`,
    clock = `${parts.hour}:${parts.minute}`;
  const { start, end } = s.quiet;
  const overnight = start > end;
  const inside = overnight
    ? clock >= start || clock < end
    : clock >= start && clock < end;
  const endDay = overnight && clock >= start ? addCivilDays(date, 1) : date;
  const matches = resolveLocalTime(`${endDay}T${end}`, s.timezone);
  const startDay = overnight && clock < start ? addCivilDays(date, -1) : date;
  const firstStart = resolveLocalTime(`${startDay}T${start}`, s.timezone)[0];
  const repeatedEnd =
    matches.length > 1 &&
    !!firstStart &&
    Date.parse(firstStart) <= now &&
    now < Date.parse(matches.at(-1)!);
  if (inside || repeatedEnd) {
    if (matches.length)
      return { availableAt: Date.parse(matches.at(-1)!), boundary: null };
    // A skipped end resumes at the first real post-quiet minute, preserving seconds precision outside gaps.
    for (
      let at = Math.floor(now / 60000) * 60000 + 60000;
      at <= now + 26 * 3600000;
      at += 60000
    ) {
      const p = Object.fromEntries(
        local.formatToParts(at).map((p) => [p.type, p.value]),
      );
      const c = `${p.hour}:${p.minute}`;
      if (!(overnight ? c >= start || c < end : c >= start && c < end))
        return { availableAt: at, boundary: null };
    }
    throw new ConvexError("RESEARCH_TIME_INVALID");
  }
  // A missing start clock enters quiet at the first real minute after the DST gap.
  if (!resolveLocalTime(`${date}T${start}`, s.timezone).length) {
    for (
      let at = Math.floor(now / 60000) * 60000 + 60000;
      at <= now + 26 * 3600000;
      at += 60000
    ) {
      const p = Object.fromEntries(
        local.formatToParts(at).map((p) => [p.type, p.value]),
      );
      const c = `${p.hour}:${p.minute}`;
      if (overnight ? c >= start || c < end : c >= start && c < end)
        return { availableAt: now, boundary: at };
    }
  }
  for (let day = 0; day < 3; day++) {
    const next = resolveLocalTime(
      `${addCivilDays(date, day)}T${start}`,
      s.timezone,
    )
      .map(Date.parse)
      .find((at) => at > now);
    if (next !== undefined) return { availableAt: now, boundary: next };
  }
  throw new ConvexError("RESEARCH_TIME_INVALID");
}
