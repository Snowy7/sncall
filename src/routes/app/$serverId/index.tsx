import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useQuery } from "convex/react"
import { api, type Id } from "@/lib/api"
import { useEffect } from "react"
import { Hash } from "@phosphor-icons/react"

export const Route = createFileRoute("/app/$serverId/")({ component: ServerHome })

function ServerHome() {
  const { serverId } = Route.useParams()
  const navigate = useNavigate()
  const channels = useQuery(api.channels.listForServer, {
    serverId: serverId as Id<"servers">,
  })

  useEffect(() => {
    if (!channels) return
    const firstText = channels.find((c) => c.type === "text")
    if (firstText) {
      navigate({
        to: "/app/$serverId/$channelId",
        params: { serverId, channelId: firstText._id },
        replace: true,
      })
    }
  }, [channels, navigate, serverId])

  return (
    <div className="flex h-svh flex-1 flex-col bg-background">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border/40 px-4">
        <Hash className="size-5 text-muted-foreground" />
        <span className="font-medium text-muted-foreground">Loading…</span>
      </header>
      <div className="grid flex-1 place-items-center text-sm text-muted-foreground">
        Pick a channel from the sidebar
      </div>
    </div>
  )
}
