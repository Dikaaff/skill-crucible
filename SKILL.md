---
name: skill-crucible
description: Audit any agent skill before trusting it — produces a 0-100 quality and security score for SKILL.md folders. Use when asked to check, vet, review, score, or audit a skill, or before installing third-party skills from a marketplace or GitHub.
license: MIT
---

# skill-crucible

You are auditing an agent skill. Produce evidence, not vibes.

## When this applies

- The user asks to check, vet, score, review, or audit an agent skill
- A third-party skill is about to be installed from a marketplace, GitHub, or a shared folder
- The user wants CI gating or a README badge for their own skills

## Procedure

1. Run the scan:

   ```bash
   npx skill-crucible check <path-to-skill-folder>
   ```

   Useful flags:

   - `--online` — verify every `npx`/`pip install` package name against the real
     registry (catches hallucinated package names an attacker could claim)
   - `--format json -o report.json` — machine-readable report
   - `--fail-on high` — exit 1 at the chosen severity, for CI gates

2. Interpret the score:

   - **90+ (A)** and verdict `ship` — skill is structurally sound, no findings worth blocking
   - **75–89 (B)** — ship after reviewing medium findings
   - **50–74 (C)** — revise: weak description, oversized body, or medium-risk patterns
   - **below 50 (F)** or verdict `reject` — do not install or publish yet

3. The safety gate: **any critical finding caps the score at 40 and forces
   `reject`**. Criticals include prompt-override phrasing, download-piped-to-shell,
   destructive filesystem commands, hardcoded secrets, and package names that do
   not exist on the registry. Treat a critical as a hard stop.

4. Report to the user:
   - score, grade, and verdict
   - every critical and high finding with file and line
   - for criticals: recommend not installing the skill until fixed

5. To publish a badge for a skill the user owns:

   ```bash
   npx skill-crucible check . --format json -o report.json --badge badge.svg
   ```

   Then reference `badge.svg` from the repository README.

## Limitations to state honestly

This is fast static analysis, not a sandbox. It never executes what it scans.
False positives are possible; novel obfuscation can pass. For deep inspection,
pair it with a dedicated scanner such as NVIDIA SkillSpector.
