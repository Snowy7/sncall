import { useClerk, useUser } from "@clerk/tanstack-react-start"
import { useQuery, useMutation } from "convex/react"
import { api } from "@/lib/api"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Gear, SignOut } from "@phosphor-icons/react"
import { initialsFromName } from "@/lib/format"

const STATUS_LABELS = {
  online: "Online",
  idle: "Idle",
  dnd: "Do not disturb",
  offline: "Invisible",
} as const

const STATUS_COLORS = {
  online: "bg-emerald-500",
  idle: "bg-amber-500",
  dnd: "bg-rose-500",
  offline: "bg-zinc-500",
} as const

export function UserPanel() {
  const me = useQuery(api.users.me)
  const { user } = useUser()
  const { signOut } = useClerk()
  const setStatus = useMutation(api.users.updateStatus)

  if (!me) return <div className="h-13 border-t border-border/40" />

  const status = me.status ?? "online"

  return (
    <div className="border-t border-border/40 bg-sidebar/80 px-2 py-1.5">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-md p-1.5 text-left hover:bg-accent/40"
          >
            <div className="relative">
              <Avatar className="size-8">
                {user?.imageUrl ? <AvatarImage src={user.imageUrl} /> : null}
                <AvatarFallback>{initialsFromName(me.name)}</AvatarFallback>
              </Avatar>
              <span
                className={`absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full ring-2 ring-sidebar ${STATUS_COLORS[status]}`}
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate leading-tight">{me.name}</div>
              <div className="text-[11px] text-muted-foreground truncate leading-tight">
                {STATUS_LABELS[status]}
              </div>
            </div>
            <Gear className="size-4 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Set status</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={status}
            onValueChange={(v) =>
              setStatus({ status: v as keyof typeof STATUS_LABELS })
            }
          >
            {(Object.keys(STATUS_LABELS) as Array<keyof typeof STATUS_LABELS>).map(
              (s) => (
                <DropdownMenuRadioItem key={s} value={s}>
                  <span
                    className={`mr-2 inline-block size-2 rounded-full ${STATUS_COLORS[s]}`}
                  />
                  {STATUS_LABELS[s]}
                </DropdownMenuRadioItem>
              ),
            )}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => signOut({ redirectUrl: "/" })}>
            <SignOut className="size-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
