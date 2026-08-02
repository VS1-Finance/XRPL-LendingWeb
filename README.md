# XRPL Permissioned Lending — Web App

The front end for the [XRPL Permissioned Lending reference implementation](https://github.com/VS1-Finance/XRPL-LendingReference): a browser UI for provisioning a credential-gated lending market on the XRP Ledger, taking any participant role yourself, and watching deterministic bots keep the market alive around you.

It is a [Next.js](https://nextjs.org) app that talks to the lending engine over HTTP — or runs entirely against an in-memory mock, so the UI is fully reviewable with no engine running.

## Running

```bash
pnpm install
pnpm dev
```

Then open <http://localhost:3000>. With no configuration, the app uses the in-memory mock engine — every screen and flow works, backed by fake data.

## Connecting to a live engine

The client picks its backend from two environment variables (`lib/client.ts`):

| Variable | Effect |
|----------|--------|
| `NEXT_PUBLIC_USE_ENGINE` | When set, the app talks to a real engine via the same-origin `/api/engine` proxy (no CORS). |
| `NEXT_PUBLIC_ENGINE_URL` | An explicit engine base URL, if you want to bypass the proxy. |

If neither is set, the app falls back to the in-memory mock. This is the default for local review.

To run against a live engine locally, start the [engine](https://github.com/VS1-Finance/XRPL-LendingReference) on port 4000 and set `NEXT_PUBLIC_USE_ENGINE=1` (the `/api/engine` proxy forwards to it).

## Documentation

Full protocol and architecture documentation lives in the [reference docs](https://github.com/VS1-Finance/XRPL-LendingDocs).

## License

Licensed under the Apache License, Version 2.0. See [LICENSE](LICENSE).
