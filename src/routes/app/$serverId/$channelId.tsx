import { createFileRoute } from "@tanstack/react-router"
import { useQuery } from "convex/react"
import { api, type Id } from "@/lib/api"
import { ChatView } from "@/components/chat-view"
import { VoiceView } from "@/components/voice-view"
import { MemberList } from "@/components/member-list"

export const Route = createFileRoute("/app/$serverId/$channelId")({
  component: ChannelPage,
})

function ChannelPage() {
  const { serverId, channelId } = Route.useParams()
  const channel = useQuery(api.channels.get, {
    channelId: channelId as Id<"channels">,
  })

  if (channel === undefined) {
    return (
      <div className="flex h-svh flex-1 items-center justify-center bg-background text-sm text-muted-foreground">
        Loading channel…
      </div>
    )
  }
  if (channel === null) {
    return (
      <div className="flex h-svh flex-1 items-center justify-center bg-background text-sm text-muted-foreground">
        Channel not found.
      </div>
    )
  }

  if (channel.type === "voice") {
    return (
      <>
        <VoiceView
          channelId={channel._id}
          channelName={channel.name}
          serverId={serverId as Id<"servers">}
        />
        <MemberList serverId={serverId as Id<"servers">} />
      </>
    )
  }

  return (
    <>
      <ChatView
        channelId={channel._id}
        channelName={channel.name}
        topic={channel.topic}
        serverId={serverId as Id<"servers">}
      />
      <MemberList serverId={serverId as Id<"servers">} />
    </>
  )
}
