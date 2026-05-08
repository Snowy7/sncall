import { useEffect } from "react"
import { useUser } from "@clerk/tanstack-react-start"
import { useMutation, useQuery } from "convex/react"
import { api } from "@/lib/api"

export function AuthBootstrap({ children }: { children: React.ReactNode }) {
  const { user, isSignedIn, isLoaded } = useUser()
  const me = useQuery(api.users.me)
  const upsert = useMutation(api.users.upsertFromClerk)
  const heartbeat = useMutation(api.users.heartbeat)

  useEffect(() => {
    if (!isSignedIn || !user) return
    upsert({
      name:
        user.fullName ??
        user.username ??
        user.primaryEmailAddress?.emailAddress ??
        "User",
      email: user.primaryEmailAddress?.emailAddress,
      imageUrl: user.imageUrl,
    }).catch(() => {})
  }, [isSignedIn, user?.id, user?.imageUrl, user?.fullName, user?.username, upsert])

  useEffect(() => {
    if (!isSignedIn) return
    const id = setInterval(() => {
      heartbeat({}).catch(() => {})
    }, 30_000)
    return () => clearInterval(id)
  }, [isSignedIn, heartbeat])

  if (!isLoaded) {
    return (
      <div className="grid min-h-svh place-items-center text-sm text-muted-foreground">
        Loading…
      </div>
    )
  }
  if (isSignedIn && me === undefined) {
    return (
      <div className="grid min-h-svh place-items-center text-sm text-muted-foreground">
        Connecting…
      </div>
    )
  }
  if (isSignedIn && me === null) {
    return (
      <div className="grid min-h-svh place-items-center text-sm text-muted-foreground">
        Setting up your account…
      </div>
    )
  }
  return <>{children}</>
}
