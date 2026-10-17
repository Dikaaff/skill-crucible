# Contributing

Thanks for helping make agent skills safer to install.

## Setup

- Node.js 20 or newer
- No build step, no dev dependencies

```sh
git clone https://github.com/Dikaaff/skill-crucible
cd skill-crucible
npm install
npm test
```

## Project layout

```
bin/crucible.js        CLI entry point
src/discover.js        finds SKILL.md files
src/frontmatter.js     frontmatter parsing
src/checks/            rule sets: structure, security, packages
src/score.js           scoring + safety gate
src/report/            text, json, sarif, badge renderers
test/fixtures/         good, malicious, and broken skills used by tests
```

## Adding a rule

1. Add the rule to the right module in `src/checks/`.
2. Give it a stable `id` in `category/name` form (for example `exfil/outbound-with-secrets`), a severity, and a message that explains how to fix it.
3. Add a test in `test/` that fails without the rule and passes with it.
4. Run `npm test` and `npm run selfcheck` (the repository's own SKILL.md must stay at 100/100).

Guidelines:

- Keep rule regular expressions ASCII-only. Use escape sequences for non-ASCII matching so the source file stays pure ASCII.
- Prefer precise patterns over broad ones. A false positive on a legitimate skill costs more than a missed low-severity finding.
- Never execute or import scanned content. The scanner is static only.

## Pull requests

- One topic per pull request.
- Include the failing fixture or test that demonstrates the problem.
- Keep the diff ASCII-only and update `README.md` if behavior or the CLI surface changes.

## Questions

Open a discussion or an issue. Security reports go through [SECURITY.md](SECURITY.md), never a public issue.
