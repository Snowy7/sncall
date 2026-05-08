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

### Convex

Already deployed by `bunx convex dev`. For production, run `bunx convex deploy` (or push from CI with `CONVEX_DEPLOY_KEY`).

### Frontend

This is a TanStack Start app, deployable to anything that runs Nitro:

- **Vercel** — `bun run build`, then deploy `.output/`
- **Netlify** — same
- **Cloudflare Workers** — configure `nitro` preset
- **Node** — `node .output/server/index.mjs`

Set production env vars (`VITE_CONVEX_URL`, `VITE_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`) in your hosting provider.

## Scripts

```bash
bun run dev          # vite dev server
bun run build        # production build
bun run preview      # preview production build
bun run typecheck    # tsc --noEmit
bun run lint         # eslint
bun run format       # prettier
```
