import fs from "node:fs";
import path from "node:path";

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "coverage",
  ".next",
  ".cache",
  "vendor",
]);

const SKILL_FILE = /^skill\.md$/i;

export function discoverSkills(inputPath) {
  const abs = path.resolve(inputPath);
  let stat;
  try {
    stat = fs.statSync(abs);
  } catch {
    throw new Error(`path not found: ${inputPath}`);
  }
  if (stat.isFile()) {
    return [{ main: abs, dir: path.dirname(abs), root: path.dirname(abs), name: path.basename(path.dirname(abs)), files: [abs] }];
  }
  const mains = [];
  walk(abs, mains, 0);
  return mains.map((main) => makeUnit(main, path.dirname(main), abs));
}

function walk(dir, mains, depth) {
  if (depth > 12) return;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      walk(full, mains, depth + 1);
    } else if (e.isFile() && SKILL_FILE.test(e.name)) {
      mains.push(full);
    }
  }
}

function makeUnit(main, dir, root) {
  return {
    main,
    dir,
    root,
    name: path.basename(dir),
    files: listFiles(dir, main),
  };
}

function listFiles(dir, main) {
  const out = [];
  const seen = new Set();
  const stack = [{ dir, depth: 0 }];
  while (stack.length) {
    const { dir: current, depth } = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const full = path.join(current, e.name);
      if (e.isDirectory()) {
        if (SKIP_DIRS.has(e.name)) continue;
        if (depth === 0 && hasSkillFile(full)) continue;
        stack.push({ dir: full, depth: depth + 1 });
      } else if (e.isFile()) {
        if (full === main) continue;
        if (seen.has(full)) continue;
        seen.add(full);
        out.push(full);
      }
    }
  }
  out.push(main);
  return out;
}

function hasSkillFile(dir) {
  try {
    return fs.readdirSync(dir).some((n) => SKILL_FILE.test(n));
  } catch {
    return false;
  }
}

const SCANNABLE = new Set([
  "md", "txt", "py", "js", "mjs", "cjs", "ts", "tsx", "jsx", "sh", "bash",
  "zsh", "ps1", "bat", "yaml", "yml", "json", "toml", "cfg", "ini", "rb",
  "go", "rs", "java", "pl", "php", "lua", "r", "env", "example", "template",
  "gitignore", "editorconfig", "csv", "tsv", "rst", "adoc",
]);

export function isScannable(file) {
  const ext = path.extname(file).slice(1).toLowerCase();
  if (ext === "") return true;
  return SCANNABLE.has(ext);
}

export function readTextFile(file, maxBytes = 2 * 1024 * 1024) {
  let buf;
  try {
    const stat = fs.statSync(file);
    if (stat.size > maxBytes) return null;
    buf = fs.readFileSync(file);
  } catch {
    return null;
  }
  const probe = buf.subarray(0, Math.min(buf.length, 8192));
  if (probe.includes(0)) return null;
  return buf.toString("utf8");
}
