import { createFileRoute, Outlet } from "@tanstack/react-router"
import type { Id } from "@/lib/api"
import { ChannelSidebar } from "@/components/channel-sidebar"

export const Route = createFileRoute("/app/$serverId")({ component: ServerLayout })

function ServerLayout() {
  const { serverId } = Route.useParams()
  return (
    <>
      <ChannelSidebar serverId={serverId as Id<"servers">} />
      <Outlet />
    </>
  )
}
