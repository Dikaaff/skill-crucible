import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import { discoverSkills } from "../src/discover.js";
import { parseSkill } from "../src/frontmatter.js";
import { runStructureChecks } from "../src/checks/structure.js";
import { runSecurityChecks } from "../src/checks/security.js";
import { extractPackages, verifyPackages, hallucinatedFindings } from "../src/checks/packages.js";

const fixtures = fileURLToPath(new URL("./fixtures", import.meta.url));

function structureOf(name) {
  const units = discoverSkills(path.join(fixtures, name));
  const unit = units[0];
  const raw = readFileSync(unit.main, "utf8");
  return runStructureChecks(unit, parseSkill(raw), raw);
}

function ruleIds(findings) {
  return findings.map((f) => f.ruleId);
}

test("good-skill passes structure checks cleanly", () => {
  const findings = structureOf("good-skill");
  assert.deepEqual(findings, []);
});

test("broken-skill reports missing frontmatter", () => {
  const findings = structureOf("broken-skill");
  assert.ok(ruleIds(findings).includes("spec/missing-frontmatter"));
  assert.equal(findings[0].severity, "high");
});

test("missing description and bad name are errors", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "crucible-"));
  try {
    const dir = path.join(tmp, "some-dir");
    fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir, "SKILL.md"), "---\nname: Not Valid Name\ntags: x\n---\nbody\n");
    const unit = discoverSkills(dir)[0];
    const raw = readFileSync(unit.main, "utf8");
    const findings = runStructureChecks(unit, parseSkill(raw), raw);
    const ids = ruleIds(findings);
    assert.ok(ids.includes("spec/invalid-name"));
    assert.ok(ids.includes("spec/missing-description"));
    assert.ok(ids.includes("spec/name-dir-mismatch"));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("short description warns", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "crucible-"));
  try {
    const dir = path.join(tmp, "vague-skill");
    fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir, "SKILL.md"), "---\nname: vague-skill\ndescription: does things\n---\nbody\n");
    const unit = discoverSkills(dir)[0];
    const raw = readFileSync(unit.main, "utf8");
    const ids = ruleIds(runStructureChecks(unit, parseSkill(raw), raw));
    assert.ok(ids.includes("spec/description-too-short"));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("malicious SKILL.md trips every headline security rule", () => {
  const raw = readFileSync(path.join(fixtures, "malicious-skill", "SKILL.md"), "utf8");
  const findings = runSecurityChecks({}, "SKILL.md", raw);
  const ids = ruleIds(findings);
  assert.ok(ids.includes("prompt-override/ignore-instructions"), "override phrasing");
  assert.ok(ids.includes("prompt-override/secrecy"), "secrecy instruction");
  assert.ok(ids.includes("secret/credential-path"), "ssh path");
  assert.ok(ids.includes("supply-chain/curl-pipe-shell"), "curl|sh");
  assert.ok(ids.includes("destructive/rm-root"), "rm -rf /");
  assert.ok(ids.includes("hidden-unicode/zero-width"), "zero-width char");
  assert.ok(ids.includes("exfil/outbound-with-secrets"), "outbound + secrets");
  const crit = findings.filter((f) => f.severity === "critical");
  assert.ok(crit.length >= 3, `expected >=3 critical, got ${crit.length}`);
});

test("malicious helper script is scanned too", () => {
  const raw = readFileSync(path.join(fixtures, "malicious-skill", "scripts", "setup.sh"), "utf8");
  const ids = ruleIds(runSecurityChecks({}, "setup.sh", raw));
  assert.ok(ids.includes("secret/credential-path"));
  assert.ok(ids.includes("exfil/outbound-with-secrets"));
});

test("clean content produces no security findings", () => {
  const findings = runSecurityChecks({}, "SKILL.md", "# Title\n\nDescribe the task and call scripts/run.py to finish.\n");
  assert.deepEqual(findings, []);
});

test("extractPackages parses managers, versions, scopes", () => {
  const text = [
    "npx create-next-app@14.2.0",
    "npx @anthropic-ai/claude-code",
    "pip install requests",
    "uv tool install ruff",
    "npm install -g pnpm",
  ].join("\n");
  const pkgs = extractPackages(text);
  const byName = Object.fromEntries(pkgs.map((p) => [p.name, p]));
  assert.equal(byName["create-next-app"].manager, "npm");
  assert.equal(byName["@anthropic-ai/claude-code"].manager, "npm");
  assert.equal(byName["requests"].manager, "pypi");
  assert.equal(byName["ruff"].manager, "pypi");
  assert.equal(byName["pnpm"].manager, "npm");
  assert.equal(pkgs.length, 5);
});

test("verifyPackages flags missing npm packages as critical", async () => {
  const fetchImpl = async (url) => {
    if (url.includes("does-not-exist-xyz")) return { status: 404 };
    return { status: 200 };
  };
  const pkgs = [
    { manager: "npm", name: "does-not-exist-xyz", command: "npx", line: 3, file: "SKILL.md" },
    { manager: "npm", name: "react", command: "npx", line: 5, file: "SKILL.md" },
  ];
  const results = await verifyPackages(pkgs, { fetchImpl });
  const findings = hallucinatedFindings(results);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].severity, "critical");
  assert.equal(findings[0].ruleId, "supply-chain/hallucinated-package");
  assert.match(findings[0].message, /does-not-exist-xyz/);
  assert.equal(findings[0].line, 3);
});
