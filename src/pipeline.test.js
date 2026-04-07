import { describe, it, expect } from "vitest";
import { runPipeline } from "./pipeline.js";

const REPLAY_RUNS = 10;

function replay(intent) {
  const results = Array.from({ length: REPLAY_RUNS }, () => JSON.stringify(runPipeline(intent)));
  return { first: results[0], allIdentical: results.every((r) => r === results[0]) };
}

// ─── TC-R01  summarize-and-format ────────────────────────────────────────────

describe("TC-R01 — summarize-and-format is deterministic", () => {
  it(`produces identical output across ${REPLAY_RUNS} runs`, () => {
    const { allIdentical } = replay({
      actor: "intent-router", action: "task.route",
      context: { task: "summarize-and-format" },
    });
    expect(allIdentical).toBe(true);
  });
});

// ─── TC-R02  evaluate-and-route ──────────────────────────────────────────────

describe("TC-R02 — evaluate-and-route is deterministic", () => {
  it(`produces identical output across ${REPLAY_RUNS} runs`, () => {
    const { allIdentical } = replay({
      actor: "intent-router", action: "task.route",
      context: { task: "evaluate-and-route" },
    });
    expect(allIdentical).toBe(true);
  });
});

// ─── TC-R03  translate-and-summarize ─────────────────────────────────────────

describe("TC-R03 — translate-and-summarize is deterministic", () => {
  it(`produces identical output across ${REPLAY_RUNS} runs`, () => {
    const { allIdentical } = replay({
      actor: "intent-router", action: "task.route",
      context: { task: "translate-and-summarize" },
    });
    expect(allIdentical).toBe(true);
  });
});

// ─── TC-R04  classify-and-format (suspended agent) ───────────────────────────

describe("TC-R04 — classify-and-format (suspended) is deterministic", () => {
  it(`produces identical output across ${REPLAY_RUNS} runs`, () => {
    const { allIdentical, first } = replay({
      actor: "intent-router", action: "task.route",
      context: { task: "classify-and-format" },
    });
    const parsed = JSON.parse(first);
    expect(allIdentical).toBe(true);
    expect(parsed.proposal.constraints.lifecycle_valid).toBe(false);
    expect(parsed.proposal.governance_request).toBeNull();
  });
});

// ─── TC-R05  unknown task ─────────────────────────────────────────────────────

describe("TC-R05 — unknown task is deterministic", () => {
  it(`produces identical output across ${REPLAY_RUNS} runs`, () => {
    const { allIdentical, first } = replay({
      actor: "intent-router", action: "task.route",
      context: { task: "unknown.task" },
    });
    const parsed = JSON.parse(first);
    expect(allIdentical).toBe(true);
    expect(parsed.selection.agents).toEqual([]);
  });
});

// ─── TC-R06  full log shape ───────────────────────────────────────────────────

describe("TC-R06 — runPipeline always returns intent, selection, proposal", () => {
  it("log object contains all three stages", () => {
    const log = runPipeline({
      actor: "intent-router", action: "task.route",
      context: { task: "summarize-and-format" },
    });

    expect(log).toHaveProperty("intent");
    expect(log).toHaveProperty("selection");
    expect(log).toHaveProperty("proposal");
  });
});
