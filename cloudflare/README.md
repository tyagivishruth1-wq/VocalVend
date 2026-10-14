# Cloudflare deployment

VocalVend runs at https://vocalvend.vocalvend-market.workers.dev using Cloudflare Workers and D1. This folder's Worker imports the API and prepared website assets from ../cloud/. The local SQLite database is not uploaded.

## Publish an update

Open a terminal in the repository root with Node.js 24 or newer installed:

```powershell
npm --prefix cloud ci
node cloud/node_modules/wrangler/bin/wrangler.js login
npm --prefix cloud run db:migrate
npm --prefix cloud run deploy
```

Login is needed only if your Cloudflare session is not already authorized. Use the account that owns the configured Worker and D1 database. Deploy automatically refreshes website assets before publishing. Apply migrations before deploying changes that add database tables. The existing IDs in wrangler.jsonc refer to the owner's deployment; publishing under another account requires that account's Worker and D1 configuration. Account/database IDs are configuration, not API credentials.

For tests:

```powershell
npm test
npm --prefix cloud test
```

Payments and identity verification remain simulated. Never commit real documents, local databases, environment secrets or Cloudflare tokens.
