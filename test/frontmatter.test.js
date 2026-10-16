import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSkill, findKeyLine, lineOfIndex } from "../src/frontmatter.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const good = readFileSync(fileURLToPath(new URL("./fixtures/good-skill/SKILL.md", import.meta.url)), "utf8");

test("parses valid frontmatter", () => {
  const r = parseSkill(good);
  assert.equal(r.ok, true);
  assert.equal(r.data.name, "good-skill");
  assert.match(r.body, /Good Skill/);
});

test("flags missing frontmatter", () => {
  const r = parseSkill("# just markdown\n");
  assert.equal(r.ok, false);
  assert.equal(r.reason, "missing-frontmatter");
});

test("flags invalid yaml", () => {
  const r = parseSkill("---\nname: [unclosed\n---\nbody\n");
  assert.equal(r.ok, false);
  assert.equal(r.reason, "invalid-yaml");
});

test("flags non-mapping frontmatter", () => {
  const r = parseSkill("---\n- just\n- a list\n---\nbody\n");
  assert.equal(r.ok, false);
  assert.equal(r.reason, "frontmatter-not-a-map");
});

test("findKeyLine locates keys", () => {
  assert.equal(findKeyLine("a: 1\nname: x\n", "name"), 2);
  assert.equal(findKeyLine("nope: 1\n", "name"), 1);
});

test("lineOfIndex counts lines", () => {
  assert.equal(lineOfIndex("a\nb\nc", 4), 3);
});
