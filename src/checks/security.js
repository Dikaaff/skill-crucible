import { lineOfIndex } from "../frontmatter.js";

const RULES = [
  {
    id: "prompt-override/ignore-instructions",
    severity: "critical",
    category: "prompt-injection",
    re: /ignore\s+(?:all|any|previous|prior|above|earlier)[\s\S]{0,40}?(?:instructions|prompts?|rules|guidelines)/gi,
    message: 'Instruction-override phrasing ("ignore ... instructions") inside a skill body',
  },
  {
    id: "prompt-override/disregard",
    severity: "critical",
    category: "prompt-injection",
    re: /disregard\s+(?:your|the|all|any|previous|prior)[\s\S]{0,30}?(?:instructions|prompt|rules|guidelines)/gi,
    message: 'Instruction-override phrasing ("disregard ... prompt")',
  },
  {
    id: "prompt-override/forget",
    severity: "high",
    category: "prompt-injection",
    re: /(?:forget|reset)\s+(?:everything|all\s+previous|your\s+previous|everything\s+(?:you(?:'ve| have)?\s+)?(?:been\s+told|learned))/gi,
    message: 'Memory-reset phrasing ("forget everything")',
  },
  {
    id: "prompt-override/role-override",
    severity: "high",
    category: "prompt-injection",
    re: /(?:you\s+are\s+now|from\s+now\s+on\s+you\s+are)\s+(?:an?\s+)?(?:unrestricted|uncensored|jailbroken|unfiltered|dan\b|developer\s+mode)/gi,
    message: "Attempts to reassign the agent into an unrestricted role",
  },
  {
    id: "prompt-override/new-instructions",
    severity: "high",
    category: "prompt-injection",
    re: /^\s*(?:new|updated|override|additional)\s+instructions?\s*:/gim,
    message: 'Injected "new instructions:" block — classic prompt-injection shape',
  },
  {
    id: "prompt-override/secrecy",
    severity: "high",
    category: "prompt-injection",
    re: /(?:do\s+not|never|don't|dont)\s+(?:tell|inform|mention|reveal|show|disclose)\s+(?:the\s+)?user/gi,
    message: "Instructs the agent to hide behavior from the user",
  },
  {
    id: "guardrail-disable/skip-approval",
    severity: "high",
    category: "prompt-injection",
    re: /(?:--dangerously-skip-permissions|(?:disable|bypass|skip|turn\s+off)\s+(?:the\s+)?(?:safety|guardrails?|approvals?|permissions?|checks?|restrictions?|confirmation))/gi,
    message: "Tries to disable approvals, guardrails, or permission checks",
  },
  {
    id: "hidden-unicode/zero-width",
    severity: "high",
    category: "obfuscation",
    re: /[\u00AD\u200B\u200C\u200D\u2060]/g,
    message: "Zero-width/invisible characters present — instructions can hide from human review",
  },
  {
    id: "hidden-unicode/bidi",
    severity: "high",
    category: "obfuscation",
    re: /[\u202A-\u202E\u2066-\u2069]/g,
    message: "Bidirectional control characters present (Trojan Source style)",
  },
  {
    id: "secret/private-key",
    severity: "critical",
    category: "secrets",
    re: /-----BEGIN[A-Z ]*PRIVATE KEY-----/g,
    message: "Embedded private key material",
  },
  {
    id: "secret/aws-key",
    severity: "critical",
    category: "secrets",
    re: /\bAKIA[0-9A-Z]{16}\b/g,
    message: "Hardcoded AWS access key id",
  },
  {
    id: "secret/github-token",
    severity: "critical",
    category: "secrets",
    re: /\b(?:(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{20,})/g,
    message: "Hardcoded GitHub token",
  },
  {
    id: "secret/credential-path",
    severity: "high",
    category: "secrets",
    re: /(?:~\/\.ssh\/|\b\.ssh\/id_(?:rsa|ed25519|ecdsa)\b|\b\.aws\/credentials\b|\b\.netrc\b|\bid_rsa\b)/g,
    message: "References credential stores (~/.ssh, .aws/credentials, .netrc) — verify intent",
  },
  {
    id: "secret/env-file",
    severity: "medium",
    category: "secrets",
    re: /(?:read(?:ing|s)?\s+(?:the\s+)?\.env\b|load_dotenv|\.env\b\s+(?:file|vars))/gi,
    message: "Touches .env files — make sure secrets are never exfiltrated",
  },
  {
    id: "supply-chain/curl-pipe-shell",
    severity: "critical",
    category: "supply-chain",
    re: /(?:curl|wget)\b[^|\n]{0,200}\|\s*(?:sudo\s+)?(?:ba|z|da|fi)?sh\b/gi,
    message: "Downloads remote content and pipes it straight into a shell",
  },
  {
    id: "supply-chain/iex-download",
    severity: "high",
    category: "supply-chain",
    re: /iex\s*\(\s*(?:invoke-webrequest|iwr|invoke-restmethod)\b/gi,
    message: "PowerShell download-and-execute pattern",
  },
  {
    id: "destructive/rm-root",
    severity: "critical",
    category: "destructive",
    re: /\brm\s+-[a-z]*r[a-z]*f?[a-z]*\s+(?:\/|~|\$HOME\b|\$\{HOME\})/g,
    message: "Recursive delete targeting / or $HOME",
  },
  {
    id: "destructive/force-push",
    severity: "low",
    category: "destructive",
    re: /\bgit\s+push\b[^\n]{0,40}(?:\s-f\b|--force\b|--force-with-lease\b)/g,
    message: "Force push instruction — dangerous in an unattended agent skill",
  },
  {
    id: "exfil/outbound-with-secrets",
    severity: "high",
    category: "exfiltration",
    outbound: /(?:curl|wget|invoke-webrequest|fetch\s*\(|axios\.|requests\.(?:get|post|put)|http\.request|urllib|nc\s+-|\/dev\/tcp\/)/i,
    secretish: /(?:\.ssh|\.env\b|AKIA|aws\/credentials|api[_-]?key|token|password|authorization|process\.env|os\.environ|\$[A-Z_]*(?:KEY|SECRET|TOKEN))/i,
    message: "File mixes outbound network calls with secret material — possible exfiltration channel",
  },
  {
    id: "dynamic/base64-run",
    severity: "high",
    category: "obfuscation",
    re: /(?:base64\s+(?:--decode|-d|decode)\s*\|\s*(?:ba|z|da)?sh|\batob\s*\([^)]{0,80}\)\s*(?:&&|\|\||;))/g,
    message: "Decode-and-run pattern (base64 payload executed)",
  },
  {
    id: "dynamic/code-exec",
    severity: "medium",
    category: "dangerous-code",
    re: /(?:\beval\s*\(\s*['"`]|(?:\bexec|\bexecSync)\s*\(\s*['"`]|subprocess[^\n]{0,120}shell\s*=\s*True|\bnew\s+Function\s*\(\s*['"`])/g,
    message: "Dynamic code execution construct — review what feeds it",
  },
];

export function runSecurityChecks(unit, file, text) {
  const findings = [];
  const scanText = text.replace(/^\uFEFF/, "");

  for (const rule of RULES) {
    if (rule.outbound) {
      if (rule.outbound.test(scanText) && rule.secretish.test(scanText)) {
        findings.push(makeFinding(rule, file, firstIndex(scanText, rule.outbound), scanText));
      }
      continue;
    }
    rule.re.lastIndex = 0;
    let m;
    const matches = [];
    while ((m = rule.re.exec(scanText)) !== null && matches.length < 20) {
      matches.push({ index: m.index, match: m[0] });
      if (m[0].length === 0) rule.re.lastIndex++;
    }
    for (const hit of matches) {
      findings.push(toFinding(rule, file, hit.index, hit.match, scanText));
    }
  }

  findings.push(...checkHomoglyphs(scanText, file));

  const seen = new Set();
  const deduped = [];
  for (const f of findings) {
    const key = `${f.ruleId}|${f.file}|${f.line}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(f);
  }
  return deduped;
}

function firstIndex(text, re) {
  re.lastIndex = 0;
  const m = re.exec(text);
  return m ? m.index : 0;
}

function makeFinding(rule, file, index, text) {
  return toFinding(rule, file, index, snippetAt(text, index), text);
}

function toFinding(rule, file, index, match, text) {
  const line = lineOfIndex(text, index);
  const snippet = String(match).replace(/\s+/g, " ").trim().slice(0, 80);
  return {
    ruleId: rule.id,
    severity: rule.severity,
    category: rule.category,
    message: `${rule.message} — matched: "${snippet}"`,
    file,
    line,
  };
}

function snippetAt(text, index) {
  return text.slice(index, index + 40);
}

const CYRILLIC_GREEK = /[\u0400-\u04FF\u0370-\u03FF]/;
const LATIN = /[A-Za-z]/;

function checkHomoglyphs(text, file) {
  const findings = [];
  const seen = new Set();
  const words = text.split(/[^A-Za-z\u0400-\u04FF\u0370-\u03FF]+/);
  for (const word of words) {
    if (word.length < 5) continue;
    if (!LATIN.test(word)) continue;
    if (!CYRILLIC_GREEK.test(word)) continue;
    if (seen.has(word)) continue;
    seen.add(word);
    const index = text.indexOf(word);
    findings.push({
      ruleId: "hidden-unicode/homoglyph",
      severity: "medium",
      category: "obfuscation",
      message: `Mixed-script word "${word}" (Latin + Cyrillic/Greek look-alikes) — possible homoglyph spoofing`,
      file,
      line: lineOfIndex(text, index),
    });
    if (findings.length >= 10) break;
  }
  return findings;
}
