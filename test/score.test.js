import { test } from "node:test";
import assert from "node:assert/strict";
import { computeScore, worstSeverity, countBySeverity } from "../src/score.js";

const f = (severity) => ({ severity, ruleId: "x/y", message: "m", file: "SKILL.md", line: 1 });

test("clean skill scores 100 / A / ship", () => {
  const s = computeScore([]);
  assert.equal(s.score, 100);
  assert.equal(s.grade, "A");
  assert.equal(s.verdict, "ship");
  assert.equal(s.safetyGate, false);
});

test("deductions lower the score and grade", () => {
  const s = computeScore([f("high"), f("high"), f("medium")]);
  assert.equal(s.score, 100 - 12 - 12 - 5);
  assert.equal(s.grade, "C");
  assert.equal(s.verdict, "revise");
  assert.equal(s.safetyGate, false);
});

test("any critical triggers the safety gate and caps score", () => {
  const s = computeScore([f("critical")]);
  assert.equal(s.safetyGate, true);
  assert.ok(s.score <= 40);
  assert.equal(s.verdict, "reject");
});

test("score never goes below zero", () => {
  const s = computeScore(Array(20).fill(f("critical")));
  assert.equal(s.score, 0);
  assert.equal(s.grade, "F");
});

test("worstSeverity respects fail-on threshold", () => {
  const findings = [f("medium"), f("low")];
  assert.equal(worstSeverity(findings, "high"), false);
  assert.equal(worstSeverity(findings, "medium"), true);
  assert.equal(worstSeverity(findings, "low"), true);
  assert.equal(worstSeverity([f("critical")], "none"), false);
  assert.throws(() => worstSeverity(findings, "bogus"), /invalid --fail-on/);
});

test("countBySeverity counts totals", () => {
  const c = countBySeverity([f("critical"), f("info"), f("info")]);
  assert.equal(c.critical, 1);
  assert.equal(c.info, 2);
  assert.equal(c.total, 3);
});
