# PIXELPIX

PIXELPIX is an interactive grid of one million stable cells that users can reserve, pay to reveal, and optionally sign publicly.

## Run & Operate

- `pnpm --filter @workspace/pixelpix run dev` — run the PIXELPIX frontend
- `PORT=20368 BASE_PATH=/admin/ pnpm --filter @workspace/pixelpix-admin run dev` — run the separate PIXELPIX Admin console
- `pnpm --filter @workspace/api-server run dev` — run the API server
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/scripts run generate-winning-positions` — generate the immutable, committed prize-tier positions once
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required runtime: Replit's managed PostgreSQL database (`DATABASE_URL`)
- Optional webhook secret: `WEBHOOK_SECRET` for signed payment webhooks
- Admin access: set `ADMIN_ACCESS_KEY` for production requests to `/api/admin/*`; development permits local access without a key

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/pixelpix` — responsive virtualized grid and reveal/payment flow
- `artifacts/pixelpix-admin` — separately hosted operations console for prize balances, cash movement, prize-pool integrity, and redemption processing
- `artifacts/api-server` — cell range, reservation, checkout, webhook, and expiration endpoints
- `lib/db/src/schema/index.ts` — sparse cell, prize-tier, payment, webhook audit, and cash-ledger schema
- `scripts/src/generate-winning-positions.ts` — one-time cryptographic prize-position generator
- `attached_assets/Pasted--Arquitetura-Grid-de-1-Milh-o-de-C-lulas-com-Reserva-Pa_1786500082119.txt` — detailed architecture source document

## Architecture decisions

- Cell ids are stable logical ids from `0` to `999999`; responsive visual columns never change the id.
- Cells are sparse: an absent row is available, while expired reservations are normalized back to available.
- Reservation tokens stay in POST bodies and are the temporary proof of ownership without requiring accounts.
- Prize positions are generated once, committed with a SHA-256 hash, and consumed transactionally on confirmed payment.
- Cash movements use an append-only ledger with idempotent revenue and prize-payout entries.

## Product

Users browse a responsive one-million-cell grid, open cell details, reserve an available cell for five minutes, complete the development checkout flow, reveal the server-confirmed result, and optionally attach an Instagram or X signature.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Do not run the winning-position generator more than once for the same database; it aborts if the batch already exists.
- The generator validates that tier quantities fit the grid and that the configured pool closes exactly at its fixed ceiling before writing.
- The API workflow requires the managed database to be available; the local checkout simulator is disabled in production.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
