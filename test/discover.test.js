import { test } from "node:test";
import assert from "node:assert/strict";
import { discoverSkills, isScannable, readTextFile } from "../src/discover.js";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";

const fixtures = fileURLToPath(new URL("./fixtures", import.meta.url));

test("discovers all skills under a directory", () => {
  const units = discoverSkills(fixtures);
  const names = units.map((u) => u.name).sort();
  assert.deepEqual(names, ["broken-skill", "good-skill", "malicious-skill"]);
});

test("unit carries main file and support files", () => {
  const units = discoverSkills(fixtures);
  const good = units.find((u) => u.name === "good-skill");
  assert.equal(path.basename(good.main), "SKILL.md");
  assert.ok(good.files.some((f) => f.endsWith(path.join("scripts", "greet.py"))));
});

test("single file input returns one unit", () => {
  const units = discoverSkills(path.join(fixtures, "good-skill", "SKILL.md"));
  assert.equal(units.length, 1);
  assert.equal(units[0].name, "good-skill");
});

test("throws on missing path", () => {
  assert.throws(() => discoverSkills(path.join(fixtures, "does-not-exist")), /path not found/);
});

test("isScannable allowlist", () => {
  assert.equal(isScannable("a/b/SKILL.md"), true);
  assert.equal(isScannable("script.py"), true);
  assert.equal(isScannable("image.png"), false);
  assert.equal(isScannable("archive.zip"), false);
  assert.equal(isScannable("Makefile"), true);
});

test("readTextFile rejects binary content", () => {
  const tmp = path.join(os.tmpdir(), `crucible-bin-${process.pid}.dat`);
  fs.writeFileSync(tmp, Buffer.from([0x89, 0x50, 0x00, 0x01, 0x02]));
  try {
    assert.equal(readTextFile(tmp), null);
  } finally {
    fs.rmSync(tmp, { force: true });
  }
});
