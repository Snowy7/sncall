import { createFileRoute, Link } from "@tanstack/react-router"
import { Show } from "@clerk/tanstack-react-start"
import { Button } from "@/components/ui/button"
import { ChatCircleDots, Microphone, UsersThree } from "@phosphor-icons/react"

export const Route = createFileRoute("/")({ component: Landing })

function Landing() {
  return (
    <div className="min-h-svh bg-background relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]">
        <div className="absolute inset-x-0 top-0 h-[60svh] bg-gradient-to-b from-primary/10 via-transparent to-transparent" />
      </div>

      <header className="relative z-10 flex items-center justify-between px-6 md:px-10 py-5 max-w-6xl mx-auto">
        <Link to="/" className="flex items-center gap-2 font-medium tracking-tight">
          <span className="size-7 rounded-md bg-primary text-primary-foreground grid place-items-center text-xs">
            sn
          </span>
          <span>sncall</span>
        </Link>
        <nav className="flex items-center gap-2">
          <Show when="signed-out">
            <Link to="/sign-in">
              <Button variant="ghost" size="sm">
                Sign in
              </Button>
            </Link>
            <Link to="/sign-up">
              <Button size="sm">Sign up</Button>
            </Link>
          </Show>
          <Show when="signed-in">
            <Link to="/app">
              <Button size="sm">Open app</Button>
            </Link>
          </Show>
        </nav>
      </header>

      <main className="relative z-10 max-w-4xl mx-auto px-6 md:px-10 pt-16 md:pt-28 pb-24 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/50 backdrop-blur px-3 py-1 text-xs text-muted-foreground mb-6">
          <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Real-time, end-to-end reactive
        </div>
        <h1 className="text-4xl md:text-6xl font-medium tracking-tight leading-[1.05]">
          Servers, chat, and calls.<br />
          <span className="text-muted-foreground">All in one place.</span>
        </h1>
        <p className="text-muted-foreground mt-5 md:mt-7 text-base md:text-lg max-w-2xl mx-auto">
          A clean, fast Discord-style space for your community. Built on Convex
          for live data and LiveKit for crystal-clear voice.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Show when="signed-out">
            <Link to="/sign-up">
              <Button size="lg">Get started — it's free</Button>
            </Link>
            <Link to="/sign-in">
              <Button variant="outline" size="lg">
                Sign in
              </Button>
            </Link>
          </Show>
          <Show when="signed-in">
            <Link to="/app">
              <Button size="lg">Open app</Button>
            </Link>
          </Show>
        </div>

        <div className="mt-20 grid gap-4 md:grid-cols-3 text-left">
          <Feature
            icon={<UsersThree weight="duotone" className="size-5" />}
            title="Communities"
            body="Spin up servers with channels, roles, and invites."
          />
          <Feature
            icon={<ChatCircleDots weight="duotone" className="size-5" />}
            title="Live chat"
            body="Reactive messages stream to every client instantly."
          />
          <Feature
            icon={<Microphone weight="duotone" className="size-5" />}
            title="Voice rooms"
            body="Drop into a voice channel with low-latency audio."
          />
        </div>
      </main>

      <footer className="relative z-10 border-t border-border/40 py-6 text-xs text-muted-foreground text-center">
        Built with TanStack Start · Convex · Clerk · LiveKit
      </footer>
    </div>
  )
}

function Feature({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode
  title: string
  body: string
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/40 backdrop-blur p-5 hover:bg-card/70 transition">
      <div className="size-9 rounded-lg bg-primary/10 text-primary grid place-items-center mb-3">
        {icon}
      </div>
      <div className="font-medium mb-1">{title}</div>
      <p className="text-sm text-muted-foreground">{body}</p>
    </div>
  )
}
