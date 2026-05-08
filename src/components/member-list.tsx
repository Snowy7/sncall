import { useMutation, useQuery } from "convex/react"
import { api, type Id } from "@/lib/api"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Crown, ShieldCheck, DotsThreeVertical, UserMinus } from "@phosphor-icons/react"
import { initialsFromName } from "@/lib/format"
import { toast } from "sonner"

const STATUS_COLORS = {
  online: "bg-emerald-500",
  idle: "bg-amber-500",
  dnd: "bg-rose-500",
  offline: "bg-zinc-500",
} as const

export function MemberList({ serverId }: { serverId: Id<"servers"> }) {
  return (
    <aside className="hidden h-svh w-60 shrink-0 flex-col border-l border-border/40 bg-sidebar/40 lg:flex">
      <MemberListInner serverId={serverId} />
    </aside>
  )
}

export function MemberListInner({ serverId }: { serverId: Id<"servers"> }) {
  const server = useQuery(api.servers.get, { serverId })
  const members = useQuery(api.members.listForServer, { serverId })
  const setRole = useMutation(api.members.setRole)
  const kick = useMutation(api.members.kick)

  if (!members || !server) {
    return (
      <div className="h-12 shrink-0 border-b border-border/40 px-4 flex items-center text-sm text-muted-foreground">
        Loading…
      </div>
    )
  }

  const myRole = server.role
  const online = members.filter(
    (m) => m.status !== "offline" && Date.now() - m.lastSeen < 5 * 60 * 1000,
  )
  const offline = members.filter(
    (m) => m.status === "offline" || Date.now() - m.lastSeen >= 5 * 60 * 1000,
  )

  async function onSetRole(memberId: Id<"members">, role: "admin" | "member") {
    try {
      await setRole({ memberId, role })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed")
    }
  }

  async function onKick(memberId: Id<"members">, name: string) {
    if (!confirm(`Kick ${name}?`)) return
    try {
      await kick({ memberId })
      toast.success(`${name} was kicked`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed")
    }
  }

  return (
    <>
      <div className="h-12 shrink-0 border-b border-border/40 px-4 flex items-center text-sm font-medium">
        Members · {members.length}
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        {online.length > 0 ? (
          <Section
            label={`Online — ${online.length}`}
            items={online}
            myRole={myRole}
            onSetRole={onSetRole}
            onKick={onKick}
          />
        ) : null}
        {offline.length > 0 ? (
          <Section
            label={`Offline — ${offline.length}`}
            items={offline}
            myRole={myRole}
            onSetRole={onSetRole}
            onKick={onKick}
            dim
          />
        ) : null}
      </div>
    </>
  )
}

function Section({
  label,
  items,
  myRole,
  onSetRole,
  onKick,
  dim,
}: {
  label: string
  items: NonNullable<ReturnType<typeof useQuery<typeof api.members.listForServer>>>
  myRole: "owner" | "admin" | "member"
  onSetRole: (id: Id<"members">, role: "admin" | "member") => void
  onKick: (id: Id<"members">, name: string) => void
  dim?: boolean
}) {
  return (
    <div>
      <div className="px-2 mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="space-y-0.5">
        {items.map((m) => {
          const status = (m.status ?? "offline") as keyof typeof STATUS_COLORS
          const canManage =
            (myRole === "owner" && m.role !== "owner") ||
            (myRole === "admin" && m.role === "member")
          return (
            <div
              key={m._id}
              className={`group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent/40 ${
                dim ? "opacity-60" : ""
              }`}
            >
              <div className="relative shrink-0">
                <Avatar className="size-8">
                  {m.imageUrl ? <AvatarImage src={m.imageUrl} alt={m.name} /> : null}
                  <AvatarFallback className="text-[10px]">
                    {initialsFromName(m.name)}
                  </AvatarFallback>
                </Avatar>
                <span
                  className={`absolute right-0 bottom-0 size-2.5 rounded-full ring-2 ring-sidebar ${STATUS_COLORS[status]}`}
                />
              </div>
              <div className="flex min-w-0 flex-1 items-center gap-1">
                <span className="truncate text-sm">
                  {m.nickname ?? m.name}
                </span>
                {m.role === "owner" ? (
                  <Crown className="size-3.5 shrink-0 text-amber-500" weight="fill" />
                ) : m.role === "admin" ? (
                  <ShieldCheck
                    className="size-3.5 shrink-0 text-sky-500"
                    weight="fill"
                  />
                ) : null}
              </div>
              {canManage ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="grid size-6 place-items-center rounded text-muted-foreground opacity-0 hover:bg-muted hover:text-foreground group-hover:opacity-100 focus:opacity-100"
                      aria-label="Member actions"
                    >
                      <DotsThreeVertical className="size-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {myRole === "owner" && m.role === "member" ? (
                      <DropdownMenuItem onClick={() => onSetRole(m._id, "admin")}>
                        <ShieldCheck className="size-4" />
                        Make admin
                      </DropdownMenuItem>
                    ) : null}
                    {myRole === "owner" && m.role === "admin" ? (
                      <DropdownMenuItem onClick={() => onSetRole(m._id, "member")}>
                        <ShieldCheck className="size-4" />
                        Demote to member
                      </DropdownMenuItem>
                    ) : null}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => onKick(m._id, m.name)}
                    >
                      <UserMinus className="size-4" />
                      Kick
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
