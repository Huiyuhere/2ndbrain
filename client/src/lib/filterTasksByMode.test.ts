import { describe, it, expect } from "vitest";
import { filterTasksByMode, Task } from "./store";

function makeTask(id: string, categoryId: string): Task {
  return { id, title: id, categoryId, column: "today", createdAt: "2026-06-01" };
}

const tasks: Task[] = [
  makeTask("w1", "work"),
  makeTask("p1", "planning"),
  makeTask("t1", "research"), // "Type" category (renamed from research)
  makeTask("t2", "type"),
  makeTask("per1", "personal"),
  makeTask("i1", "ideas"),
  makeTask("e1", "exercise"),
  makeTask("c1", "cat_custom"), // a custom category
];

describe("filterTasksByMode", () => {
  it("life shows all tasks", () => {
    expect(filterTasksByMode(tasks, "life")).toHaveLength(tasks.length);
  });

  it("work shows only work + planning", () => {
    const ids = filterTasksByMode(tasks, "work").map(t => t.id).sort();
    expect(ids).toEqual(["p1", "w1"]);
  });

  it("type shows only the Type category (research or type ids)", () => {
    const ids = filterTasksByMode(tasks, "type").map(t => t.id).sort();
    expect(ids).toEqual(["t1", "t2"]);
  });

  it("personal is the catch-all: everything not work and not type", () => {
    const ids = filterTasksByMode(tasks, "personal").map(t => t.id).sort();
    expect(ids).toEqual(["c1", "e1", "i1", "per1"]);
  });

  it("work, type, and personal partition every task exactly once", () => {
    const work = filterTasksByMode(tasks, "work");
    const type = filterTasksByMode(tasks, "type");
    const personal = filterTasksByMode(tasks, "personal");
    expect(work.length + type.length + personal.length).toBe(tasks.length);
    const allIds = [...work, ...type, ...personal].map(t => t.id).sort();
    expect(allIds).toEqual(tasks.map(t => t.id).sort());
  });
});
