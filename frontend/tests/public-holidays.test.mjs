import assert from "node:assert/strict";
import test from "node:test";
import { badenWuerttembergHoliday, scheduledPublicHolidays } from "../app/dashboard/assignments/public-holidays.ts";

test("all twelve BW public holidays in 2026, including Easter-based dates", () => {
  const expected = {
    "2026-01-01": "Neujahr", "2026-01-06": "Heilige Drei Könige",
    "2026-04-03": "Karfreitag", "2026-04-06": "Ostermontag",
    "2026-05-01": "Tag der Arbeit", "2026-05-14": "Christi Himmelfahrt",
    "2026-05-25": "Pfingstmontag", "2026-06-04": "Fronleichnam",
    "2026-10-03": "Tag der Deutschen Einheit", "2026-11-01": "Allerheiligen",
    "2026-12-25": "1. Weihnachtsfeiertag", "2026-12-26": "2. Weihnachtsfeiertag",
  };
  for (const [date, name] of Object.entries(expected)) assert.equal(badenWuerttembergHoliday(date), name);
  assert.equal(badenWuerttembergHoliday("2026-10-31"), undefined); // school holiday, not a public holiday
  assert.equal(badenWuerttembergHoliday("2026-12-24"), undefined);
  assert.equal(badenWuerttembergHoliday("2026-02-30"), undefined);
  assert.equal(badenWuerttembergHoliday("invalid"), undefined);
});

test("movable dates recalculate by year, including leap years", () => {
  assert.equal(badenWuerttembergHoliday("2027-03-26"), "Karfreitag");
  assert.equal(badenWuerttembergHoliday("2028-04-17"), "Ostermontag");
  assert.equal(badenWuerttembergHoliday("2030-06-20"), "Fronleichnam");
});

test("recurrence warnings only include actual generated weekdays and intervals", () => {
  assert.deepEqual(scheduledPublicHolidays({ date: "2026-12-18", frequency: "WEEKLY", weekdays: [5], until: "2027-01-08" }).map((item) => item.date), ["2026-12-25", "2027-01-01"]);
  assert.deepEqual(scheduledPublicHolidays({ date: "2026-12-18", frequency: "WEEKLY", interval: 2, weekdays: [5], until: "2027-01-08" }).map((item) => item.date), ["2027-01-01"]);
  assert.deepEqual(scheduledPublicHolidays({ date: "2026-12-18", frequency: "WEEKLY", weekdays: [4], until: "2027-01-08" }), []);
  assert.deepEqual(scheduledPublicHolidays({ date: "2026-04-01", frequency: "DAILY", until: "2026-04-07" }).map((item) => item.date), ["2026-04-03", "2026-04-06"]);
  assert.deepEqual(scheduledPublicHolidays({ date: "2026-03-01", frequency: "MONTHLY", until: "2026-06-01" }).map((item) => item.date), ["2026-05-01"]);
});

test("single-date warnings, invalid ranges, and a bounded long recurrence", () => {
  assert.equal(scheduledPublicHolidays({ date: "2026-12-25" })[0].name, "1. Weihnachtsfeiertag");
  assert.deepEqual(scheduledPublicHolidays({ date: "2026-12-25", frequency: "DAILY", until: "2026-01-01" }), []);
  assert.deepEqual(scheduledPublicHolidays({ date: "bad" }), []);
  const dates = scheduledPublicHolidays({ date: "2026-01-01", frequency: "DAILY", until: "2099-12-31" });
  assert.ok(dates.every((item) => item.date < "2028-01-01"));
});
