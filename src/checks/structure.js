import fs from "node:fs";
import path from "node:path";
import { findKeyLine } from "../frontmatter.js";

const SPEC_FIELDS = new Set([
  "name", "description", "license", "compatibility", "metadata",
  "allowed-tools", "allowed_tools", "version", "author", "category", "tags",
  "when_to_use", "disable-model-invocation", "user-invocable",
  "disallowed-tools", "model", "effort", "context", "agent", "paths", "shell",
  "homepage", "repository",
]);

const GENERIC_DIRS = new Set([
  "skills", "skill", ".claude", ".cursor", ".gemini", ".github", ".codex",
  "src", "docs", "examples", "fixtures", "test", "tests", "plugins",
]);

const NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const REF_RE = /(?:scripts|references|assets|examples)\/[\w][\w./-]*/g;

function finding(ruleId, severity, message, file, line) {
  return { ruleId, severity, category: "structure", message, file, line };
}

export function runStructureChecks(unit, parsed, raw) {
  const findings = [];
  const file = unit.main;
  const dirLabel = path.basename(unit.dir);

  if (!parsed.ok) {
    const sev = parsed.reason === "missing-frontmatter" ? "high" : "critical";
    const ruleId = parsed.reason === "missing-frontmatter" ? "spec/missing-frontmatter" : "spec/invalid-frontmatter";
    findings.push(finding(ruleId, sev, `Frontmatter problem: ${parsed.detail}`, file, 1));
    return findings;
  }

  const data = parsed.data;
  const fmEnd = raw.indexOf(parsed.body);
  const frontmatterOnly = raw.slice(0, fmEnd + 1);

  if (data.name === undefined || data.name === null || String(data.name).trim() === "") {
    findings.push(finding("spec/missing-name", "high", 'Missing required frontmatter field "name"', file, 1));
  } else if (typeof data.name === "string") {
    const name = data.name;
    if (name.length > 64 || !NAME_RE.test(name)) {
      findings.push(
        finding(
          "spec/invalid-name",
          "high",
          `"name" must be lowercase letters/digits/hyphens, 1-64 chars (got "${name}")`,
          file,
          findKeyLine(frontmatterOnly, "name")
        )
      );
    }
    if (!GENERIC_DIRS.has(dirLabel.toLowerCase()) && dirLabel.toLowerCase() !== name) {
      findings.push(
        finding(
          "spec/name-dir-mismatch",
          "medium",
          `Frontmatter name "${name}" does not match directory "${dirLabel}" — agents key skills by directory`,
          file,
          findKeyLine(frontmatterOnly, "name")
        )
      );
    }
  } else {
    findings.push(finding("spec/invalid-name", "high", '"name" must be a string', file, findKeyLine(frontmatterOnly, "name")));
  }

  const descLine = findKeyLine(frontmatterOnly, "description");
  if (data.description === undefined || data.description === null || String(data.description).trim() === "") {
    findings.push(
      finding("spec/missing-description", "high", 'Missing required field "description" — skill will never trigger without it', file, descLine)
    );
  } else if (typeof data.description !== "string") {
    findings.push(finding("spec/invalid-description", "high", '"description" must be a string', file, descLine));
  } else {
    const desc = data.description.trim();
    if (desc.length > 1024) {
      findings.push(
        finding("spec/description-too-long", "high", `description is ${desc.length} chars (max 1024)`, file, descLine)
      );
    } else if (desc.length < 20) {
      findings.push(
        finding(
          "spec/description-too-short",
          "medium",
          `description is only ${desc.length} chars — too vague for reliable triggering, say what/when/for whom`,
          file,
          descLine
        )
      );
    }
  }

  for (const key of Object.keys(data)) {
    if (!SPEC_FIELDS.has(key)) {
      findings.push(
        finding("spec/unknown-field", "info", `Unknown frontmatter field "${key}"`, file, findKeyLine(frontmatterOnly, key))
      );
    }
  }

  const body = parsed.body;
  const estTokens = Math.ceil(body.length / 4);
  if (estTokens > 5000) {
    findings.push(
      finding(
        "spec/oversized-body",
        "medium",
        `Body is ~${estTokens} tokens — progressive disclosure loads this into context; move detail to references/`,
        file,
        parsed.bodyStartLine
      )
    );
  }

  const seenRefs = new Set();
  for (const m of body.matchAll(REF_RE)) {
    const ref = m[0];
    if (seenRefs.has(ref)) continue;
    seenRefs.add(ref);
    const line = parsed.bodyStartLine + lineOf(body, m.index);
    if (!fs.existsSync(path.resolve(unit.dir, ref))) {
      findings.push(
        finding("spec/missing-referenced-file", "medium", `References "${ref}" but it does not exist in the skill folder`, file, line)
      );
    }
  }

  return findings;
}

function lineOf(text, index) {
  let line = 1;
  for (let i = 0; i < index; i++) if (text.charCodeAt(i) === 10) line++;
  return line;
}
