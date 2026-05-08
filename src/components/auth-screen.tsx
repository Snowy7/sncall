import { ClerkLoaded, ClerkLoading } from "@clerk/tanstack-react-start"

export function AuthScreen({ children }: { children: React.ReactNode }) {
  const hasKey = Boolean(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY)

  if (!hasKey) {
    return (
      <div className="max-w-md rounded-2xl border bg-card/60 p-6 text-center backdrop-blur">
        <h1 className="text-lg font-medium">clerk not configured</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Add{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-foreground">
            VITE_CLERK_PUBLISHABLE_KEY
          </code>{" "}
          and{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-foreground">
            CLERK_SECRET_KEY
          </code>{" "}
          to{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-foreground">
            .env.local
          </code>
          , then restart the dev server. See README for full setup.
        </p>
      </div>
    )
  }

  return (
    <>
      <ClerkLoading>
        <div className="text-sm text-muted-foreground">connecting…</div>
      </ClerkLoading>
      <ClerkLoaded>{children}</ClerkLoaded>
    </>
  )
}
