/** Resolve wall-clock inputs explicitly; DST gaps have no match, overlaps have two. */
export function resolveLocalTime(value: string, timeZone: string): string[] {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!m) return [];
  const [, year, month, day, hour, minute] = m.map(Number);
  const approximate = Date.UTC(year, month - 1, day, hour, minute);
  const format = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const matches: string[] = [];
  for (let offset = -14 * 60; offset <= 14 * 60; offset += 15) {
    const date = new Date(approximate + offset * 60000);
    const parts = Object.fromEntries(
      format.formatToParts(date).map((p) => [p.type, p.value]),
    );
    if (
      `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}` ===
      value
    )
      matches.push(date.toISOString());
  }
  return matches;
}
export function localInput(value: string, timeZone: string): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(value))
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}
export function defaultSchedule(timeZone: string) {
  return `${addCivilDays(civilDate(new Date().toISOString(), timeZone), 1)}T10:00`;
}

/** Civil dates are labels in a selected zone, never browser-local instants. */
export function civilDate(instant: string, timeZone: string): string {
  return localInput(instant, timeZone).slice(0, 10);
}
export function addCivilDays(value: string, days: number): string {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
export function addCivilMonths(value: string, months: number): string {
  const date = new Date(`${value}T12:00:00Z`);
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1),
  )
    .toISOString()
    .slice(0, 10);
}
export function formatCivilDate(
  value: string,
  options: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat("de-DE", {
    ...options,
    timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00Z`));
}
// Calendar boundaries use the earliest valid clock time, including an overlapping midnight.
// User-selected publishing times still require explicit overlap resolution via resolveLocalTime.
export function startOfCivilDay(day: string, timeZone: string): string | null {
  for (let minute = 0; minute < 1440; minute += 15) {
    const clock = `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
    const instant = resolveLocalTime(`${day}T${clock}`, timeZone)[0];
    if (instant) return instant;
  }
  return null;
}
export function calendarWindow(
  anchor: string,
  month: boolean,
  timeZone: string,
) {
  const first = month ? `${anchor.slice(0, 7)}-01` : anchor;
  const weekday = new Date(`${first}T12:00:00Z`).getUTCDay();
  const monday = addCivilDays(first, -((weekday + 6) % 7));
  const days = Array.from({ length: month ? 42 : 7 }, (_, i) =>
    addCivilDays(monday, i),
  );
  return {
    days,
    start: startOfCivilDay(days[0], timeZone),
    end: startOfCivilDay(addCivilDays(days.at(-1)!, 1), timeZone),
  };
}
