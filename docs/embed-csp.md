# Public report embed — origin allowlist & CSP

Applies to the two public, unauthenticated HTML report routes:

- `/r/html/:token` — direct share link (works with or without `?embed=1`)
- `/public/reports/embed/:token` — always-embedded iframe view

## Model

Each `ReportEmbedTokens` document carries:

- `allowedOrigins: string[]` — exact origins (`scheme://host[:port]`) permitted to iframe-embed
  this token, e.g. `https://investor.example.com`. Set when minting the token from
  **Share report → Embed code**.
- `theme: "light" | "dark" | "org"` — colour theme applied inside the frame. `"org"` resolves
  to the organisation's configured default mode (falls back to light).

**Empty allowlist = deny embedding everywhere.** The direct (non-framed) share link keeps
working regardless — the allowlist only governs framing.

## Enforcement (defense in depth)

1. **`Content-Security-Policy: frame-ancestors ...`** is set per-request in `src/proxy.ts`.
   It looks up the token's `allowedOrigins`, builds `frame-ancestors <origin> <origin> ...`,
   and falls back to `frame-ancestors 'none'` when the token is unknown or has no configured
   origins. This is a browser-enforced network-layer control — `next.config.ts` no longer sets
   a static, wide-open `frame-ancestors *` for these routes.
2. **Server-side Origin/Referer check** in `resolveReportShareToken`
   (`src/lib/reports/htmlReportShare.ts`): when the request is for an embedded render
   (`embedded: true`, i.e. `/public/reports/embed/:token` or `/r/html/:token?embed=1`), the
   `Origin` header (falling back to `Referer`) must match an entry in `allowedOrigins`.
   Denials return `{ ok: false, reason: "origin_denied" }`, are written to the audit log as
   `report.embed.denied`, and never increment the token's usage counter — only genuinely
   served renders count as access.

Both checks use the same pure helpers (`normalizeAllowedOrigins`, `buildFrameAncestorsHeaderValue`,
`isOriginAllowed` in `src/lib/reports/htmlReport.ts`) so the allowlist is interpreted identically
everywhere.

## UI

`ShareReportModal` requires at least one domain before showing an embed preview/code — with an
empty list it explains that embedding is denied until a domain is added, instead of rendering an
iframe that the browser will refuse to display. The direct share link tab has no such
restriction.

## Non-goals

- This is host-allowlisting, not a legal/compliance control. It does not replace token
  expiry/revocation as the primary access control — a leaked token used from an allowed
  origin is still valid.
- Wildcard/subdomain matching is intentionally not supported; add each origin explicitly.
