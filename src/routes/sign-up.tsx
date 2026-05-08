import { createFileRoute, Link } from "@tanstack/react-router"
import { SignUp } from "@clerk/tanstack-react-start"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "@phosphor-icons/react"
import { AuthScreen } from "@/components/auth-screen"

export const Route = createFileRoute("/sign-up")({ component: SignUpPage })

function SignUpPage() {
  return (
    <div className="relative h-svh overflow-hidden bg-background isolate">
      <BackgroundFX />
      <div className="absolute left-6 top-6 z-20 md:left-10 md:top-6">
        <Link to="/">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="size-4" />
            back
          </Button>
        </Link>
      </div>
      <div className="grid h-svh place-items-center p-6 relative z-10">
        <AuthScreen>
          <SignUp
            signInUrl="/sign-in"
            forceRedirectUrl="/app"
            appearance={{
              variables: {
                colorPrimary: "oklch(0.488 0.243 264.376)",
                borderRadius: "0.625rem",
                fontFamily: "var(--font-mono)",
              },
            }}
          />
        </AuthScreen>
      </div>
    </div>
  )
}

function BackgroundFX() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="absolute -left-[10%] top-[-20%] size-[60svh] rounded-full bg-fuchsia-500/30 blur-[120px] animate-blob" />
      <div className="absolute right-[-10%] bottom-[-15%] size-[50svh] rounded-full bg-amber-400/25 blur-[140px] animate-blob-slow" />
    </div>
  )
}
