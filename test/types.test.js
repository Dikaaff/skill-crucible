import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const read = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

test("every runtime export has a type declaration", () => {
  const source = read("../src/index.js");
  const types = read("../src/index.d.ts");
  const names = [...source.matchAll(/export\s*{([^}]+)}/g)]
    .flatMap((m) => m[1].split(","))
    .map((s) => s.trim().split(/\s+as\s+/).pop().trim())
    .filter(Boolean);

  assert.ok(names.length >= 20, `expected a full public surface, found ${names.length}`);
  for (const name of names) {
    assert.match(types, new RegExp(`\\b${name}\\b`), `src/index.d.ts is missing a declaration for ${name}`);
  }
});

test("package.json points at the declaration file", () => {
  const pkg = JSON.parse(read("../package.json"));
  assert.equal(pkg.types, "./src/index.d.ts");
  assert.equal(pkg.exports["."].types, "./src/index.d.ts");
  assert.ok(pkg.files.includes("src"));
});
