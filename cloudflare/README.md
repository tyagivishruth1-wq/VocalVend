# Cloudflare deployment

This entrypoint runs VocalVend on Cloudflare Workers with its own D1 database at https://vocalvend.vocalvend-market.workers.dev. It reuses the tested cloud API and website assets. No paid plan or payment-provider integration is configured.

The database and schema are already provisioned in the connected account, and the real database ID is saved in `wrangler.jsonc`. For future updates, log in if necessary, apply any new migrations, then deploy:

```powershell
node cloud/node_modules/wrangler/bin/wrangler.js login
node cloud/node_modules/wrangler/bin/wrangler.js d1 migrations apply DB --remote --config cloudflare/wrangler.jsonc
node cloud/node_modules/wrangler/bin/wrangler.js deploy --config cloudflare/wrangler.jsonc
```

For future website changes, refresh the shared frontend assets by running `node prepare.mjs` inside `cloud/`, then deploy again. The new database starts with sample stock; existing accounts on the previous testing host are not imported. Testers create new accounts on the new address.
