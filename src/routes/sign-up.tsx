import { createFileRoute } from "@tanstack/react-router"
import { SignUp } from "@clerk/tanstack-react-start"

export const Route = createFileRoute("/sign-up")({ component: SignUpPage })

function SignUpPage() {
  return (
    <div className="min-h-svh grid place-items-center p-6 bg-background">
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
    </div>
  )
}
