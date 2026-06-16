# Discord Bot Ecosystem

A production-grade, monorepo Discord bot ecosystem written in TypeScript. It bundles:

- **`apps/bot`** — A Discord.js v14 bot with slash commands, dynamic command/event loaders, a service layer, dependency injection, structured logging, and an in-memory rate limiter.
- **`apps/web`** — A Next.js (App Router) dashboard with Discord OAuth2, Tailwind CSS, and Server Actions for managing guilds.
- **`packages/database`** — Prisma schema, generated client, and a repository layer that all other apps use.
- **`packages/shared`** — Zod schemas, error types, Discord permission helpers, and other code shared between bot and web.

The system is designed to be run as a single coordinated stack (bot + web + database) using Docker Compose in production, and individually with `tsx` / `next dev` in development.

---

## Architecture at a glance

```
                ┌────────────┐
                │  Discord   │
                └─────┬──────┘
                      │ gateway (websocket) / REST
                      ▼
        ┌─────────────────────────┐
        │  apps/bot (Node 20)     │
        │  ┌───────────────────┐  │
        │  │ core/             │  │   DI container (symbols + tokens)
        │  │  ├ container      │  │   dynamic command loader
        │  │  ├ loader         │  │   event dispatcher
        │  │  ├ dispatcher     │  │   rate-limiter middleware
        │  │  └ error-handler  │  │   error boundary
        │  ├ services/        │  │   business logic
        │  ├ commands/        │  │   /ping, /serverinfo, /userinfo
        │  │   utility/       │  │   /kick, /ban, /warn
        │  │   moderation/    │  │
        │  └ events/          │  │   ready, guildCreate, guildDelete, error
        └──────────┬──────────┘
                   │ Prisma
                   ▼
        ┌─────────────────────────┐         ┌──────────────────────┐
        │ packages/database       │ ◀────── │ packages/shared      │
        │  Prisma client          │         │  zod, errors, perms  │
        │  Repositories           │         │  constants, types    │
        └─────────────────────────┘         └──────────────────────┘
                   ▲
                   │
        ┌──────────┴──────────┐
        │ apps/web (Next.js)  │
        │  Discord OAuth2     │
        │  Guild settings UI  │
        │  Server Actions     │
        └─────────────────────┘
```

### Why a monorepo?

- **One schema for the whole system.** The Prisma schema lives in `packages/database` and is consumed by both the bot and the web app, so there is never a drift between "what the bot persists" and "what the dashboard reads".
- **One source of truth for shared types.** `packages/shared` exports the permission enums, error classes, guild-settings limits, and validation schemas that the bot and the dashboard both rely on. A change to the schema is a single PR.
- **Project references compile incrementally.** `tsc -b` only rebuilds the packages that changed, so iteration on the bot is fast.

---

## Quick start

### Prerequisites

- Node.js **20+** (LTS recommended)
- npm 10+
- Docker & Docker Compose (for the database and the full stack)
- A Discord application — https://discord.com/developers/applications

### 1. Install dependencies

```bash
npm install
```

### 2. Configure the environment

```bash
cp .env.example .env
# fill in DISCORD_TOKEN, DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, ...
```

> ⚠️ **Never commit your `.env` file.** Only `.env.example` should be tracked.

### 3. Start the database

```bash
docker compose up -d postgres
```

### 4. Run migrations and generate the Prisma client

```bash
npm run db:generate
npm run db:migrate
```

### 5. Start the bot and the web app in two terminals

```bash
# terminal 1
npm run dev:bot

# terminal 2
npm run dev:web
```

The bot will log "Bot is online" once it has connected to Discord.
The web dashboard is available at <http://localhost:3000>.

---

## Available commands

### Utility
- `/ping` — Bot latency, message round-trip time.
- `/serverinfo` — Information about the current guild.
- `/userinfo` — Information about a user (defaults to you).

### Moderation
- `/kick <user> [reason]` — Kicks a member.
- `/ban <user> [reason] [delete_days]` — Bans a member, optionally deleting recent messages.
- `/warn <user> [reason]` — Issues a warning that is persisted to the database and visible in the audit log.

All moderation commands require the corresponding Discord permission (`KICK_MEMBERS`, `BAN_MEMBERS`, `MODERATE_MEMBERS`).

---

## Environment variables

The full list is documented inline in [`.env.example`](.env.example). The bot, the web app, and the database all read from the same `.env` file at the repo root; Docker Compose injects them into each container.

| Variable | Description |
| --- | --- |
| `DISCORD_TOKEN` | Bot token (from the Discord developer portal). |
| `DISCORD_CLIENT_ID` | Application / client ID. |
| `DISCORD_CLIENT_SECRET` | OAuth2 client secret. |
| `DATABASE_URL` | PostgreSQL connection string. |
| `SESSION_SECRET` | Random 32+ char string used to sign session cookies. |
| `WEB_BASE_URL` | Public origin of the dashboard. |
| `BOT_RATE_LIMIT_MAX` / `BOT_RATE_LIMIT_WINDOW_MS` | Bot per-user interaction limit. |
| `API_RATE_LIMIT_MAX` / `API_RATE_LIMIT_WINDOW_MS` | Web API per-IP request limit. |

---

## Development guide

### Adding a new slash command

1. Create a new file under `apps/bot/src/commands/<category>/<name>.ts` exporting a `CommandModule`:

   ```ts
   import { SlashCommandBuilder } from 'discord.js';
   import type { CommandModule } from '../../types/modules.js';

   export const data = new SlashCommandBuilder()
     .setName('hello')
     .setDescription('Says hello.');

   export const execute: CommandModule['execute'] = async (ctx) => {
     await ctx.interaction.reply('Hello!');
   };
   ```

2. Run `npm run dev:bot`. The dynamic loader picks up the new file on startup.

### Adding a new service

Services are the business-logic layer. They depend on repositories and other services, and are registered in `apps/bot/src/core/container.ts`:

```ts
container.registerSingleton(TOKENS.MyService, (c) => new MyService(c.get(TOKENS.Logger)));
```

### Adding a new event

Drop a file in `apps/bot/src/events/` exporting a `name` and an `execute` function. The loader registers it on the singleton `Client`.

### Adding a Prisma model

1. Edit `packages/database/prisma/schema.prisma`.
2. Run `npm run db:migrate` to create a migration.
3. Add a repository in `packages/database/src/repositories/`.
4. Re-export it from `packages/database/src/index.ts`.

---

## Testing

Unit and integration tests use **Vitest**. Each package has its own `vitest.config.ts`.

```bash
npm test                       # run all suites across the monorepo
npm run test --workspace apps/bot
npm run test:watch --workspace packages/shared
```

Test files live next to the code they exercise (`foo.ts` → `foo.test.ts`).

---

## Deployment

The full stack is deployed with Docker Compose. See [`docker-compose.yml`](docker-compose.yml).

```bash
docker compose build
docker compose up -d
```

Each app has its own `Dockerfile` (`apps/bot/Dockerfile`, `apps/web/Dockerfile`) that runs `tsc -b` and copies `dist/` into a slim Node image.

---

## Security notes

- All secrets come from environment variables; nothing is hard-coded.
- The bot's `RateLimiter` (in `apps/bot/src/middleware/rate-limiter.ts`) is per-user, in-memory; replace with a Redis-backed implementation when you scale horizontally.
- The web dashboard enforces `MANAGE_GUILD` (or `ADMINISTRATOR`) on every action that mutates a guild.
- Audit logs strip well-known secret keys (`token`, `password`, `secret`, `authorization`) before persisting metadata.
- API input is validated with Zod schemas that live in `packages/shared`.

---

## License

MIT.
