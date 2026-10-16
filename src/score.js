export const SEVERITIES = ["info", "low", "medium", "high", "critical"];
export const RANK = Object.fromEntries(SEVERITIES.map((s, i) => [s, i]));

const DEDUCTION = { critical: 25, high: 12, medium: 5, low: 2, info: 0 };

export function countBySeverity(findings) {
  const counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0, total: findings.length };
  for (const f of findings) {
    if (counts[f.severity] !== undefined) counts[f.severity]++;
  }
  return counts;
}

export function computeScore(findings) {
  let score = 100;
  for (const f of findings) {
    score -= DEDUCTION[f.severity] ?? 0;
  }
  score = Math.max(0, Math.min(100, score));
  const hasCritical = findings.some((f) => f.severity === "critical");
  if (hasCritical) score = Math.min(score, 40);
  return {
    score,
    grade: gradeOf(score),
    verdict: verdictOf(score, hasCritical),
    safetyGate: hasCritical,
  };
}

function gradeOf(score) {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

function verdictOf(score, safetyGate) {
  if (safetyGate) return "reject";
  if (score >= 75) return "ship";
  if (score >= 50) return "revise";
  return "reject";
}

export function worstSeverity(findings, failOn) {
  if (failOn === "none") return false;
  const threshold = RANK[failOn];
  if (threshold === undefined) throw new Error(`invalid --fail-on level: ${failOn}`);
  return findings.some((f) => (RANK[f.severity] ?? -1) >= threshold);
}
