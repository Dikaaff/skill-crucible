import path from "node:path";

const LEVEL = {
  critical: "error",
  high: "error",
  medium: "warning",
  low: "note",
  info: "note",
};

export function toSarif({ toolVersion, findings }) {
  const rel = (f) => {
    const r = path.relative(process.cwd(), f);
    return r.split(path.sep).join("/");
  };
  const rules = new Map();
  for (const f of findings) {
    if (!rules.has(f.ruleId)) {
      rules.set(f.ruleId, {
        id: f.ruleId,
        name: f.ruleId.split("/")[1] ?? f.ruleId,
        shortDescription: { text: f.message.split(" — ")[0] },
        properties: { category: f.category, severity: f.severity },
      });
    }
  }
  return {
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: {
            name: "skill-crucible",
            informationUri: "https://www.npmjs.com/package/skill-crucible",
            version: toolVersion,
            rules: [...rules.values()],
          },
        },
        results: findings.map((f) => ({
          ruleId: f.ruleId,
          level: LEVEL[f.severity] ?? "warning",
          message: { text: f.message },
          partialFingerprints: {
            fingerprint1: hash(`${f.ruleId}|${rel(f.file)}|${f.message}`),
          },
          locations: [
            {
              physicalLocation: {
                artifactLocation: { uri: rel(f.file) },
                region: { startLine: Math.max(1, f.line || 1) },
              },
            },
          ],
        })),
      },
    ],
  };
}

function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}
