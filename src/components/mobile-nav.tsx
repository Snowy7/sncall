import { useEffect, useState } from "react"
import { useRouter, useRouterState } from "@tanstack/react-router"
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { List, UsersThree } from "@phosphor-icons/react"
import { ServerList } from "./server-list"
import { ChannelSidebar } from "./channel-sidebar"
import { DmSidebar } from "./dm/dm-sidebar"
import { MemberListInner } from "./member-list"
import type { Id } from "@/lib/api"

export function MobileSidebarTrigger({ serverId }: { serverId?: Id<"servers"> }) {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const path = useRouterState({ select: (s) => s.location.pathname })
  const onDms = path.startsWith("/app/dms")

  useEffect(() => {
    const unsub = router.subscribe("onResolved", () => setOpen(false))
    return unsub
  }, [router])

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label="Open navigation"
          className="grid size-9 place-items-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-foreground md:hidden"
        >
          <List className="size-5" />
        </button>
      </SheetTrigger>
      <SheetContent
        side="left"
        showCloseButton={false}
        className="flex w-full max-w-[312px] flex-row gap-0 p-0 sm:max-w-[312px]"
      >
        <SheetTitle className="sr-only">Servers and channels</SheetTitle>
        <ServerList />
        {onDms ? (
          <DmSidebar />
        ) : serverId ? (
          <ChannelSidebar serverId={serverId} />
        ) : (
          <div className="flex flex-1 items-center justify-center bg-sidebar/40 p-4 text-center text-xs text-muted-foreground">
            Pick a server from the rail
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

export function MobileMembersTrigger({ serverId }: { serverId: Id<"servers"> }) {
  const [open, setOpen] = useState(false)
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label="Show members"
          className="grid size-9 place-items-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-foreground lg:hidden"
        >
          <UsersThree className="size-5" />
        </button>
      </SheetTrigger>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="flex w-full max-w-[280px] flex-col gap-0 p-0 sm:max-w-[280px]"
      >
        <SheetTitle className="sr-only">Members</SheetTitle>
        <div className="flex h-svh w-full flex-col bg-sidebar/40">
          <MemberListInner serverId={serverId} />
        </div>
      </SheetContent>
    </Sheet>
  )
}
