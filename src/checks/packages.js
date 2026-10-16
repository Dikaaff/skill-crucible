const CMD_RE = /\b(npx|npm\s+(?:install|i|add)|pnpm\s+(?:add|dlx)|yarn\s+(?:add|dlx)|pip3?\s+install|pipx\s+install|uv\s+(?:tool\s+)?install)\s+(?:-\S+\s+)*((?:@[a-z0-9][\w.-]*\/)?[a-z0-9][\w.-]*)/gi;

const PYPI_MANAGERS = /^(?:pip3?|pipx|uv)/i;

export function extractPackages(text) {
  const out = [];
  const seen = new Set();
  for (const m of text.matchAll(CMD_RE)) {
    const cmd = m[1].replace(/\s+/g, " ").trim();
    let name = m[2];
    name = stripVersion(name);
    if (!name) continue;
    const manager = PYPI_MANAGERS.test(cmd) ? "pypi" : "npm";
    const key = `${manager}:${name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ manager, name, command: cmd, line: lineOf(text, m.index) });
  }
  return out;
}

function stripVersion(name) {
  if (name.startsWith("@")) {
    const slash = name.indexOf("/");
    if (slash === -1) return name;
    const rest = name.slice(slash + 1);
    const at = rest.indexOf("@");
    return at === -1 ? name : name.slice(0, slash + 1) + rest.slice(0, at);
  }
  const at = name.indexOf("@");
  return at > 0 ? name.slice(0, at) : name;
}

function lineOf(text, index) {
  let line = 1;
  for (let i = 0; i < index; i++) if (text.charCodeAt(i) === 10) line++;
  return line;
}

export async function verifyPackages(packages, { timeout = 5000, fetchImpl } = {}) {
  const doFetch = fetchImpl ?? fetch;
  const results = [];
  for (const pkg of packages) {
    const url =
      pkg.manager === "npm"
        ? `https://registry.npmjs.org/${encodeURIComponent(pkg.name)}`
        : `https://pypi.org/pypi/${encodeURIComponent(pkg.name)}/json`;
    try {
      const res = await doFetch(url, { method: "GET", signal: AbortSignal.timeout(timeout) });
      results.push({ ...pkg, status: res.status, exists: res.status !== 404 });
    } catch (e) {
      results.push({ ...pkg, status: null, exists: null, error: String(e && e.message ? e.message : e) });
    }
  }
  return results;
}

export function hallucinatedFindings(verifications) {
  const findings = [];
  for (const v of verifications) {
    if (v.exists === false) {
      findings.push({
        ruleId: "supply-chain/hallucinated-package",
        severity: "critical",
        category: "supply-chain",
        message: `${v.command} references "${v.name}" which does not exist on ${v.manager === "npm" ? "npm" : "PyPI"} — LLM-hallucinated package name, claimable by an attacker (slopsquatting)`,
        file: v.file,
        line: v.line,
      });
    }
  }
  return findings;
}
