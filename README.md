# skill-crucible

**The test suite for agent skills. Prove your `SKILL.md` works — before you ship it.**

[![npm](https://img.shields.io/npm/v/skill-crucible)](https://www.npmjs.com/package/skill-crucible)
[![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
![test](https://img.shields.io/badge/tests-45%20passing-brightgreen)

```bash
npx skill-crucible check .
```

Skills are the new package manager for AI agents — and almost none of them are tested:

- **~27% of skills produce zero or negative lift** on real agent tasks (NVIDIA ACES evaluation, 2026)
- **13–36% of published skills contain security issues** — prompt injection, credential theft, malicious payloads (Snyk ToxicSkills scan of 3,984 skills; corroborated by arXiv "Agent Skills in the Wild")
- **LLM-hallucinated `npx` package names** spread across thousands of skills, ready for anyone to claim and weaponize (slopsquatting)
- A study of **138,000 `SKILL.md` files** found the majority are not reusable and a meaningful share are unreviewed AI output

Scanners for the security half already exist (NVIDIA SkillSpector, Cisco skill-scanner). What does not exist is a **single evidence layer**: one command that gives any skill a score, a gate for CI, and a **badge you can put in your README**.

`skill-crucible` is that layer.

## Quick start

```bash
# scan the current directory (any folder containing SKILL.md)
npx skill-crucible check .

# machine-readable report + badge
npx skill-crucible check . --format json -o crucible-report.json --badge

# verify npx/pip package names against the real registry (anti-slopsquatting)
npx skill-crucible check . --online
```

Example output on a clean skill:

```
▸ good-skill (skills/good-skill/SKILL.md)
  ✓ no findings  100 · A · ship

──────────────────────────────────────────────────
score  100/100  A  SHIP
findings  0 critical · 0 high · 0 medium · 0 low · 0 info
```

And on a malicious one:

```
CRITICAL prompt-override/ignore-instructions
CRITICAL supply-chain/curl-pipe-shell
CRITICAL destructive/rm-root
CRITICAL supply-chain/hallucinated-package   ← npx name doesn't exist on npm
HIGH     hidden-unicode/zero-width           ← instructions invisible to humans
HIGH     exfil/outbound-with-secrets
score 0/100  F  REJECT  (safety gate: critical finding)
```

## What it checks

| Category | Examples | Severity |
|---|---|---|
| Prompt injection | "ignore previous instructions", "do not tell the user", new-instructions blocks, guardrail disabling | critical / high |
| Obfuscation | zero-width characters, bidi controls (Trojan Source), homoglyph spoofing, base64 decode-and-run | high / medium |
| Secrets | hardcoded AWS/GitHub tokens, private keys, `~/.ssh`, `.aws/credentials` access | critical / high |
| Exfiltration | outbound network calls combined with secret material in the same file | high |
| Supply chain | `curl \| sh`, download-and-execute, **hallucinated `npx`/`pip` package names** (`--online`) | critical |
| Destructive | `rm -rf /`, force-push instructions | critical / low |
| Spec compliance | missing/invalid frontmatter, bad `name`, missing `description`, vague description, name≠directory, oversized body, broken file references | high / medium |
| Dangerous code | `eval()`, `exec()`, `shell=True`, `new Function()` | medium |

## Score & badge

Every scan produces a 0–100 score with a letter grade and a ship/revise/reject verdict.
**Any critical finding caps the score at 40 and forces `reject`** — the safety gate.

```bash
npx skill-crucible check . --format json -o report.json
npx skill-crucible badge report.json -o badge.svg
```

Then in your README:

```markdown
![skill crucible](https://raw.githubusercontent.com/Dikaaff/skill-crucible/main/badge.svg)
```

Badges render locally (no server, no account) — exactly like the coverage badges that spread `codecov` across millions of READMEs.

## GitHub Action

```yaml
name: skill-crucible
on: [push, pull_request]
permissions:
  contents: read
  security-events: write

jobs:
  crucible:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: Dikaaff/skill-crucible@v0.1.0
        with:
          path: "."
          fail-on: high
          online: "true"
      - if: always()
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: crucible.sarif
```

Findings then appear as inline annotations in your PRs under the Security tab.

## CLI

```
crucible check [path...] [options]
crucible badge report.json [-o file.svg] [--label text] [--message text]
crucible version | help

  -f, --format <text|json|sarif>   output format (default: text)
  -o, --output <file>              write report to a file
      --fail-on <level>            gate level: critical|high|medium|low|info|none (default: high)
      --online                     verify package names against npm/PyPI registries
      --badge [file]               also write a badge SVG (default: crucible-badge.svg)
      --no-color                   disable ANSI colors

Exit codes: 0 clean · 1 findings at/above --fail-on · 2 usage error
```

`--online` mode resolves every `npx`/`pip install` package name against the real registry. A 404 means the package does not exist — an attacker can claim that name tomorrow and own every machine that runs the skill.

## Prior work

`skill-crucible` stands on the shoulders of the security research in this space and is deliberately complementary, not competitive:

- [Snyk ToxicSkills](https://snyk.io/blog/toxicskills-malicious-ai-agent-skills-clawhub) — supply-chain threat data
- [NVIDIA SkillSpector](https://github.com/NVIDIA/SkillSpector) & ACES — deep scanning and lift evaluation
- [Cisco skill-scanner](https://github.com/cisco-ai-defense/skill-scanner) — pattern + AST scanning

Crucible's job is the **evidence layer**: a fast deterministic score, a CI gate, and a portable badge.

## Limitations

Heuristic static analysis — not a sandbox. It reads text and matches patterns; it never executes what it scans. False positives are possible (a legitimate skill documenting `curl`), false negatives are guaranteed against novel obfuscation. Treat it as a fast first gate, not a guarantee.

## Roadmap

- [ ] **Lift evaluation** — run tasks with/without the skill and report the measured delta (the ACES methodology, affordable)
- [ ] **Trigger accuracy** — does the description fire when it should?
- [ ] **State of Skills** — monthly scan of thousands of public skills
- [ ] **Public badge registry** — verified scores at a glance

Contributions welcome.

## License

MIT
