# VocalVend

A local procurement app with a Node.js backend and a SQLite database. Requires Node.js 24 or newer; no dependency installation is needed.

## Online testing

New Cloudflare testing address: https://vocalvend.vocalvend-market.workers.dev

Testers create a new account on the site. The hosted copy has its own cloud database and sample inventory; local accounts and orders are not uploaded. Anyone can open the link, but orders, reviews, inventory editing and promotions require account login. Sponsored checkout is still simulated and charges no money. The four sample wholesale businesses can each be linked to one wholesaler account.

The `cloud/` directory contains the hosting implementation and schema migrations. Your original Node/SQLite version below continues to work independently. Cloud publishing uses a Workers-compatible API and D1 database rather than uploading a local SQLite file.

The independent Cloudflare entrypoint and configuration are in `cloudflare/`. This deployment has its own D1 database; accounts from the previous testing address do not transfer automatically. Your Cloudflare account owns the deployment. It uses Workers Free/D1 included quotas, not a paid plan configured by this project.

## Run

From this project folder, run `npm start` (or `node server.cjs`), then open **http://127.0.0.1:4173**. Use the server URL instead of opening `dist/index.html` directly. Set the `PORT` environment variable if that port is occupied.

Choose **Create an account** on the login screen. Vendor accounts browse and place orders. Wholesaler accounts select one of the four fictional businesses and manage only its inventory. A sample business can belong to one account. This local onboarding does not verify a real business identity.

## Backend features

- Email/password registration and login; salted scrypt password hashes and HttpOnly session cookies. Logout revokes the session.
- Shared inventory with server-validated price and stock updates.
- Voice search resolves product aliases across English, Hindi, Marathi, Tamil and Telugu, including common transliterations. Recognized speech opens the market, clears category filters and scrolls to matching supplier listings. The browser's speech recognizer still uses the selected spoken language; product matching is independent of the interface language.
- Wholesalers can add products across 11 categories, including groceries, dairy, spices, drinks, packaging and cleaning supplies. Selling units support kilograms, litres, packs and pieces; existing listings retain their data.
- Account-specific orders; wholesalers can view orders for their business.
- Transactional stock deduction; order totals computed on the server. Delivery = ₹20 base + distance charge (₹8/km, rounded up) + estimated load charge (₹2/kg, rounded up) + handling charge. Handling: Standard ₹0, Fragile ₹15, Perishable ₹10, Bulky ₹20. Pickup adds ₹0. Wholesalers can edit estimated weight per selling unit and handling type; supplier distances are sample values, not live routing. Existing saved order totals are preserved.
- Mark received and leave one review per order. Reviews update supplier ratings.
- Reviews require only an overall rating. Written experience, downsides, product quality, order accuracy, value, communication, timing and recommendation are optional. Vendors and the relevant wholesaler can read the saved feedback in the order.
- Private order chat becomes available as soon as an order is placed. Only the purchasing vendor and that supplier's wholesaler account can read or send messages. Messages are stored in the database and the open chat checks for new messages every four seconds. There are no background push notifications. If the wholesaler has not joined, the vendor's messages remain saved for that future account.
- Wholesaler sponsored campaigns: illustrative ₹199 for 7 days, with an explicit **demo checkout that charges no money**. Campaigns persist in SQLite, can target a category, expire automatically, and can be stopped. Recommended results have at most two boosted listings from distinct sponsors; explicit price, delivered-total, distance and rating sorting remain unchanged. Reviews and trust ratings are independent. Real payments require a payment provider and verified payment webhooks before activation.
- Data persists in `data/vocalvend.sqlite`, including across server restarts. Sessions expire after seven days.

Favourite wholesalers, the shopping checklist, and the preferred language remain browser-local. Old browser-only orders and accounts are not migrated. Stock and order totals are now controlled by the backend.

## Tests

`npm test` runs API and frontend integration checks using a temporary database, including login, authorization, stock limits, pickup/delivery pricing, reviews, and persistence after restart. `node verify-i18n.cjs` verifies translation dictionaries. `node verify-extras.cjs` checks the checklist and saved-supplier controls.

## API

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Health check |
| GET | `/api/products`, `/api/wholesalers` | Public sample catalogue |
| POST | `/api/auth/register`, `/api/auth/login`, `/api/auth/logout` | Account and session actions |
| GET | `/api/auth/me` | Current account |
| GET / POST | `/api/orders` | List permitted orders / place a vendor order |
| POST | `/api/orders/:id/receive`, `/api/orders/:id/review` | Receive / review an owned order |
| PATCH | `/api/products/:id` | Update an owned wholesaler listing |

## Scope

The server binds to this computer's loopback address. It is a local academic application with fictional suppliers; orders are database records, not real purchases. Payments, notifications, verified supplier onboarding, password reset, and delivery tracking are not implemented. Internet hosting would need HTTPS and an appropriate backend host; the previous static Sites manifest does not run this Node server.


Wholesaler demo onboarding: wholesalers can log in immediately, but must complete Business verification before adding or editing stock. Fill in sample business details, download the two dummy TXT templates, and upload them with the sample-data consent. Submission automatically unlocks stock in this prototype. This is not real identity verification; do not upload actual identity documents. The backend enforces the requirement and keeps submissions private to their owner.

Regional price chart: vendor market searches populate a supply selector and compare available same-name/same-unit listings within 1, 3 or 5 km of the sample Pune market. The chart shows one lowest listing per wholesaler, median, range and supplier count, with a limited-sample notice below three suppliers. Sample distances are not live geolocation, and delivery is excluded.
