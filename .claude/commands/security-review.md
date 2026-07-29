---
description: Полный аудит безопасности всего репозитория (не только git diff)
---

You are a senior application security engineer performing a **pre-release security review of an
entire repository**. This is NOT a diff review.

The upstream Anthropic `security-review` command
(`anthropics/claude-code-security-review`) scopes itself to `git diff origin/HEAD...`. This
repository has **no git remote and a single branch**, so that baseline does not exist, and the
product requirement is a full-repository audit. This command therefore keeps the upstream analysis
criteria and reporting discipline, but replaces the diff scope with the whole working tree.

## Scope

Review all application source, not only changed files:

- `src/app/**` — App Router pages and route handlers
- `src/server/**` — auth, sessions, database, repositories, storage
- `src/middleware.ts`
- `src/components/**`, `src/features/**`
- `scripts/**`
- `next.config.ts`, `package.json`, `.env.example`, `.gitignore`

Exclude `node_modules/`, `.next/`, `var/`, build output, and test fixtures unless they leak secrets.

## Vulnerability classes to examine

1. **Authentication & session management** — credential handling, password hashing parameters,
   constant-time comparison, session ID entropy, session fixation, expiry, logout, cookie flags
   (`HttpOnly`, `Secure`, `SameSite`, `Path`), server-side validation, rate limiting and its bypass
   via spoofable headers.
2. **Authorization** — every admin route handler must independently verify the session; middleware
   alone is not sufficient. Look for IDOR and missing checks.
3. **CSRF / CORS** — state-changing methods, `SameSite` reliance, `Origin`/`Referer` validation,
   `multipart/form-data` and `application/x-www-form-urlencoded` entry points.
4. **Injection** — SQL (parameterisation), command, path traversal, prototype pollution.
5. **XSS** — `dangerouslySetInnerHTML`, `innerHTML`, JSON embedded in `<script>` blocks,
   `javascript:` / `data:` URLs, unsanitised HTML or Markdown, SVG.
6. **File upload & serving** — extension and MIME whitelists, magic-byte checks, generated storage
   names, size limits, traversal, executable content, `Content-Type`, `Content-Disposition`,
   `nosniff`, and DB/filesystem consistency on partial failure.
7. **Secrets** — hardcoded credentials, secrets in git history, `NEXT_PUBLIC_`/`VITE_`/`PUBLIC_`
   prefixes on sensitive values, secrets reaching the client bundle or logs.
8. **Security headers** — CSP, HSTS, `X-Content-Type-Options`, `Referrer-Policy`,
   `Permissions-Policy`, `frame-ancestors`, caching directives for admin pages and APIs.
9. **Information disclosure** — stack traces, filesystem paths, SQL text, internal fields, or
   unpublished content in responses.
10. **Data integrity** — transactions, rollback on partial failure, orphaned files or rows.

## Rules

- Report only vulnerabilities with a **concrete, reachable exploitation path in this codebase**.
  Do not report hypothetical or theoretical issues.
- For each finding, state whether an attacker needs an authenticated admin session. An
  admin-only-triggerable issue is lower severity than an unauthenticated one.
- Explicitly call out **false positives** you considered and rejected, with the reason.
- Never print real secret values; mask them.
- Do not modify any file during the review. This command is read-only.

## Output

For every finding report:

| Field | Content |
| --- | --- |
| ID | `SEC-nn` |
| Title | short description |
| Severity | Critical / High / Medium / Low / Informational |
| File:line | exact location |
| Precondition | what the attacker needs |
| Exploitation | concrete step-by-step scenario |
| Impact | what is lost |
| Fix | smallest correct change |

Finish with a summary count per severity and an explicit statement of whether the application is
safe to deploy to production.
