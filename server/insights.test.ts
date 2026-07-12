import { describe, it, expect } from "vitest";
import {
  getPeriodKey,
  getPeriodRange,
  getPeriodLabel,
  getLastCompletedPeriodKey,
} from "./insights";

// Use a fixed reference date: 2026-06-13 is a Saturday in ISO week 24 of 2026.
const REF = new Date(Date.UTC(2026, 5, 13, 9, 0, 0)); // already "SGT-shaped" UTC fields

describe("getPeriodKey", () => {
  it("produces an ISO week key for weekly", () => {
    expect(getPeriodKey("weekly", REF)).toBe("2026-W24");
  });

  it("produces a YYYY-MM key for monthly", () => {
    expect(getPeriodKey("monthly", REF)).toBe("2026-06");
  });

  it("produces a YYYY-Qn key for quarterly", () => {
    expect(getPeriodKey("quarterly", REF)).toBe("2026-Q2");
  });

  it("maps quarter boundaries correctly", () => {
    expect(getPeriodKey("quarterly", new Date(Date.UTC(2026, 0, 15)))).toBe("2026-Q1");
    expect(getPeriodKey("quarterly", new Date(Date.UTC(2026, 8, 30)))).toBe("2026-Q3");
    expect(getPeriodKey("quarterly", new Date(Date.UTC(2026, 11, 31)))).toBe("2026-Q4");
  });
});

describe("getPeriodRange", () => {
  it("weekly range is Monday..Sunday of the ISO week", () => {
    // ISO week 24 of 2026: Mon 2026-06-08 .. Sun 2026-06-14
    expect(getPeriodRange("weekly", "2026-W24")).toEqual({
      start: "2026-06-08",
      end: "2026-06-14",
    });
  });

  it("monthly range covers the full month including the 30th", () => {
    expect(getPeriodRange("monthly", "2026-06")).toEqual({
      start: "2026-06-01",
      end: "2026-06-30",
    });
  });

  it("monthly range handles 31-day months", () => {
    expect(getPeriodRange("monthly", "2026-07")).toEqual({
      start: "2026-07-01",
      end: "2026-07-31",
    });
  });

  it("monthly range handles February in a non-leap year", () => {
    expect(getPeriodRange("monthly", "2026-02")).toEqual({
      start: "2026-02-01",
      end: "2026-02-28",
    });
  });

  it("quarterly range covers three months", () => {
    expect(getPeriodRange("quarterly", "2026-Q2")).toEqual({
      start: "2026-04-01",
      end: "2026-06-30",
    });
    expect(getPeriodRange("quarterly", "2026-Q4")).toEqual({
      start: "2026-10-01",
      end: "2026-12-31",
    });
  });

  it("round-trips: a key's range start/end map back into the same key", () => {
    const range = getPeriodRange("monthly", "2026-06");
    const startKey = getPeriodKey("monthly", new Date(`${range.start}T00:00:00Z`));
    const endKey = getPeriodKey("monthly", new Date(`${range.end}T00:00:00Z`));
    expect(startKey).toBe("2026-06");
    expect(endKey).toBe("2026-06");
  });
});

describe("getPeriodLabel", () => {
  it("labels monthly with full month name", () => {
    expect(getPeriodLabel("monthly", "2026-06")).toBe("June 2026");
  });

  it("labels quarterly with quarter and year", () => {
    expect(getPeriodLabel("quarterly", "2026-Q2")).toBe("Q2 2026");
  });

  it("labels weekly with a human-readable date range (same month)", () => {
    expect(getPeriodLabel("weekly", "2026-W24")).toBe("8–14 Jun 2026");
  });

  it("labels weekly spanning two months", () => {
    // ISO week 27 of 2026: Mon 2026-06-29 .. Sun 2026-07-05
    expect(getPeriodLabel("weekly", "2026-W27")).toBe("29 Jun – 5 Jul 2026");
  });
});

describe("getLastCompletedPeriodKey", () => {
  it("weekly: on Monday returns the previous Mon–Sun week", () => {
    // Mon 2026-06-15 (ISO week 25) → last completed week is week 24 (8–14 Jun)
    const monday = new Date(Date.UTC(2026, 5, 15, 9, 0, 0));
    expect(getLastCompletedPeriodKey("weekly", monday)).toBe("2026-W24");
  });

  it("weekly: mid-week still returns the previous completed week", () => {
    // Thu 2026-06-18 (ISO week 25) → last completed week is week 24
    const thursday = new Date(Date.UTC(2026, 5, 18, 9, 0, 0));
    expect(getLastCompletedPeriodKey("weekly", thursday)).toBe("2026-W24");
  });

  it("weekly: on Sunday returns the CURRENT week (it just ended today)", () => {
    // Sun 2026-06-14 is the LAST day of week 24 → week 24 is now complete
    const sunday = new Date(Date.UTC(2026, 5, 14, 9, 0, 0));
    expect(getLastCompletedPeriodKey("weekly", sunday)).toBe("2026-W24");
  });

  it("weekly: on Sunday 13 Jul returns the current week (7–13 Jul = W28)", () => {
    const sunday = new Date(Date.UTC(2026, 6, 13, 9, 0, 0));
    expect(getLastCompletedPeriodKey("weekly", sunday)).toBe("2026-W28");
  });

  it("monthly: mid-month returns the previous calendar month", () => {
    const jun = new Date(Date.UTC(2026, 5, 15));
    expect(getLastCompletedPeriodKey("monthly", jun)).toBe("2026-05");
  });

  it("monthly: on last day of month returns the current month", () => {
    const jun30 = new Date(Date.UTC(2026, 5, 30));
    expect(getLastCompletedPeriodKey("monthly", jun30)).toBe("2026-06");
  });

  it("monthly: January rolls back to previous December", () => {
    const jan = new Date(Date.UTC(2026, 0, 10));
    expect(getLastCompletedPeriodKey("monthly", jan)).toBe("2025-12");
  });

  it("quarterly: mid-quarter returns the previous quarter", () => {
    const q2 = new Date(Date.UTC(2026, 5, 15)); // in Q2
    expect(getLastCompletedPeriodKey("quarterly", q2)).toBe("2026-Q1");
  });

  it("quarterly: on last day of quarter returns the current quarter", () => {
    const jun30 = new Date(Date.UTC(2026, 5, 30)); // last day of Q2
    expect(getLastCompletedPeriodKey("quarterly", jun30)).toBe("2026-Q2");
  });

  it("quarterly: Q1 rolls back to previous year's Q4", () => {
    const q1 = new Date(Date.UTC(2026, 1, 15)); // Feb, in Q1
    expect(getLastCompletedPeriodKey("quarterly", q1)).toBe("2025-Q4");
  });
});
