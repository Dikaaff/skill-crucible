import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";

const pkgRoot = fileURLToPath(new URL("..", import.meta.url));
const bin = path.join(pkgRoot, "bin", "crucible.js");
const fixtures = path.join(pkgRoot, "test", "fixtures");

function run(...args) {
  return spawnSync(process.execPath, [bin, ...args], { encoding: "utf8", cwd: pkgRoot });
}

test("help exits 0 and lists commands", () => {
  const r = run("help");
  assert.equal(r.status, 0);
  assert.match(r.stdout, /crucible check/);
  assert.match(r.stdout, /crucible badge/);
});

test("version exits 0", () => {
  const r = run("version");
  assert.equal(r.status, 0);
  assert.match(r.stdout, /skill-crucible \d+\.\d+\.\d+/);
});

test("unknown option exits 2", () => {
  const r = run("check", "--bogus");
  assert.equal(r.status, 2);
  assert.match(r.stderr, /unknown option/);
});

test("missing path exits 2", () => {
  const r = run("check", "no/such/dir");
  assert.equal(r.status, 2);
});

test("clean skill exits 0 with score 100", () => {
  const r = run("check", path.join(fixtures, "good-skill"));
  assert.equal(r.status, 0, r.stdout);
  assert.match(r.stdout, /score\s+100\/100/);
  assert.match(r.stdout, /no findings/);
});

test("malicious skill exits 1 and reports critical findings", () => {
  const r = run("check", path.join(fixtures, "malicious-skill"), "--format", "json");
  assert.equal(r.status, 1);
  const report = JSON.parse(r.stdout);
  assert.ok(report.score <= 40, `score ${report.score}`);
  assert.equal(report.verdict, "reject");
  assert.ok(report.counts.critical >= 3, JSON.stringify(report.counts));
  const ids = report.findings.map((f) => f.ruleId);
  assert.ok(ids.includes("supply-chain/curl-pipe-shell"));
  assert.ok(ids.includes("hidden-unicode/zero-width"));
});

test("whole fixtures dir scans all three skills", () => {
  const r = run("check", fixtures, "--fail-on", "none");
  assert.equal(r.status, 0);
  const report = JSON.parse(run("check", fixtures, "--format", "json").stdout);
  assert.equal(report.skills.length, 3);
  assert.ok(report.findings.some((f) => f.ruleId === "spec/missing-frontmatter"));
});

test("sarif output writes valid structure", () => {
  const r = run("check", path.join(fixtures, "malicious-skill"), "--format", "sarif");
  assert.equal(r.status, 1);
  const sarif = JSON.parse(r.stdout);
  assert.equal(sarif.version, "2.1.0");
  assert.ok(sarif.runs[0].results.length > 0);
});

test("report file + badge generation flow", () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "crucible-e2e-"));
  try {
    const reportPath = path.join(outDir, "report.json");
    const badgePath = path.join(outDir, "badge.svg");
    run("check", path.join(fixtures, "malicious-skill"), "--format", "json", "-o", reportPath, "--badge", badgePath);
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
    assert.equal(typeof report.score, "number");
    const svg = fs.readFileSync(badgePath, "utf8");
    assert.match(svg, /^<svg /);
    assert.ok(svg.includes(`${report.score} · ${report.grade}`));

    const badgeStdout = run("badge", reportPath);
    assert.equal(badgeStdout.status, 0);
    assert.match(badgeStdout.stdout, /^<svg /);

    const labeled = run("badge", reportPath, "-o", path.join(outDir, "l.svg"), "--label", "my skill");
    assert.equal(labeled.status, 0);
    assert.match(fs.readFileSync(path.join(outDir, "l.svg"), "utf8"), /my skill/);
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});

test("badge without report exits 2", () => {
  const r = run("badge");
  assert.equal(r.status, 2);
});

test("offline mode lists pending package verification", () => {
  const r = run("check", path.join(fixtures, "malicious-skill"));
  assert.match(r.stdout, /not registry-verified/);
});
