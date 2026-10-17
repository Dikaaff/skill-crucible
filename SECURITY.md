# Security Policy

## Reporting a vulnerability

Please report security issues privately. Do not open a public issue for anything that could be exploited.

- Preferred: GitHub private vulnerability reporting on this repository (Security tab -> Report a vulnerability)
- Email: dikaindrawan35@gmail.com

Expect an acknowledgement within 72 hours and a fix or mitigation plan within 14 days. Please include a reproducible case (the `SKILL.md` content or the input that triggers the issue) and the version you tested.

## Scope

In scope:

- Bypasses of a detection rule that let a malicious finding slip through silently
- Regular expression denial of service (ReDoS) in the scanner
- Path traversal or unexpected file reads/writes by the CLI
- Anything that makes the CLI execute content from a scanned skill (it must never execute scanned content)
- Vulnerabilities in the published npm tarball

Out of scope:

- False negatives against novel obfuscation (documented limitation: the scanner is heuristic, not a sandbox)
- Findings that require the attacker to already control the machine running the scan
- Issues in third-party skills that this tool only reports on

## Design guarantee

`skill-crucible` reads text and matches patterns. It never executes, imports, or installs anything it scans. `--online` mode only performs HTTP HEAD/GET lookups against the official npm and PyPI registries to check whether a package name exists.

## Supported versions

The latest published version on npm receives security fixes.
