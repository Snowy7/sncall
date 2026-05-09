import { createFileRoute } from "@tanstack/react-router"
import { ChatCircleDots } from "@phosphor-icons/react"
import { MobileSidebarTrigger } from "@/components/mobile-nav"

export const Route = createFileRoute("/app/dms/")({ component: DmsHome })

function DmsHome() {
  return (
    <div className="flex h-svh min-w-0 flex-1 flex-col bg-background">
      <header className="flex h-12 shrink-0 items-center gap-1.5 border-b border-border/40 px-2 md:px-4">
        <MobileSidebarTrigger />
        <ChatCircleDots className="size-5 shrink-0 text-muted-foreground" />
        <span className="font-medium">Direct Messages</span>
      </header>
      <div className="grid flex-1 place-items-center px-6">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-5 grid size-20 place-items-center rounded-full bg-primary/10 text-primary">
            <ChatCircleDots weight="duotone" className="size-9" />
          </div>
          <h2 className="text-xl font-medium">Pick a conversation</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose a DM from the left, or start a new one with someone you
            share a server with.
          </p>
        </div>
      </div>
    </div>
  )
}
