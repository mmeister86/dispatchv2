import { expect, test, vi } from "vitest";
import {
  civilDate,
  addCivilDays,
  addCivilMonths,
  calendarWindow,
  formatCivilDate,
  defaultSchedule,
  startOfCivilDay,
} from "../src/lib/time";

test("selected IANA civil dates drive week labels, slots and query range independent of browser timezone", () => {
  const instant = "2026-10-05T23:00:00-07:00";
  const anchor = civilDate(instant, "Europe/Berlin");
  expect(anchor).toBe("2026-10-06");
  expect(civilDate(instant, "America/Los_Angeles")).toBe("2026-10-05");
  const week = calendarWindow(anchor, false, "Europe/Berlin");
  expect(week.days).toEqual([
    "2026-10-05",
    "2026-10-06",
    "2026-10-07",
    "2026-10-08",
    "2026-10-09",
    "2026-10-10",
    "2026-10-11",
  ]);
  expect(week.start).toBe("2026-10-04T22:00:00.000Z");
  expect(week.end).toBe("2026-10-11T22:00:00.000Z");
  expect(civilDate("2026-10-05T07:00:00Z", "Europe/Berlin")).toBe(week.days[0]);
  expect(
    formatCivilDate(week.days[0], { weekday: "long", day: "numeric" }),
  ).toContain("Montag");
});
test("calendar day boundaries survive Havana's missing and overlapping midnight", () => {
  expect(startOfCivilDay("2026-03-08", "America/Havana")).toBe(
    "2026-03-08T05:00:00.000Z",
  );
  expect(startOfCivilDay("2026-11-01", "America/Havana")).toBe(
    "2026-11-01T04:00:00.000Z",
  );
});
test("civil navigation and month grids preserve year rollover and Berlin DST day lengths", () => {
  expect(addCivilDays("2026-12-31", 1)).toBe("2027-01-01");
  expect(addCivilMonths("2026-12-31", 1)).toBe("2027-01-01");
  expect(addCivilMonths("2027-01-31", -1)).toBe("2026-12-01");
  const month = calendarWindow("2027-01-01", true, "Europe/Berlin");
  expect(month.days).toHaveLength(42);
  expect(month.days[0]).toBe("2026-12-28");
  expect(month.days.at(-1)).toBe("2027-02-07");
  const spring = calendarWindow("2026-03-29", false, "Europe/Berlin");
  const autumn = calendarWindow("2026-10-25", false, "Europe/Berlin");
  expect(Date.parse(spring.end!) - Date.parse(spring.start!)).toBe(
    (7 * 24 - 1) * 3600000,
  );
  expect(Date.parse(autumn.end!) - Date.parse(autumn.start!)).toBe(
    (7 * 24 + 1) * 3600000,
  );
});
test("tomorrow default uses preference civil date and 10:00 without altering existing UTC appointments", () => {
  vi.useFakeTimers();
  try {
    vi.setSystemTime(new Date("2026-10-06T06:00:00Z"));
    expect(defaultSchedule("Europe/Berlin")).toBe("2026-10-07T10:00");
    expect(defaultSchedule("America/Los_Angeles")).toBe("2026-10-06T10:00");
    const stored = "2026-10-06T06:00:00Z";
    expect(civilDate(stored, "Europe/Berlin")).toBe("2026-10-06");
    expect(civilDate(stored, "America/Los_Angeles")).toBe("2026-10-05");
    expect(stored).toBe("2026-10-06T06:00:00Z");
  } finally {
    vi.useRealTimers();
  }
});
