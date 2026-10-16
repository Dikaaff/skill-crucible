<p align="center">
  <a href="https://www.npmjs.com/package/skill-crucible"><img src="https://img.shields.io/npm/v/skill-crucible" alt="npm version"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="license"></a>
  <img src="https://img.shields.io/badge/tests-45%20passing-brightgreen" alt="tests">
  <img src="https://raw.githubusercontent.com/Dikaaff/skill-crucible/main/badge.svg" alt="skill crucible score">
</p>

<h1 align="center">skill-crucible</h1>

<p align="center">
  <b>Prove your agent skill works — before you ship it.</b><br>
  Score · security gate · CI · README badge &nbsp;·&nbsp; one command, no server, no account
</p>

<p align="center">
  <code>npx skill-crucible check .</code>
</p>

---

<p align="center"><i>That badge above is skill-crucible scoring this repo's own SKILL.md. Regenerate with <code>npm run badge</code>.</i></p>

## The problem

Skills are the new package manager for AI agents — and they shipped without tests.

| Evidence | Source |
|---|---|
| **~27% of skills give zero or negative lift** on real agent tasks | NVIDIA ACES evaluation, 2026 |
| **13–36% of published skills carry security issues** — prompt injection, credential theft, malware payloads | Snyk ToxicSkills (n=3,984), corroborated by arXiv "Agent Skills in the Wild" (n=42,447) |
| **Hallucinated `npx` package names** spread through skills — anyone can claim them tomorrow and own every machine that runs the skill | Aikido, "Agent Skills Are Spreading Hallucinated npx Commands" |
| **138,000 `SKILL.md` files**: majority not reusable, many unreviewed AI output | arXiv 2608.08453 |

Deep scanners exist for the malware half (NVIDIA SkillSpector, Cisco skill-scanner). What never existed is the **evidence layer**: a number, a gate, and a badge — the things that made `eslint` and `codecov` spread.

`skill-crucible` is that layer.

## 30-second demo

```bash
npx skill-crucible check path/to/your-skill
```

**Clean skill:**

```
▸ good-skill (skills/good-skill/SKILL.md)
  ✓ no findings  100 · A · ship

score  100/100  A  SHIP
```

**Compromised skill:**

```
CRITICAL prompt-override/ignore-instructions     ← agent hijack
CRITICAL supply-chain/curl-pipe-shell            ← remote code via shell
CRITICAL destructive/rm-root                     ← wipes $HOME
CRITICAL supply-chain/hallucinated-package       ← npx name doesn't exist on npm
HIGH     hidden-unicode/zero-width               ← orders humans can't see
HIGH     exfil/outbound-with-secrets             ← data theft channel

score 0/100  F  REJECT  (safety gate: critical finding)
```

Exit code `1` stops the merge. That's the whole CI story.

## How the score works

Transparent deductions — no black box:

| Finding severity | Deduction |
|---|---|
| critical | −25 **and caps the whole score at 40 → `reject`** |
| high | −12 |
| medium | −5 |
| low | −2 |
| info | 0 |

| Score | Grade | Verdict |
|---|---|---|
| 90–100 | A | ✅ ship |
| 80–89 | B | ✅ ship |
| 75–79 | C | ✅ ship |
| 60–74 | D | 🛠 revise |
| 50–59 | F | 🛠 revise |
| < 50 | F | ⛔ reject |
| any critical | capped ≤ 40 | ⛔ reject (safety gate) |

**The safety gate is the headline:** one critical finding and no amount of polish can save the score. Security is not a rounding error.

## What it checks

| Category | Examples | Severity |
|---|---|---|
| Prompt injection | instruction-override phrasing, "do not tell the user" secrecy, injected instruction blocks, guardrail disabling | critical / high |
| Obfuscation | zero-width characters, bidi controls (Trojan Source), homoglyph spoofing, decode-and-run payloads | high / medium |
| Secrets | hardcoded AWS/GitHub tokens, private keys, access to `~/.ssh`, `.aws/credentials` | critical / high |
| Exfiltration | outbound network calls combined with secret material in the same file | high |
| Supply chain | `curl`-piped-to-shell, download-and-execute, **hallucinated `npx`/`pip` package names** (`--online`) | critical |
| Destructive | recursive deletes of `/` or `$HOME`, force-push instructions | critical / low |
| Spec compliance | missing/invalid frontmatter, bad `name`, missing or vague `description`, name≠directory, oversized body, broken file references | high / medium |
| Dangerous code | `eval()`, `exec()`, `shell=True`, `new Function()` | medium |

### The anti-slopsquatting flag

```bash
npx skill-crucible check . --online
```

Resolves every `npx` / `pip install` package name against the real registry.
A **404 means the package doesn't exist** — an attacker can claim that name tomorrow, and every machine running the skill executes whatever they publish under it.

## Your badge

```bash
npx skill-crucible check . --format json -o report.json --badge badge.svg
```

```markdown
![skill crucible](https://raw.githubusercontent.com/YOUR_USER/YOUR_REPO/main/badge.svg)
```

The SVG renders **locally — no server, no account, no telemetry**. Same mechanism that put `codecov` badges on millions of READMEs, pointed at the thing nobody was measuring.

## CI in 10 seconds

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
          fail-on: high
          online: "true"
      - if: always()
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: crucible.sarif
```

Findings land as inline PR annotations in GitHub's Security tab (SARIF output), plus a job summary with the score.

## Install this as a skill

The repo ships its own `SKILL.md`, so any skill-capable agent can audit skills with it:

```bash
npx skills add Dikaaff/skill-crucible
```

or manually copy [`SKILL.md`](SKILL.md) into `.claude/skills/skill-crucible/`.

Then just ask your agent: *"vet this skill before I install it."*

## How it fits next to the scanners

| | **skill-crucible** | SkillSpector / Cisco skill-scanner |
|---|---|---|
| Job | **Evidence**: score, gate, badge | **Threat hunting**: deep malware analysis |
| Output | grade + verdict + SVG badge + SARIF | SARIF + vulnerability reports |
| Runtime | milliseconds, offline by default | heavier; optional LLM/API passes |
| Best for | proving quality, policy in CI, README trust signals | chasing novel attack techniques |

They're complementary: **scan** with the deep tools, **prove** with Crucible. Suggestions for rule coverage are welcome via issues/PRs.

## CLI reference

```
crucible check [path...]     scan skills (file, folder, or many)
crucible badge report.json   render badge SVG from a report

  -f, --format <text|json|sarif>   output format (default: text)
  -o, --output <file>              write report to a file
      --fail-on <level>            critical|high|medium|low|info|none (default: high)
      --online                     verify package names against npm/PyPI
      --badge [file]               also write a badge SVG
      --no-color                   disable ANSI colors

Exit codes: 0 clean · 1 findings at/above --fail-on · 2 usage error
```

## Limitations

Honest scope: this is fast **static analysis, not a sandbox**. It never executes what it scans. Pattern matching means false positives are possible (a legitimate skill documenting `curl`) and novel obfuscation can pass. Use it as the first gate in seconds — not the last word in security.

## Roadmap

- [ ] **Lift evaluation** — A/B tasks with and without the skill, measured delta (ACES methodology, made affordable)
- [ ] **Trigger accuracy** — does the description fire when it should, and stay quiet when it shouldn't?
- [ ] **State of Skills** — monthly scan of thousands of public skills, published openly
- [ ] **Public badge registry** — verified scores at a glance

## Contributing & license

Issues, rules, and false-positive reports all welcome — the rule set grows with the attack surface.

MIT © [Dikaaff](https://github.com/Dikaaff)
