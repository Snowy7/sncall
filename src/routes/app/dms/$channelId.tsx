import { createFileRoute } from "@tanstack/react-router"
import { useQuery } from "convex/react"
import { api, type Id } from "@/lib/api"
import { DmChatView } from "@/components/chat-view"

export const Route = createFileRoute("/app/dms/$channelId")({
  component: DmPage,
})

function DmPage() {
  const { channelId } = Route.useParams()
  const dm = useQuery(api.dms.get, {
    channelId: channelId as Id<"channels">,
  })
  if (dm === undefined) {
    return (
      <div className="flex h-svh flex-1 items-center justify-center bg-background text-sm text-muted-foreground">
        Loading conversation…
      </div>
    )
  }
  if (dm === null) {
    return (
      <div className="flex h-svh flex-1 items-center justify-center bg-background text-sm text-muted-foreground">
        Conversation not found.
      </div>
    )
  }
  return <DmChatView channelId={dm.channelId} other={dm.other} />
}
