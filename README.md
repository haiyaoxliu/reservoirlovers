# 🏃 Reservoir Lovers

A private tracker for a run club: how many times has each member run the Central
Park Reservoir loop? Members connect Strava; each completed loop is counted
automatically. The home page shows a leaderboard (loop count + fastest-loop PR)
and a horizontally-swipeable timeline with a dot at every loop completion.

## How it works

- **Auth**: invite link → Strava OAuth → year-long signed session cookie. Strava
  is the only login. New members need a one-time invite; after that they can
  reconnect on any device.
- **Ingestion**: one Strava webhook pings us on every new/edited/deleted
  activity. We ACK immediately and process in the background (`waitUntil`).
- **Scoring**: a cheap pre-filter (summary polyline near the reservoir?) gates a
  GPS-streams fetch. The streams run through a pure state-machine matcher
  (`src/loop/matcher.ts`) that counts loop travel **from any start point and
  either direction**, with hysteresis against GPS jitter and a median-cross-track
  guard so the parallel bridle path never earns credit. The canonical loop
  geometry is **seeded from the Strava segment's own polyline** (see below) — no
  hand-recorded lap needed. Whole loops are counted; the engine also tracks each
  lap's time for a fastest-loop PR.
- **Why not Strava segment efforts?** Loop segments only register when you start
  *and* finish at the segment's exact origin point — start elsewhere and a single
  lap counts as zero, and multi-lap runs come up one short. The matcher avoids
  that by tracking cumulative travel around the loop regardless of where you
  begin. We still use the segment — for its geometry, not its efforts.
- **Storage**: only *derived* loop events (completion time + loop duration) are
  stored, not raw GPS.

## Local development

```bash
npm install
cp .env.example .env.local     # then fill in the values (see below)
npm run build:loop             # seed src/loop/canonical-loop.json (see below)
npm test                       # matcher + prefilter unit tests
npm run dev                    # http://localhost:3000
```

### Seeding the canonical loop

The matcher needs the loop's geometry as `src/loop/canonical-loop.json`. Instead
of recording a lap, `npm run build:loop` fetches the reservoir **segment's own
polyline** from Strava and resamples it. It needs a token — either
`STRAVA_ACCESS_TOKEN` (grab one from your app's API settings page) or a connected
user in the DB. Without a token it writes a *synthetic* placeholder (fine for
tests, wrong geometry) and warns you. Run it for real once before launch and
commit the result; the segment geometry is stable, so it rarely changes.

### Environment variables

All are listed in `.env.example`. Generate the two secrets with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))" # TOKEN_ENC_KEY
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"    # SESSION_SECRET
```

## First-time setup

### 1. Neon (Postgres)

- Create a project at [neon.tech](https://neon.tech) (free tier is plenty).
- Copy the **pooled** connection string into `DATABASE_URL`.
- `npm run db:generate` (already committed as `drizzle/0000_*.sql`) then
  `npm run db:migrate` to create the tables.

### 2. Strava app

- You need an **active Strava subscription** ($11.99/mo) to own an API app
  (required since June 30 2026). Only *you* need it — friends connect for free.
- Create the app at [strava.com/settings/api](https://www.strava.com/settings/api).
  Set **Authorization Callback Domain** to `reservoirlovers.nyc` (and add
  `localhost` for dev).
- Copy Client ID / Secret into `STRAVA_CLIENT_ID` / `STRAVA_CLIENT_SECRET`.
- In the API dashboard, **self-upgrade to the 10-athlete Standard tier** (instant,
  no review). Beyond 10 friends, submit the app for review.
- Put your own athlete id in `ADMIN_ATHLETE_ID` to get the `/admin` invite page.

### 3. Vercel + domain

- Import the repo at [vercel.com](https://vercel.com) (framework auto-detected).
- Add every variable from `.env.example` in Project → Settings → Environment
  Variables. Set `SITE_URL=https://reservoirlovers.nyc`.
- Deploy. The daily reconciliation cron in `vercel.json` runs automatically.

#### Point reservoirlovers.nyc at Vercel

The domain is registered but has no DNS yet. Easiest path — let Vercel run DNS:

1. Vercel → Project → Settings → Domains → add `reservoirlovers.nyc` (accept the
   `www` redirect it offers).
2. Vercel shows two nameservers (`ns1.vercel-dns.com`, `ns2.vercel-dns.com`).
3. At your registrar, replace the default nameservers with those two.
4. Wait for the Domains page to show **Valid Configuration** (minutes to hours);
   HTTPS is provisioned automatically.

*(Alternative, if you keep DNS at the registrar: apex `A` → `76.76.21.21`,
`www` `CNAME` → `cname.vercel-dns.com`.)*

### 4. Webhook subscription (after the site is live)

Strava validates the callback synchronously, so the site must be deployed first.

```bash
# with the deployed env values loaded locally:
npm run webhook:subscribe            # create
npm run webhook:subscribe -- list    # verify
```

### 5. Invite yourself and backfill

- Visit `/admin`, create an invite, open its link, connect Strava.
- Backfill your history: `npm run backfill -- <yourAthleteId>` (or `npm run
  backfill` for everyone). Re-run if it stops on a rate limit.

## Tuning the matcher

Every threshold lives in `src/loop/constants.ts` with rationale — how far a run
may drift from the segment centerline (`ENTER_M` / `EXIT_M`), the median-drift
ceiling that keeps the bridle path out (`MAX_MEDIAN_D_M`), jitter hysteresis,
gap-bridging, and so on. They're tuned against noise fixtures in
`test/matcher.test.ts`; loosen if real runs get rejected, tighten if bridle laps
sneak in.

`RESERVOIR_SEGMENT_ID` (default `852256`) only picks which segment's polyline
seeds the geometry — direction is irrelevant since the matcher is
direction-agnostic. After changing any constant, bump `ALGO_VERSION`; the
reconciliation cron / backfill will reprocess activities and rewrite their loop
events (the pipeline is idempotent — events are always wiped before re-insert).

## Scripts

| Command | What |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm test` | matcher + prefilter unit tests |
| `npm run build:loop` | seed the canonical loop from the Strava segment polyline |
| `npm run db:generate` / `db:migrate` | Drizzle migrations |
| `npm run backfill [athleteId]` | process historical activities |
| `npm run webhook:subscribe [-- list\|delete <id>]` | manage the Strava webhook |

## Note on Strava's terms

Strava's API agreement restricts showing one athlete's data to other users. This
app does that (a shared leaderboard) knowingly, for a small consenting friend
group, storing only derived counts. Worst case is Strava revoking API access.
Keep it private and invite-only.
