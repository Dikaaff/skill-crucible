import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { discoverSkills, readTextFile, isScannable } from "./discover.js";
import { parseSkill } from "./frontmatter.js";
import { runStructureChecks } from "./checks/structure.js";
import { runSecurityChecks } from "./checks/security.js";
import { extractPackages, verifyPackages, hallucinatedFindings } from "./checks/packages.js";
import { computeScore, worstSeverity, countBySeverity } from "./score.js";
import { toJsonReport } from "./report/json.js";
import { toSarif } from "./report/sarif.js";
import { renderText } from "./report/text.js";
import { badgeForScore } from "./report/badge.js";

export const VERSION = loadVersion();

const COMMANDS = new Set(["check", "badge", "help", "version"]);

export async function main(argv) {
  const opts = parseArgs(argv);

  if (opts.command === "version" || opts.flags.version) {
    process.stdout.write(`skill-crucible ${VERSION}\n`);
    return 0;
  }
  if (opts.command === "help" || opts.flags.help) {
    process.stdout.write(helpText());
    return 0;
  }
  if (opts.error) {
    process.stderr.write(`crucible: ${opts.error}\n\n${helpText()}`);
    return 2;
  }
  if (opts.command === "badge") {
    return runBadge(opts);
  }
  return runCheck(opts);
}

function parseArgs(argv) {
  const flags = {};
  const positional = [];
  const errors = [];

  const takesValue = new Set(["format", "output", "fail-on", "badge-out", "label", "message"]);
  const takesOptional = new Set(["badge"]);

  let i = 0;
  while (i < argv.length) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const eq = a.indexOf("=");
      let key, value;
      if (eq !== -1) {
        key = a.slice(2, eq);
        value = a.slice(eq + 1);
      } else {
        key = a.slice(2);
        value = undefined;
      }
      if (takesValue.has(key)) {
        if (value === undefined) {
          value = argv[++i];
          if (value === undefined) errors.push(`--${key} requires a value`);
        }
        flags[key] = value;
      } else if (takesOptional.has(key)) {
        if (value === undefined && argv[i + 1] && !argv[i + 1].startsWith("-")) {
          value = argv[++i];
        }
        flags[key] = value ?? true;
      } else if (key === "no-color") {
        flags["no-color"] = true;
      } else if (key === "online") {
        flags.online = true;
      } else if (key === "version") {
        flags.version = true;
      } else if (key === "help") {
        flags.help = true;
      } else {
        errors.push(`unknown option --${key}`);
      }
      i++;
    } else if (a === "-f" || a === "-o" || a === "--fail-on") {
      const key = a === "-f" ? "format" : a === "-o" ? "output" : "fail-on";
      const value = argv[++i];
      if (value === undefined) errors.push(`${a} requires a value`);
      flags[key] = value;
      i++;
    } else if (a === "-v") {
      flags.version = true;
      i++;
    } else {
      positional.push(a);
      i++;
    }
  }

  let command = "check";
  if (positional.length && COMMANDS.has(positional[0])) {
    command = positional.shift();
  }

  const format = flags.format ?? "text";
  if (!["text", "json", "sarif"].includes(format)) errors.push(`invalid --format: ${format} (text|json|sarif)`);
  const failOn = flags["fail-on"] ?? "high";
  if (!["critical", "high", "medium", "low", "info", "none"].includes(failOn)) {
    errors.push(`invalid --fail-on: ${failOn} (critical|high|medium|low|info|none)`);
  }

  return {
    command,
    flags,
    positional,
    format,
    failOn,
    online: Boolean(flags.online),
    error: errors.length ? errors[0] : null,
  };
}

