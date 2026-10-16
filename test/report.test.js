import { test } from "node:test";
import assert from "node:assert/strict";
import { badgeForScore, badgeColor } from "../src/report/badge.js";
import { toSarif } from "../src/report/sarif.js";
import { toJsonReport } from "../src/report/json.js";
import { renderText } from "../src/report/text.js";

const findings = [
  {
    ruleId: "prompt-override/ignore-instructions",
    severity: "critical",
    category: "prompt-injection",
    message: 'Instruction-override phrasing — matched: "Ignore all previous instructions"',
    file: "skills/foo/SKILL.md",
    line: 7,
  },
  {
    ruleId: "spec/description-too-short",
    severity: "medium",
    category: "structure",
    message: "description is only 5 chars",
    file: "skills/foo/SKILL.md",
    line: 3,
  },
];

const units = [
  { name: "foo", main: "skills/foo/SKILL.md", findings, score: 40, grade: "F", verdict: "reject" },
];
const overall = { score: 40, grade: "F", verdict: "reject", safetyGate: true };

test("badge renders shields-style svg with score and grade", () => {
  const svg = badgeForScore(87, "B");
  assert.match(svg, /^<svg /);
  assert.match(svg, /87 · B/);
  assert.match(svg, /skill crucible/);
  assert.match(svg, /fill="#97ca00"/);
});

test("badge colors follow score bands", () => {
  assert.equal(badgeColor(95), "#4c1");
  assert.equal(badgeColor(85), "#97ca00");
  assert.equal(badgeColor(75), "#dfb317");
  assert.equal(badgeColor(65), "#fe7d37");
  assert.equal(badgeColor(30), "#e05d44");
});

test("badge escapes xml specials", () => {
  const svg = badgeForScore(50, "D", { label: "a<b>&c" });
  assert.match(svg, /a&lt;b&gt;&amp;c/);
});

test("sarif output is 2.1.0 with mapped levels", () => {
  const sarif = toSarif({ toolVersion: "0.1.0", findings });
  assert.equal(sarif.version, "2.1.0");
  assert.equal(sarif.runs.length, 1);
  const run = sarif.runs[0];
  assert.equal(run.tool.driver.name, "skill-crucible");
  assert.equal(run.results.length, 2);
  assert.equal(run.results[0].level, "error");
  assert.equal(run.results[1].level, "warning");
  assert.equal(run.results[0].locations[0].physicalLocation.region.startLine, 7);
  assert.ok(run.tool.driver.rules.length >= 1);
});

test("json report carries score, counts, and findings", () => {
  const report = toJsonReport({
    toolVersion: "0.1.0",
    inputs: ["skills"],
    units,
    findings,
    overall,
    online: false,
  });
  assert.equal(report.tool.name, "skill-crucible");
  assert.equal(report.score, 40);
  assert.equal(report.grade, "F");
  assert.equal(report.mode, "offline");
  assert.equal(report.counts.critical, 1);
  assert.equal(report.counts.medium, 1);
  assert.equal(report.findings[0].file, "skills/foo/SKILL.md");
  assert.equal(report.skills[0].skill, "foo");
});

test("text report is color-free when color disabled and shows rules", () => {
  const out = renderText({
    toolVersion: "0.1.0",
    units,
    findings,
    overall,
    online: false,
    color: false,
  });
  assert.ok(!out.includes("\x1b["), "no ANSI escapes expected");
  assert.match(out, /prompt-override\/ignore-instructions/);
  assert.match(out, /REJECT/);
  assert.match(out, /1 critical/);
  assert.match(out, /--online/);
});

test("text report uses ANSI when color enabled", () => {
  const out = renderText({
    toolVersion: "0.1.0",
    units,
    findings,
    overall,
    online: true,
    color: true,
  });
  assert.ok(out.includes("\x1b["));
});
