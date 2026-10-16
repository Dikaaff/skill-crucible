import yaml from "js-yaml";

export function parseSkill(raw) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(raw);
  if (!m) {
    return {
      ok: false,
      reason: "missing-frontmatter",
      detail: "file does not start with --- frontmatter block",
      data: null,
      body: raw,
      bodyStartLine: 1,
      raw,
    };
  }
  let data;
  try {
    data = yaml.load(m[1]);
  } catch (e) {
    return {
      ok: false,
      reason: "invalid-yaml",
      detail: String(e.message).split("\n")[0],
      data: null,
      body: raw,
      bodyStartLine: 1,
      raw,
    };
  }
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    return {
      ok: false,
      reason: "frontmatter-not-a-map",
      detail: "frontmatter must be a YAML mapping of key: value pairs",
      data: null,
      body: raw,
      bodyStartLine: 1,
      raw,
    };
  }
  const consumed = m[0];
  return {
    ok: true,
    reason: null,
    detail: null,
    data,
    body: raw.slice(consumed.length),
    bodyStartLine: consumed.split(/\r?\n/).length,
    raw,
  };
}

export function lineOfIndex(raw, index) {
  let line = 1;
  const end = Math.min(index, raw.length);
  for (let i = 0; i < end; i++) {
    if (raw.charCodeAt(i) === 10) line++;
  }
  return line;
}

export function findKeyLine(raw, key) {
  const m = new RegExp(`^${key}\\s*:`, "m").exec(raw);
  return m ? lineOfIndex(raw, m.index) : 1;
}
