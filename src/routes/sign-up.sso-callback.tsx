import { createFileRoute } from "@tanstack/react-router"
import { AuthenticateWithRedirectCallback } from "@clerk/tanstack-react-start"

export const Route = createFileRoute("/sign-up/sso-callback")({
  component: SSOCallback,
})

function SSOCallback() {
  return (
    <div className="grid min-h-svh place-items-center bg-background p-6">
      <div className="text-center space-y-3">
        <div className="mx-auto size-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <p className="text-sm text-muted-foreground">finishing sign up…</p>
      </div>
      <AuthenticateWithRedirectCallback
        signInUrl="/sign-in"
        signUpUrl="/sign-up"
        continueSignUpUrl="/sign-up/continue"
        signInForceRedirectUrl="/app"
        signUpForceRedirectUrl="/app"
        signInFallbackRedirectUrl="/app"
        signUpFallbackRedirectUrl="/app"
      />
    </div>
  )
}