async function runCheck(opts) {
  const inputs = opts.positional.length ? opts.positional : ["."];
  const color =
    !opts.flags["no-color"] &&
    !process.env.NO_COLOR &&
    process.stdout.isTTY &&
    opts.format === "text";

  let units;
  try {
    units = [];
    for (const p of inputs) {
      for (const unit of discoverSkills(p)) units.push(unit);
    }
  } catch (e) {
    process.stderr.write(`crucible: ${e.message}\n`);
    return 2;
  }

  const allFindings = [];
  const packageRefs = [];
  const unitResults = [];

  for (const unit of units) {
    const mainRaw = readTextFile(unit.main);
    const parsed = mainRaw === null ? { ok: false, reason: "missing-frontmatter", detail: "unreadable file" } : parseSkill(mainRaw);

    const findings = [];
    if (mainRaw !== null) {
      findings.push(...runStructureChecks(unit, parsed, mainRaw));
      findings.push(...runSecurityChecks(unit, unit.main, mainRaw));
      for (const ref of extractPackages(mainRaw)) packageRefs.push({ ...ref, file: unit.main });
    }

    for (const file of unit.files) {
      if (file === unit.main) continue;
      if (!isScannable(file)) continue;
      const text = readTextFile(file);
      if (text === null) continue;
      findings.push(...runSecurityChecks(unit, file, text));
      for (const ref of extractPackages(text)) packageRefs.push({ ...ref, file });
    }

    unit.findings = findings;
    const s = computeScore(findings);
    unit.score = s.score;
    unit.grade = s.grade;
    unit.verdict = s.verdict;
    allFindings.push(...findings);
    unitResults.push(unit);
  }

  if (opts.online && packageRefs.length) {
    const verified = await verifyPackages(packageRefs);
    const bad = hallucinatedFindings(verified.map((v, idx) => ({ ...v, file: packageRefs[idx].file, line: packageRefs[idx].line })));
    for (const f of bad) {
      allFindings.push(f);
      const owner = unitResults.find((u) => f.file.startsWith(u.dir));
      if (owner) owner.findings.push(f);
      else unitResults.push({ name: path.basename(path.dirname(f.file)), main: f.file, findings: [f], score: 40, grade: "F", verdict: "reject" });
    }
    for (const u of unitResults) {
      if (u.score === undefined) continue;
      const s = computeScore(u.findings);
      u.score = s.score;
      u.grade = s.grade;
      u.verdict = s.verdict;
    }
  }

  const overall = computeScore(allFindings);

  const report = {
    toolVersion: VERSION,
    inputs,
    units: unitResults,
    findings: allFindings,
    overall,
    online: opts.online,
  };

  let output = null;
  let payload = null;
  if (opts.format === "json") {
    payload = JSON.stringify(toJsonReport(report), null, 2) + "\n";
  } else if (opts.format === "sarif") {
    payload = JSON.stringify(toSarif(report), null, 2) + "\n";
  } else {
    output = renderText(report);
  }

  if (opts.flags.output) {
    fs.writeFileSync(opts.flags.output, payload ?? output + "\n");
    const counts = countBySeverity(allFindings);
    process.stdout.write(
      `wrote ${opts.flags.output} (score ${overall.score}/100, ${counts.critical} critical, ${counts.high} high)\n`
    );
  } else if (payload !== null) {
    process.stdout.write(payload);
  } else {
    process.stdout.write(output + "\n");
  }

  if (opts.flags.badge) {
    const badgePath = typeof opts.flags.badge === "string" ? opts.flags.badge : opts.flags["badge-out"] ?? "crucible-badge.svg";
    fs.writeFileSync(badgePath, badgeForScore(overall.score, overall.grade));
    if (!opts.flags.output) process.stdout.write(`badge written to ${badgePath}\n`);
  }

  const pending = new Set(packageRefs.map((p) => `${p.manager}:${p.name}`)).size;
  if (!opts.online && pending > 0 && opts.format === "text" && !opts.flags.output) {
    process.stdout.write(`\n${pending} package name(s) not registry-verified — rerun with --online\n`);
  }

  return worstSeverity(allFindings, opts.failOn) ? 1 : 0;
}

function runBadge(opts) {
  const reportPath = opts.positional[0];
  if (!reportPath) {
    process.stderr.write("crucible badge: missing report.json (run `crucible check --format json -o report.json` first)\n");
    return 2;
  }
  let data;
  try {
    data = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  } catch (e) {
    process.stderr.write(`crucible badge: cannot read report: ${e.message}\n`);
    return 2;
  }
  if (typeof data.score !== "number" || !data.grade) {
    process.stderr.write("crucible badge: report has no score/grade fields\n");
    return 2;
  }
  const svg = badgeForScore(data.score, data.grade, {
    label: opts.flags.label,
    message: opts.flags.message ?? `${data.score} · ${data.grade}`,
  });
  if (opts.flags.output) {
    fs.writeFileSync(opts.flags.output, svg);
    process.stdout.write(`badge written to ${opts.flags.output}\n`);
  } else {
    process.stdout.write(svg);
  }
  return 0;
}

function helpText() {
  return `skill-crucible ${VERSION} — evidence lab for agent skills

Usage:
  crucible check [path...] [options]     Scan skills, print score + findings
  crucible badge report.json [options]   Render badge SVG from a JSON report
  crucible version
  crucible help

Options (check):
  -f, --format <text|json|sarif>   Output format (default: text)
  -o, --output <file>              Write report to a file
      --fail-on <level>            Exit 1 at/above level: critical|high|medium|low|info|none (default: high)
      --online                     Verify npx/pip package names against the real registry
      --badge [file]               Also write a badge SVG (default: crucible-badge.svg)
      --badge-out <file>           Badge output path for --badge
      --no-color                   Disable ANSI colors

Options (badge):
  -o, --output <file>              Write SVG to a file instead of stdout
      --label <text>               Badge label (default: "skill crucible")
      --message <text>             Badge message (default: "<score> · <grade>")

Exit codes:
  0  clean (no findings at/above --fail-on)
  1  findings at/above --fail-on
  2  usage or runtime error
`;
}

function loadVersion() {
  try {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const pkg = JSON.parse(fs.readFileSync(path.join(here, "..", "package.json"), "utf8"));
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}
