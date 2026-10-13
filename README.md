# Arcadia — Backend

REST API for Arcadia, a gamified learning platform where students join clubs, play mini-games,
climb seasonal leaderboards and win course discounts.

Built with Express 5, TypeScript, Prisma (PostgreSQL) and Clerk for authentication.
The web app lives in a separate repository: [Arcadia](https://github.com/Rajkumar0323/Arcadia).

## What it does

- **Auth** – verifies Clerk session tokens and keeps a local user record in sync
- **Clubs** – listing, joining and leaving, with per-club games, quests and leaderboards
- **Games** – six game types, graded on the server so answers never reach the browser before submission
- **Points** – speed bonus on timed games; only the best score per game per season counts
- **Quests** – bonus points for passing every game in a quest
- **Seasons** – ranked standings per club; ended seasons are finalized hourly and rewards issued to the top ranks
- **Rewards** – scratch cards and passes that are redeemed as discounts on courses
- **Admin** – stats dashboard plus management of clubs, games, quests, seasons, rewards, courses and users

## API overview

All routes are under `/api` and require a signed-in user. `/api/admin/*` also requires the `ADMIN` role.

| Route | Purpose |
|---|---|
| `/api/me` | Profile, level, dashboard and play history |
| `/api/clubs` | Clubs, membership, seasons and leaderboards |
| `/api/games` | Load a game and submit attempts |
| `/api/rewards` | List, scratch and redeem rewards |
| `/api/courses` | Courses a reward can be redeemed on |
| `/api/admin/*` | Admin stats and management |

`GET /health` is public.

## Running locally

```bash
cp .env.example .env   # add your database URLs and Clerk keys
npm install
npm run db:push        # create the tables
npm run db:seed        # optional sample data
npm run dev            # http://localhost:4000
```

## Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (pooled) |
| `DIRECT_URL` | Direct PostgreSQL connection, used for migrations |
| `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | Clerk keys, from the same Clerk app as the frontend |
| `PORT` | Port to listen on (default `4000`) |
| `FRONTEND_URL` | Comma-separated list of allowed frontend origins (CORS) |
| `ADMIN_EMAILS` | Comma-separated emails promoted to admin on sign-in |
| `AUTO_FINALIZE_SEASONS` | `true` to finalize ended seasons automatically every hour |

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the API with reload on change |
| `npm run build` | Generate the Prisma client and compile to `dist/` |
| `npm start` | Run the compiled build |
| `npm run typecheck` | Type-check without emitting |
| `npm run db:push` | Push the Prisma schema to the database |
| `npm run db:migrate` | Create and apply a migration (development) |
| `npm run db:deploy` | Apply migrations (production) |
| `npm run db:seed` | Seed sample data |
| `npm run db:studio` | Open Prisma Studio |
