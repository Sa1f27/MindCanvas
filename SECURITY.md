# Security

## Reporting a vulnerability

Please report it privately through GitHub: the **Security** tab of this repository, then **Report a
vulnerability**. Do not open a public issue. You can expect a first answer within a week.

## How secrets are handled

- Secrets live only in environment variables or in a local `.env` file, which is gitignored. `.env.example`
  documents every variable with a placeholder.
- Every push and pull request is scanned for secrets across the whole history by
  [gitleaks](https://github.com/gitleaks/gitleaks) in CI, and the same scan runs before each commit through the
  pre-commit hook in `.pre-commit-config.yaml`.
- Findings in old commits that were assessed and are not usable secrets are listed by fingerprint, with the
  reason, in `.gitleaksignore`. A fingerprint names the commit, file, rule and line; it contains no secret.
- If a real secret is ever committed, it is revoked at its provider first. Rewriting history alone does not make a
  published secret safe.
