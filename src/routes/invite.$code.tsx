import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { Show, RedirectToSignIn } from "@clerk/tanstack-react-start"
import { useMutation, useQuery } from "convex/react"
import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { initialsFromName } from "@/lib/format"
import { useState } from "react"
import { toast } from "sonner"
import { AuthBootstrap } from "@/components/auth-bootstrap"

export const Route = createFileRoute("/invite/$code")({ component: InvitePage })

function InvitePage() {
  return (
    <>
      <Show when="signed-out">
        <RedirectToSignIn />
      </Show>
      <Show when="signed-in">
        <AuthBootstrap>
          <Inner />
        </AuthBootstrap>
      </Show>
    </>
  )
}

function Inner() {
  const { code } = Route.useParams()
  const server = useQuery(api.servers.getByInviteCode, { code })
  const join = useMutation(api.servers.joinByInviteCode)
  const [pending, setPending] = useState(false)
  const navigate = useNavigate()

  async function accept() {
    if (pending) return
    setPending(true)
    try {
      const id = await join({ code })
      navigate({ to: "/app/$serverId", params: { serverId: id } })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to join")
      setPending(false)
    }
  }

  if (server === undefined) {
    return (
      <div className="grid min-h-svh place-items-center text-sm text-muted-foreground">
        Loading invite…
      </div>
    )
  }
  if (server === null) {
    return (
      <div className="grid min-h-svh place-items-center p-6 text-center">
        <div>
          <h1 className="text-xl font-medium">Invalid invite</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This invite link doesn't exist or has expired.
          </p>
          <Link to="/app" className="mt-6 inline-block">
            <Button variant="outline">Back to app</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="grid min-h-svh place-items-center p-6">
      <div className="w-full max-w-sm rounded-2xl border bg-card/50 p-6 text-center backdrop-blur">
        <Avatar className="mx-auto size-16">
          {server.imageUrl ? <AvatarImage src={server.imageUrl} /> : null}
          <AvatarFallback className="text-xl">
            {initialsFromName(server.name)}
          </AvatarFallback>
        </Avatar>
        <p className="mt-4 text-sm text-muted-foreground">
          You've been invited to join
        </p>
        <h1 className="mt-1 text-xl font-medium">{server.name}</h1>
        <p className="mt-2 text-xs text-muted-foreground">
          {server.memberCount}{" "}
          {server.memberCount === 1 ? "member" : "members"}
        </p>
        <Button onClick={accept} disabled={pending} className="mt-6 w-full" size="lg">
          {pending ? "Joining…" : "Accept invite"}
        </Button>
        <Link to="/app">
          <Button variant="ghost" size="sm" className="mt-2 w-full">
            Cancel
          </Button>
        </Link>
      </div>
    </div>
  )
}
