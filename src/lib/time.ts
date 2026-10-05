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
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  return localInput(d.toISOString(), timeZone);
}
