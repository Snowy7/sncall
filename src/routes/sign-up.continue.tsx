import { createFileRoute, Link } from "@tanstack/react-router"
import { SignUp } from "@clerk/tanstack-react-start"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "@phosphor-icons/react"
import { AuthScreen } from "@/components/auth-screen"

export const Route = createFileRoute("/sign-up/continue")({ component: ContinuePage })

function ContinuePage() {
  return (
    <div className="relative h-svh overflow-hidden bg-background isolate">
      <div className="absolute left-6 top-6 z-20">
        <Link to="/">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="size-4" />
            back
          </Button>
        </Link>
      </div>
      <div className="grid h-svh place-items-center p-6">
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
