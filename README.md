# sncall

A clean, real-time Discord-style app: servers, channels, chat, and voice/video calls.

Built with **TanStack Start** + **Convex** + **Clerk** + **LiveKit** + **shadcn/ui**.

## Stack

- **TanStack Start** — type-safe full-stack React with file-based routing and SSR
- **Convex** — reactive backend, database, and real-time subscriptions for chat/presence
- **Clerk** — authentication (email, social, magic link, MFA)
- **LiveKit** — WebRTC SFU for voice/video calls
- **shadcn/ui (radix-lyra preset)** — components and theming
- **Phosphor Icons** — icon set
- **Tailwind v4** — styling

## Setup

You need accounts on [Convex](https://convex.dev), [Clerk](https://clerk.com), and [LiveKit Cloud](https://livekit.io) (or a self-hosted LiveKit server).

### 1. Install dependencies

```bash
bun install
```

### 2. Provision Convex

```bash
bunx convex dev
```

This will prompt you to log in, create a Convex project, and write `CONVEX_DEPLOYMENT` and `VITE_CONVEX_URL` to `.env.local`. Keep this command running in a separate terminal — it watches `convex/` for changes and pushes them automatically.

### 3. Configure Clerk

1. Create a new application in the [Clerk dashboard](https://dashboard.clerk.com).
2. Copy the **Publishable Key** to `.env.local` as `VITE_CLERK_PUBLISHABLE_KEY` and the **Secret Key** as `CLERK_SECRET_KEY`.
3. Create a JWT template named **`convex`** under "JWT Templates":
   - Token lifetime: 60 seconds
   - Default claims are fine
4. Copy the **Issuer URL** from that template (e.g. `https://your-app.clerk.accounts.dev`) and set it on Convex:

```bash
bunx convex env set CLERK_JWT_ISSUER_DOMAIN https://your-app.clerk.accounts.dev
```

### 4. Configure LiveKit

1. Create a project in [LiveKit Cloud](https://cloud.livekit.io) (or run your own server).
2. Get the WebSocket URL, API Key, and API Secret from the project settings.
3. Set them on Convex (these are server-side secrets, not in `.env.local`):

```bash
bunx convex env set LIVEKIT_URL wss://your-project.livekit.cloud
bunx convex env set LIVEKIT_API_KEY APIxxx
bunx convex env set LIVEKIT_API_SECRET secretxxx
```

### 5. Run the app

In two terminals:

```bash
bunx convex dev   # terminal 1 — keep running
bun run dev       # terminal 2 — vite dev server
```

Open http://localhost:3000.

## Project layout

```
convex/                    Convex backend (schema, queries, mutations, actions)
  schema.ts                Tables: users, servers, members, channels, messages, voiceParticipants
  users.ts                 Clerk → Convex user provisioning, presence
  servers.ts               Server CRUD + invite codes
  channels.ts              Channel CRUD per server
  messages.ts              Send/edit/delete chat messages
  members.ts               Member roles + kick
  voice.ts                 Voice channel presence (Convex side)
  livekit.ts               Action that mints LiveKit join tokens (Node.js runtime)
  auth.config.ts           Tells Convex how to verify Clerk JWTs

src/
  routes/                  TanStack Start file-based routes
    __root.tsx             Providers (ClerkProvider + ConvexProviderWithClerk)
    index.tsx              Landing page
    sign-in.tsx            Clerk SignIn
    sign-up.tsx            Clerk SignUp
    invite.$code.tsx       Accept-invite page
    app/                   Authed shell
      route.tsx            Server-list rail + Outlet
      $serverId/
        route.tsx          Channel sidebar + Outlet
        $channelId.tsx     Chat or voice view
  components/              UI components (server-list, channel-sidebar, chat-view, voice-view, …)
  lib/                     Convex client + helpers
```

## Deploy

The default `build` script wraps `vite build` with `convex deploy`, so a single command pushes the backend and builds the frontend together. CI just needs one Convex env var.

### Vercel

1. **Connect** the GitHub repo to a new Vercel project. Framework preset: **Other** (Vercel auto-detects Nitro from the build output).
2. **Production deploy key** — in [Convex dashboard](https://dashboard.convex.dev) → your project → Settings → Generate Production Deploy Key.
3. **Vercel env vars** (Project Settings → Environment Variables):
   - `CONVEX_DEPLOY_KEY` — the prod deploy key from step 2
   - `VITE_CLERK_PUBLISHABLE_KEY` — Clerk prod publishable key (`pk_live_…`)
   - `CLERK_SECRET_KEY` — Clerk prod secret key (`sk_live_…`)
4. **Convex prod env vars** — once, from your machine:
   ```bash
   bunx convex env set CLERK_JWT_ISSUER_DOMAIN https://your-app.clerk.accounts.dev --prod
   bunx convex env set LIVEKIT_URL wss://your-project.livekit.cloud --prod
   bunx convex env set LIVEKIT_API_KEY APIxxx --prod
   bunx convex env set LIVEKIT_API_SECRET secretxxx --prod
   ```
5. **Deploy** — push to `main`. Build command stays the default `bun run build` (which runs `convex deploy --cmd 'vite build'`). `VITE_CONVEX_URL` is auto-injected by `convex deploy`.

### Other platforms

Same idea — set `CONVEX_DEPLOY_KEY` + the Clerk vars in the build environment, then run `bun run build`. The output is in `.output/` and runs anywhere Nitro deploys (Netlify, Cloudflare Workers with the right preset, plain Node via `node .output/server/index.mjs`).

## Scripts

```bash
bun run dev          # vite dev server
bun run build        # convex deploy + vite build (used by CI)
bun run build:vite   # just vite build (local sanity check, no convex deploy)
bun run preview      # preview production build
bun run typecheck    # tsc --noEmit
bun run lint         # eslint
bun run format       # prettier
```
