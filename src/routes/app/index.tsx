import { createFileRoute } from "@tanstack/react-router"
import { useQuery } from "convex/react"
import { api } from "@/lib/api"
import { ChatCircleDots, UsersThree } from "@phosphor-icons/react"
import { CreateServerButton } from "@/components/create-server-button"
import { Button } from "@/components/ui/button"

export const Route = createFileRoute("/app/")({ component: AppHome })

function AppHome() {
  const servers = useQuery(api.servers.list)

  return (
    <div className="flex h-svh flex-1 flex-col bg-background">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border/40 px-4">
        <ChatCircleDots className="size-5 text-muted-foreground" />
        <span className="font-medium">Home</span>
      </header>
      <div className="grid flex-1 place-items-center px-6">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-5 grid size-20 place-items-center rounded-full bg-primary/10 text-primary">
            <UsersThree weight="duotone" className="size-9" />
          </div>
          {servers && servers.length > 0 ? (
            <>
              <h2 className="text-xl font-medium">Pick a server</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Choose a server from the left rail to start chatting.
              </p>
            </>
          ) : (
            <>
              <h2 className="text-xl font-medium">No servers yet</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Create your first server, or join one with an invite link.
              </p>
              <div className="mt-6">
                <CreateServerButton>
                  <Button size="lg">Create or join a server</Button>
                </CreateServerButton>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
