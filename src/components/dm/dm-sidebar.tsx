import { useState } from "react"
import { Link, useNavigate, useParams } from "@tanstack/react-router"
import { useMutation, useQuery } from "convex/react"
import { api, type Id } from "@/lib/api"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Plus, MagnifyingGlass } from "@phosphor-icons/react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog"
import { initialsFromName } from "@/lib/format"
import { UserPanel } from "@/components/user-panel"
import { VoiceDock } from "@/components/voice/voice-dock"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const STATUS_COLORS = {
  online: "bg-emerald-500",
  idle: "bg-amber-500",
  dnd: "bg-rose-500",
  offline: "bg-zinc-500",
} as const

export function DmSidebar() {
  const dms = useQuery(api.dms.list)
  const params = useParams({ strict: false }) as { channelId?: string }
  const unread = useQuery(
    api.readState.summary,
    dms && dms.length > 0
      ? { channelIds: dms.map((d) => d.channelId) }
      : "skip",
  )
  const [openNew, setOpenNew] = useState(false)

  return (
    <aside className="flex h-svh w-60 shrink-0 flex-col border-r border-border/40 bg-sidebar/40">
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border/40 px-3 text-sm font-medium">
        <span>Direct Messages</span>
        <Dialog open={openNew} onOpenChange={setOpenNew}>
          <DialogTrigger asChild>
            <button
              type="button"
              className="grid size-7 place-items-center rounded text-muted-foreground transition hover:bg-accent hover:text-foreground"
              aria-label="Start a DM"
            >
              <Plus className="size-4" />
            </button>
          </DialogTrigger>
          <NewDmDialog onClose={() => setOpenNew(false)} />
        </Dialog>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-3">
        {dms === undefined ? (
          <div className="px-2 text-xs text-muted-foreground">Loading…</div>
        ) : dms.length === 0 ? (
          <div className="px-2 py-4 text-center">
            <p className="text-xs text-muted-foreground">No DMs yet.</p>
            <button
              type="button"
              onClick={() => setOpenNew(true)}
              className="mt-2 text-xs text-primary hover:underline"
            >
              Start a conversation →
            </button>
          </div>
        ) : (
          <div className="space-y-0.5">
            {dms.map((dm) => {
              const u = unread?.[dm.channelId]
              const hasUnread =
                params.channelId !== dm.channelId && (u?.unread ?? 0) > 0
              return (
                <Link
                  key={dm.channelId}
                  to="/app/dms/$channelId"
                  params={{ channelId: dm.channelId }}
                  className={cn(
                    "group flex items-center gap-2 rounded-md px-2 py-1.5 transition",
                    params.channelId === dm.channelId
                      ? "bg-accent"
                      : "hover:bg-accent/50",
                  )}
                >
                  <div className="relative shrink-0">
                    <Avatar className="size-7">
                      {dm.other.imageUrl ? (
                        <AvatarImage src={dm.other.imageUrl} />
                      ) : null}
                      <AvatarFallback className="text-[10px]">
                        {initialsFromName(dm.other.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span
                      className={cn(
                        "absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full ring-2 ring-sidebar",
                        STATUS_COLORS[dm.other.status],
                      )}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div
                      className={cn(
                        "truncate text-sm leading-tight",
                        hasUnread ? "font-semibold" : "",
                      )}
                    >
                      {dm.other.name}
                    </div>
                    {dm.lastMessagePreview ? (
                      <div className="truncate text-[11px] text-muted-foreground leading-tight">
                        {dm.lastMessagePreview}
                      </div>
                    ) : null}
                  </div>
                  {hasUnread ? (
                    <span className="size-2 shrink-0 rounded-full bg-rose-500" />
                  ) : null}
                </Link>
              )
            })}
          </div>
        )}
      </div>

      <VoiceDock />
      <UserPanel />
    </aside>
  )
}

function NewDmDialog({ onClose }: { onClose: () => void }) {
  const [search, setSearch] = useState("")
  const contacts = useQuery(api.dms.findContacts, { search: search || undefined })
  const open = useMutation(api.dms.open)
  const navigate = useNavigate()

  async function startDm(userId: Id<"users">) {
    try {
      const channelId = await open({ otherUserId: userId })
      onClose()
      navigate({ to: "/app/dms/$channelId", params: { channelId } })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to open DM")
    }
  }

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>Start a direct message</DialogTitle>
        <DialogDescription>
          Pick someone from a server you're both in.
        </DialogDescription>
      </DialogHeader>
      <div className="relative">
        <MagnifyingGlass className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus
          placeholder="Search by name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8"
        />
      </div>
      <div className="max-h-72 overflow-y-auto rounded-md border border-border/40">
        {contacts === undefined ? (
          <div className="p-3 text-xs text-muted-foreground">Loading…</div>
        ) : contacts.length === 0 ? (
          <div className="p-3 text-xs text-muted-foreground">
            No matches. People you share a server with show up here.
          </div>
        ) : (
          contacts.map((c) => (
            <button
              key={c._id}
              type="button"
              onClick={() => startDm(c._id)}
              className="flex w-full items-center gap-2 px-2 py-2 text-left hover:bg-accent/50"
            >
              <div className="relative shrink-0">
                <Avatar className="size-7">
                  {c.imageUrl ? <AvatarImage src={c.imageUrl} /> : null}
                  <AvatarFallback className="text-[10px]">
                    {initialsFromName(c.name)}
                  </AvatarFallback>
                </Avatar>
                <span
                  className={cn(
                    "absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full ring-2 ring-background",
                    STATUS_COLORS[c.status],
                  )}
                />
              </div>
              <span className="text-sm">{c.name}</span>
            </button>
          ))
        )}
      </div>
    </DialogContent>
  )
}
