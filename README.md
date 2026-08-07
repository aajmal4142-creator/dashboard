# ClearESG

ESG / carbon accounting dashboard — Next.js, Payload CMS, Clerk, MongoDB.

## Docs (keep this set small)

| Doc                                                                              | Purpose                                       |
| -------------------------------------------------------------------------------- | --------------------------------------------- |
| [`PLATFORM_OVERVIEW.md`](PLATFORM_OVERVIEW.md)                                   | Product summary, stack, pricing               |
| [`seed.md`](seed.md)                                                             | Seed / metric registry notes                  |
| [`docs/LAUNCH_DECISIONS.md`](docs/LAUNCH_DECISIONS.md)                           | Workstream 0 gates (billing, region, consent) |
| [`docs/embed-csp.md`](docs/embed-csp.md)                                         | Report embed CSP                              |
| [`src/lib/webhooks/API_DOCUMENTATION.md`](src/lib/webhooks/API_DOCUMENTATION.md) | App API / webhooks                            |
| [`.cursor/rules/clearesg.mdc`](.cursor/rules/clearesg.mdc)                       | Binding design / auth / calc rules for agents |

## Getting started

```bash
pnpm install
cp .env.example .env.local   # fill Clerk, Mongo, Payload secrets
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

```bash
pnpm seed                  # optional demo data
pnpm build                 # production check
pnpm test                  # vitest (suites may be empty until restored)
```

Requires Node ≥ 20.9 and pnpm ≥ 9.

## Agents

- `AGENTS.md` / `CLAUDE.md` — Next.js version note
- Cursor rules — `.cursor/rules/clearesg.mdc`
