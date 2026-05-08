import { createFileRoute, Link } from "@tanstack/react-router"
import { Button } from "@/components/ui/button"
import { ArrowRight } from "@phosphor-icons/react"

export const Route = createFileRoute("/")({ component: Landing })

function Landing() {
  return (
    <div className="relative h-svh overflow-hidden bg-background isolate">
      <BackgroundFX />

      <header className="relative z-20 mx-auto flex max-w-6xl items-center justify-between px-6 py-5 md:px-10">
        <Link to="/" className="flex items-center gap-2 font-medium tracking-tight">
          <span className="grid size-7 place-items-center rounded-md bg-foreground text-background text-[10px] font-semibold">
            sn
          </span>
          <span>sncall</span>
        </Link>
        <nav className="flex items-center gap-1.5">
          <Link to="/sign-in">
            <Button variant="ghost" size="sm">
              Sign in
            </Button>
          </Link>
          <Link to="/sign-up">
            <Button size="sm">Sign up</Button>
          </Link>
        </nav>
      </header>

      <main className="relative z-10 grid h-[calc(100svh-72px)] place-items-center px-6">
        <div className="text-center animate-fade-up">
          <h1 className="text-[clamp(3rem,11vw,9rem)] font-medium leading-[0.95] tracking-[-0.04em]">
            <span className="block">talk.</span>
            <span className="block bg-gradient-to-br from-violet-300 via-fuchsia-300 to-amber-200 bg-clip-text text-transparent animate-shimmer">
              together.
            </span>
          </h1>
          <p className="mt-6 text-sm text-muted-foreground md:text-base">
            servers, channels, voice — in real time.
          </p>
          <div className="mt-10 flex items-center justify-center gap-3">
            <Link to="/sign-up">
              <Button size="lg" className="group h-12 px-6 text-base">
                open the app
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </Button>
            </Link>
            <Link to="/sign-in">
              <Button variant="ghost" size="lg" className="h-12 px-5 text-base">
                sign in
              </Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}

function BackgroundFX() {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)] opacity-[0.06]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)",
          backgroundSize: "28px 28px",
        }}
      />

      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[1px] bg-gradient-to-r from-transparent via-foreground/20 to-transparent"
      />

      <div aria-hidden className="pointer-events-none absolute inset-0 -z-20 overflow-hidden">
        <div className="absolute -left-[10%] top-[-15%] size-[55svh] rounded-full bg-violet-500/40 blur-[120px] animate-blob" />
        <div className="absolute right-[-10%] top-[10%] size-[50svh] rounded-full bg-fuchsia-500/30 blur-[120px] animate-blob-slow" />
        <div className="absolute bottom-[-25%] left-[20%] size-[60svh] rounded-full bg-sky-500/25 blur-[140px] animate-blob" />
        <div className="absolute bottom-[-15%] right-[15%] size-[45svh] rounded-full bg-amber-400/20 blur-[140px] animate-blob-slow" />
      </div>

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-transparent via-background/30 to-background"
      />

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.025] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
        }}
      />
    </>
  )
}
