import path from "node:path";

export function toJsonReport({ toolVersion, inputs, units, findings, overall, online }) {
  const rel = (f) => toPosix(path.relative(process.cwd(), f));
  return {
    tool: { name: "skill-crucible", version: toolVersion },
    generatedAt: new Date().toISOString(),
    inputs: inputs.map((i) => toPosix(path.relative(process.cwd(), i) || ".")),
    mode: online ? "online" : "offline",
    score: overall.score,
    grade: overall.grade,
    verdict: overall.verdict,
    safetyGate: overall.safetyGate,
    counts: countsOf(findings),
    skills: units.map((u) => ({
      skill: u.name,
      path: rel(u.main),
      score: u.score,
      grade: u.grade,
      verdict: u.verdict,
      counts: countsOf(u.findings),
    })),
    findings: findings.map((f) => ({
      ruleId: f.ruleId,
      severity: f.severity,
      category: f.category,
      message: f.message,
      file: rel(f.file),
      line: f.line,
    })),
  };
}

function countsOf(findings) {
  const counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0, total: findings.length };
  for (const f of findings) if (counts[f.severity] !== undefined) counts[f.severity]++;
  return counts;
}

function toPosix(p) {
  return p.split(path.sep).join("/");
}
