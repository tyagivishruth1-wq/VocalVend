# VocalVend online backend

This is the Cloudflare Workers-compatible backend. It is independent of the local Node/SQLite server. Node.js 24 or newer is required for the test suite.

From the repository root:

```powershell
npm --prefix cloud ci
npm --prefix cloud test
```

Installation runs the preparation script, which generates frontend assets, shared validation/calculation code and the sample catalogue from the root source files. These outputs are ignored by Git.

The database schema is in db/schema.ts, and all additive migrations and metadata are in drizzle/. Do not modify migrations already applied to a database. Deployment commands are documented in ../cloudflare/README.md.
