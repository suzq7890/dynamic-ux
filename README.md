# Appliance Price Tracker

Tracks appliance prices across retailer websites, alerts you by email on
sales and price trends, stores history, and gives you a dashboard to browse
today's prices and historical data. Seeded to track the **Frigidaire
Gallery 30" Freestanding Gas Range (Model #GCFG3070BF)** — the premium
Gallery-series gas range, not the base model — across Lowe's, Home Depot,
Best Buy, and Frigidaire's own site. You can add more items from the UI.

## How it's built

This is a small monorepo with four npm workspaces:

| Package | What it does |
|---|---|
| `packages/shared` | Prisma schema/client (Postgres), price-extraction logic, trend detection, price prediction (linear regression), email sending |
| `packages/scraper` | Playwright-based site adapters + the daily check script run by GitHub Actions |
| `packages/api` | Express REST API backed by the shared Prisma client |
| `packages/web` | React (Vite) dashboard: today's prices, historical charts, add-item form |

**Scheduling**: a GitHub Actions workflow (`.github/workflows/daily-price-check.yml`)
runs the scraper daily at 7:00am CST (13:00 UTC) via `cron`. GitHub Actions
cron doesn't observe DST, so during Central Daylight Time (roughly
mid-March–early November) it'll actually fire at 8:00am local time — see the
comment in that file if you'd rather adjust for that.

**Storage**: an external Postgres database (Neon, Supabase, Railway, RDS,
etc. all work) shared by the GitHub Actions scraper and the API server.

**Email**: Gmail SMTP via an App Password.

## Important caveats about the scraping

Lowe's, Home Depot, and Best Buy all run bot-detection in front of their
sites (Akamai/PerimeterX-style challenges), and none of this could be
verified against the live sites from the environment this was built in.
The extraction strategy is built to be as robust as reasonably possible:

- It parses embedded `schema.org/Product` JSON-LD and `product:price:amount`
  / `og:price:amount` meta tags first — most major retail sites embed this
  for SEO, and it's far more stable than scraping visible DOM/CSS.
- "Was" price / sale detection falls back to scanning visible page text for
  patterns like "Was $X" or "N% off", which is fuzzier.
- If a site blocks the request or changes its layout, that single check is
  logged as a failed `PriceCheck` (visible in the UI) instead of crashing
  the whole run or silently gapping the history.

**What you should expect to do after this is deployed:**
1. Open each tracked item in the UI and paste the **exact product page URL**
   for each site (Lowe's/Home Depot/Best Buy/Frigidaire product pages,
   confirming it's the gas range, Gallery/premium version, model
   GCFG3070BF — not the base model or the electric version). Auto
   search-based URL resolution is attempted as a fallback but is
   noticeably less reliable than a pasted URL.
2. After the first few real runs, check the dashboard for "check failed"
   badges and, if a site is consistently failing, expect to need to
   adjust the selectors/patterns in `packages/shared/src/priceExtractor.ts`
   or `packages/scraper/src/sites/*.ts`.
3. Be aware that scraping some of these sites at automated, regular
   intervals may be against their terms of service — this is intended for
   personal, low-frequency (daily) price tracking of items you're
   personally interested in buying.

## Setup

### 1. Create a Postgres database

Any hosted Postgres works (e.g. [Neon](https://neon.tech) or
[Supabase](https://supabase.com) both have generous free tiers and give you
a `DATABASE_URL` immediately). Copy that connection string.

### 2. Create a Gmail App Password

In your Google Account → Security → 2-Step Verification → App Passwords,
create a new app password. Use your Gmail address as `GMAIL_USER` and the
generated 16-character password as `GMAIL_APP_PASSWORD`.

### 3. Configure local environment

```bash
cp .env.example .env
# edit .env: DATABASE_URL, GMAIL_USER, GMAIL_APP_PASSWORD, ALERT_EMAIL_TO
set -a && source .env && set +a
```

### 4. Install dependencies and set up the database

```bash
npm install
npm run db:generate
npm run db:migrate     # applies the schema to your Postgres database
npm run db:seed        # creates the Frigidaire GCFG3070BF tracked item
```

### 5. Run the API and web dashboard locally

```bash
npm run api:dev     # http://localhost:4000
npm run web:dev      # http://localhost:5173 (proxies /api to :4000)
```

Open http://localhost:5173, open the seeded item, and paste in the product
URLs for each site.

### 6. Run a price check manually

```bash
npx playwright install --with-deps chromium   # first time only
npm run scrape
```

This is exactly what the GitHub Actions workflow runs daily. Check the
dashboard afterward for results, and check your inbox if any tracked item
came back on sale or showed a new trend.

## Deploying

### GitHub Actions (daily scraper) — required

In your repo's **Settings → Secrets and variables → Actions**, add:

- `DATABASE_URL`
- `GMAIL_USER`
- `GMAIL_APP_PASSWORD`
- `ALERT_EMAIL_TO`

The workflow in `.github/workflows/daily-price-check.yml` runs on schedule
automatically once these are set, and can also be triggered manually from
the Actions tab (`workflow_dispatch`).

### API + web dashboard — deploy anywhere that runs Node

These aren't tied to GitHub Actions and need a normal host. Any of
Render, Railway, Fly.io, a VPS, etc. work. General shape:

- **API** (`packages/api`): `npm run build --workspace=packages/shared && npm run build --workspace=packages/api`,
  then run `node packages/api/dist/server.js` with `DATABASE_URL` and `PORT`
  set.
- **Web** (`packages/web`): `npm run build --workspace=packages/web` produces
  a static site in `packages/web/dist` — deploy it to any static host
  (Netlify, Vercel, Render static site, S3+CloudFront, etc.), setting
  `VITE_API_BASE_URL` at build time to your deployed API's URL.

Both just need network access to the same Postgres database the GitHub
Actions workflow writes to.

## Using the app

- **Today's prices** (`/`): every tracked item, one row per site, with sale
  and trend badges and a link to the live product page.
- **Item detail** (`/items/:id`): price history chart per site, recent trend
  alerts, and the current price prediction, plus inline editing of each
  site's product URL and an enable/disable toggle per site.
- **Add Item** (`/add`): name, model number, notes, and which sites to
  check — with an optional product URL per site (recommended for
  reliability).

## How trends and predictions work

- **Trend detection** looks at the last 14 days of successful price checks
  per item/site. A ≥3% move over that window is classified RISING or
  FALLING; high day-to-day volatility with no clear direction is VOLATILE.
  Each trend type re-alerts at most once per 7 days per item/site to avoid
  spamming you while a trend continues.
- **Prediction** is an ordinary-least-squares linear regression over up to
  90 days of price history, projected forward 7/14/30 days. This is a
  simple trend projection, not a real forecasting model — it assumes the
  recent trajectory continues linearly and will miss step-change events
  like a new sale starting. Confidence shown is the regression's R².
