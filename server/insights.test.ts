import { describe, it, expect } from "vitest";
import { getPeriodKey, getPeriodRange, getPeriodLabel } from "./insights";

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

  it("labels weekly with the date range", () => {
    expect(getPeriodLabel("weekly", "2026-W24")).toBe("2026-06-08 → 2026-06-14");
  });
});
