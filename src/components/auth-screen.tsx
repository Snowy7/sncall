import { useEffect, useState } from "react"
import { ClerkLoaded, ClerkLoading } from "@clerk/tanstack-react-start"

export function AuthScreen({ children }: { children: React.ReactNode }) {
  const key = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined

  if (!key) {
    return (
      <SetupCard
        title="clerk not configured"
        body={
          <>
            Add <Code>VITE_CLERK_PUBLISHABLE_KEY</Code> and{" "}
            <Code>CLERK_SECRET_KEY</Code> to <Code>.env.local</Code> and{" "}
            <em>restart the dev server</em>. See README for full setup.
          </>
        }
      />
    )
  }

  if (!key.startsWith("pk_test_") && !key.startsWith("pk_live_")) {
    return (
      <SetupCard
        title="invalid publishable key"
        body={
          <>
            <Code>VITE_CLERK_PUBLISHABLE_KEY</Code> must start with{" "}
            <Code>pk_test_</Code> or <Code>pk_live_</Code>. Got{" "}
            <Code>{key.slice(0, 12)}…</Code>
          </>
        }
      />
    )
  }

  return (
    <>
      <ClerkLoading>
        <StuckDiagnostic keyPreview={`${key.slice(0, 14)}…${key.slice(-4)}`} />
      </ClerkLoading>
      <ClerkLoaded>{children}</ClerkLoaded>
    </>
  )
}

function StuckDiagnostic({ keyPreview }: { keyPreview: string }) {
  const [stuck, setStuck] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setStuck(true), 4000)
    return () => clearTimeout(t)
  }, [])

  if (!stuck) {
    return <div className="text-sm text-muted-foreground">connecting to clerk…</div>
  }

  return (
    <SetupCard
      title="clerk isn't loading"
      body={
        <>
          The dev server picked up <Code>{keyPreview}</Code>, but clerk hasn't
          responded.
          <ul className="mt-3 list-disc space-y-1 pl-5 text-left">
            <li>
              Confirm the key matches your project's <em>frontend api</em> in
              the Clerk dashboard.
            </li>
            <li>
              If you just edited <Code>.env.local</Code>, restart{" "}
              <Code>bun run dev</Code> (Vite only reads env at startup).
            </li>
            <li>
              Check the browser console / network tab for blocked requests
              (ad blockers can break Clerk).
            </li>
          </ul>
        </>
      }
    />
  )
}

function SetupCard({
  title,
  body,
}: {
  title: string
  body: React.ReactNode
}) {
  return (
    <div className="max-w-md rounded-2xl border bg-card/60 p-6 backdrop-blur">
      <h1 className="text-lg font-medium">{title}</h1>
      <div className="mt-2 text-sm text-muted-foreground">{body}</div>
    </div>
  )
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-muted px-1 py-0.5 text-foreground">
      {children}
    </code>
  )
}
