import { Link, useParams } from "@tanstack/react-router"
import { useQuery, useMutation } from "convex/react"
import { api, type Id } from "@/lib/api"
import {
  Hash,
  SpeakerHigh,
  Plus,
  CaretDown,
  Gear,
  UserPlus,
  SignOut,
  Trash,
} from "@phosphor-icons/react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { CreateChannelButton } from "@/components/create-channel-button"
import { InviteDialog } from "@/components/invite-dialog"
import { UserPanel } from "@/components/user-panel"
import { VoiceDock } from "@/components/voice/voice-dock"
import { useState } from "react"
import { toast } from "sonner"
import { useNavigate } from "@tanstack/react-router"

export function ChannelSidebar({ serverId }: { serverId: Id<"servers"> }) {
  const server = useQuery(api.servers.get, { serverId })
  const channels = useQuery(api.channels.listForServer, { serverId })
  const params = useParams({ strict: false }) as { channelId?: string }
  const textChannelIds = (channels ?? [])
    .filter((c) => c.type === "text")
    .map((c) => c._id)
  const unread = useQuery(
    api.readState.summary,
    textChannelIds.length > 0 ? { channelIds: textChannelIds } : "skip",
  )
  const remove = useMutation(api.servers.remove)
  const leave = useMutation(api.servers.leave)
  const navigate = useNavigate()
  const [inviteOpen, setInviteOpen] = useState(false)

  if (server === undefined || channels === undefined) {
    return (
      <aside className="flex h-svh w-60 shrink-0 flex-col border-r border-border/40 bg-sidebar/40">
        <div className="h-12 shrink-0 border-b border-border/40 px-3 flex items-center text-sm text-muted-foreground">
          Loading…
        </div>
      </aside>
    )
  }
  if (server === null) {
    return (
      <aside className="flex h-svh w-60 shrink-0 flex-col border-r border-border/40 bg-sidebar/40">
        <div className="px-4 py-6 text-sm text-muted-foreground">
          Server not found or no access.
        </div>
      </aside>
    )
  }

  const text = channels.filter((c) => c.type === "text")
  const voice = channels.filter((c) => c.type === "voice")
  const isOwner = server.role === "owner"
  const canManage = server.role === "owner" || server.role === "admin"

  async function onDelete() {
    if (!confirm(`Delete "${server!.name}"? This cannot be undone.`)) return
    try {
      await remove({ serverId })
      toast.success("Server deleted")
      navigate({ to: "/app" })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed")
    }
  }

  async function onLeave() {
    if (!confirm(`Leave "${server!.name}"?`)) return
    try {
      await leave({ serverId })
      toast.success("Left server")
      navigate({ to: "/app" })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed")
    }
  }

  return (
    <aside className="flex h-svh w-60 shrink-0 flex-col border-r border-border/40 bg-sidebar/40">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex h-12 shrink-0 items-center justify-between border-b border-border/40 px-3 text-sm font-medium hover:bg-accent/40"
          >
            <span className="truncate">{server.name}</span>
            <CaretDown className="size-4 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuItem onClick={() => setInviteOpen(true)}>
            <UserPlus className="size-4" />
            Invite people
          </DropdownMenuItem>
          {canManage && (
            <CreateChannelButton serverId={serverId}>
              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                <Plus className="size-4" />
                Create channel
              </DropdownMenuItem>
            </CreateChannelButton>
          )}
          {isOwner && (
            <DropdownMenuItem disabled>
              <Gear className="size-4" />
              Server settings
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          {isOwner ? (
            <DropdownMenuItem
              variant="destructive"
              onSelect={(e) => {
                e.preventDefault()
                onDelete()
              }}
            >
              <Trash className="size-4" />
              Delete server
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              variant="destructive"
              onSelect={(e) => {
                e.preventDefault()
                onLeave()
              }}
            >
              <SignOut className="size-4" />
              Leave server
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <InviteDialog
        serverId={serverId}
        open={inviteOpen}
        onOpenChange={setInviteOpen}
      />

      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        <Section
          label="Text Channels"
          canCreate={canManage}
          serverId={serverId}
          createType="text"
        >
          {text.map((c) => {
            const u = unread?.[c._id]
            return (
              <ChannelRow
                key={c._id}
                serverId={serverId}
                channelId={c._id}
                name={c.name}
                icon={<Hash className="size-4" />}
                active={params.channelId === c._id}
                unread={u?.unread ?? 0}
                mentions={u?.mentions ?? 0}
              />
            )
          })}
        </Section>

        <Section
          label="Voice Channels"
          canCreate={canManage}
          serverId={serverId}
          createType="voice"
        >
          {voice.map((c) => (
            <VoiceChannelRow
              key={c._id}
              serverId={serverId}
              channelId={c._id}
              name={c.name}
              active={params.channelId === c._id}
            />
          ))}
        </Section>
      </div>

      <VoiceDock />
      <UserPanel />
    </aside>
  )
}

function Section({
  label,
  canCreate,
  serverId,
  createType,
  children,
}: {
  label: string
  canCreate: boolean
  serverId: Id<"servers">
  createType: "text" | "voice"
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="flex items-center justify-between px-2 mb-1">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        {canCreate && (
          <CreateChannelButton serverId={serverId} defaultType={createType}>
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground"
              aria-label={`Create ${createType} channel`}
            >
              <Plus className="size-3.5" />
            </button>
          </CreateChannelButton>
        )}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  )
}

function ChannelRow({
  serverId,
  channelId,
  name,
  icon,
  active,
  unread,
  mentions,
}: {
  serverId: Id<"servers">
  channelId: Id<"channels">
  name: string
  icon: React.ReactNode
  active: boolean
  unread?: number
  mentions?: number
}) {
  const hasUnread = !active && (unread ?? 0) > 0
  const hasMentions = !active && (mentions ?? 0) > 0
  return (
    <Link
      to="/app/$serverId/$channelId"
      params={{ serverId, channelId }}
      className={`group flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm transition ${
        active
          ? "bg-accent text-foreground"
          : hasUnread
            ? "text-foreground hover:bg-accent/50"
            : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
      }`}
    >
      <span
        className={
          hasUnread ? "text-foreground" : "text-muted-foreground"
        }
      >
        {icon}
      </span>
      <span className={`truncate ${hasUnread ? "font-semibold" : ""}`}>
        {name}
      </span>
      {hasMentions ? (
        <span className="ml-auto inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white tabular-nums">
          {mentions}
        </span>
      ) : hasUnread ? (
        <span className="ml-auto size-2 rounded-full bg-foreground" />
      ) : null}
    </Link>
  )
}

function VoiceChannelRow({
  serverId,
  channelId,
  name,
  active,
}: {
  serverId: Id<"servers">
  channelId: Id<"channels">
  name: string
  active: boolean
}) {
  const participants = useQuery(api.voice.listParticipants, { channelId })
  return (
    <div>
      <Link
        to="/app/$serverId/$channelId"
        params={{ serverId, channelId }}
        className={`group flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm transition ${
          active
            ? "bg-accent text-foreground"
            : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
        }`}
      >
        <SpeakerHigh className="size-4 text-muted-foreground" />
        <span className="truncate">{name}</span>
        {participants && participants.length > 0 ? (
          <span className="ml-auto text-[10px] text-muted-foreground tabular-nums">
            {participants.length}
          </span>
        ) : null}
      </Link>
      {participants && participants.length > 0 ? (
        <div className="ml-6 mt-0.5 space-y-0.5">
          {participants.map((p) => (
            <div
              key={p.userId}
              className="flex items-center gap-2 rounded-md px-2 py-1 text-xs text-muted-foreground"
            >
              <span className="size-1.5 rounded-full bg-emerald-500" />
              <span className="truncate">{p.name}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
