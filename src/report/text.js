import path from "node:path";

const ANSI = {
  reset: "\u001b[0m",
  bold: "\u001b[1m",
  dim: "\u001b[2m",
  red: "\u001b[31m",
  green: "\u001b[32m",
  yellow: "\u001b[33m",
  blue: "\u001b[34m",
  magenta: "\u001b[35m",
  cyan: "\u001b[36m",
  gray: "\u001b[90m",
};

const SEV_COLOR = {
  critical: "red",
  high: "red",
  medium: "yellow",
  low: "blue",
  info: "gray",
};

export function renderText({ toolVersion, units, findings, overall, online, color }) {
  const c = makePainter(color);
  const lines = [];
  const rel = (f) => {
    const r = path.relative(process.cwd(), f);
    return r.split(path.sep).join("/");
  };

  lines.push(`${c.bold("skill-crucible")} ${c.gray(`v${toolVersion}`)} ${c.gray(`· mode ${online ? "online" : "offline"}`)}`);
  lines.push("");

  if (units.length === 0) {
    lines.push(c.yellow("No SKILL.md files found under the given path."));
    return lines.join("\n");
  }

  for (const u of units) {
    const head = `${u.name} ${c.gray(`(${rel(u.main)})`)}`;
    lines.push(`${c.cyan("▸")} ${head}`);
    if (u.findings.length === 0) {
      lines.push(`  ${c.green("✓")} no findings  ${c.gray(`${u.score} · ${u.grade} · ${u.verdict}`)}`);
    } else {
      const sorted = [...u.findings].sort((a, b) => rank(b.severity) - rank(a.severity));
      for (const f of sorted) {
        const sev = f.severity.toUpperCase().padEnd(8);
        const sevColored = c[SEV_COLOR[f.severity] ?? "reset"] ? c[SEV_COLOR[f.severity]](sev) : sev;
        lines.push(`  ${sevColored} ${c.bold(f.ruleId)}`);
        lines.push(`           ${f.message}`);
        lines.push(`           ${c.gray(`${rel(f.file)}:${f.line}`)}`);
      }
      lines.push(`  ${c.gray(`score ${u.score} · ${u.grade} · ${u.verdict}`)}`);
    }
    lines.push("");
  }

  const counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const f of findings) if (counts[f.severity] !== undefined) counts[f.severity]++;

  lines.push(c.gray("─".repeat(58)));
  const scoreColored =
    overall.score >= 75 ? c.green(String(overall.score)) : overall.score >= 50 ? c.yellow(String(overall.score)) : c.red(String(overall.score));
  lines.push(
    `score  ${scoreColored}${c.gray("/100")}  ${c.bold(overall.grade)}  ${c.bold(overall.verdict.toUpperCase())}` +
      (overall.safetyGate ? c.red("  (safety gate: critical finding)") : "")
  );
  lines.push(
    `findings  ${c.red(`${counts.critical} critical`)} · ${c.red(`${counts.high} high`)} · ${c.yellow(`${counts.medium} medium`)} · ${c.blue(`${counts.low} low`)} · ${c.gray(`${counts.info} info`)}`
  );
  if (!online) {
    lines.push(c.gray("tip: add --online to verify npx/pip package names against the real registry (anti-slopsquatting)"));
  }
  return lines.join("\n");
}

function makePainter(enabled) {
  if (!enabled) {
    const noop = (s) => s;
    return { reset: noop, bold: noop, dim: noop, red: noop, green: noop, yellow: noop, blue: noop, magenta: noop, cyan: noop, gray: noop };
  }
  return {
    reset: (s) => s + ANSI.reset,
    bold: (s) => ANSI.bold + s + ANSI.reset,
    dim: (s) => ANSI.dim + s + ANSI.reset,
    red: (s) => ANSI.red + s + ANSI.reset,
    green: (s) => ANSI.green + s + ANSI.reset,
    yellow: (s) => ANSI.yellow + s + ANSI.reset,
    blue: (s) => ANSI.blue + s + ANSI.reset,
    magenta: (s) => ANSI.magenta + s + ANSI.reset,
    cyan: (s) => ANSI.cyan + s + ANSI.reset,
    gray: (s) => ANSI.gray + s + ANSI.reset,
  };
}

function rank(sev) {
  return { info: 0, low: 1, medium: 2, high: 3, critical: 4 }[sev] ?? 0;
}
