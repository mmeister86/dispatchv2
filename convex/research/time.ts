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
