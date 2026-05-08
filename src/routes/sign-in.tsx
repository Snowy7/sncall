import { createFileRoute } from "@tanstack/react-router"
import { SignIn } from "@clerk/tanstack-react-start"

export const Route = createFileRoute("/sign-in")({ component: SignInPage })

function SignInPage() {
  return (
    <div className="min-h-svh grid place-items-center p-6 bg-background">
      <SignIn
        signUpUrl="/sign-up"
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
