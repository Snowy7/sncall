import { Link, useParams, useRouterState } from "@tanstack/react-router"
import { useQuery } from "convex/react"
import { api } from "@/lib/api"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Plus, House, ChatCircleDots } from "@phosphor-icons/react"
import { initialsFromName } from "@/lib/format"
import { CreateServerButton } from "@/components/create-server-button"

export function ServerList() {
  const servers = useQuery(api.servers.list)
  const params = useParams({ strict: false }) as {
    serverId?: string
    channelId?: string
  }
  const path = useRouterState({ select: (s) => s.location.pathname })
  const onDms = path.startsWith("/app/dms")
  const onHome = !params.serverId && !onDms

  return (
    <TooltipProvider delayDuration={120}>
      <aside className="flex h-svh w-[72px] shrink-0 flex-col items-center gap-2 border-r border-border/40 bg-sidebar/80 py-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              to="/app"
              className="group relative flex size-12 items-center justify-center"
            >
              <span
                className={`grid size-12 place-items-center rounded-2xl bg-primary/15 text-primary transition-all group-hover:rounded-xl group-hover:bg-primary group-hover:text-primary-foreground ${
                  onHome ? "rounded-xl bg-primary text-primary-foreground" : ""
                }`}
              >
                <House weight="fill" className="size-5" />
              </span>
              <ActiveIndicator active={onHome} />
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right">Home</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              to="/app/dms"
              className="group relative flex size-12 items-center justify-center"
            >
              <span
                className={`grid size-12 place-items-center rounded-2xl bg-card text-foreground transition-all group-hover:rounded-xl group-hover:bg-primary group-hover:text-primary-foreground ${
                  onDms ? "rounded-xl bg-primary text-primary-foreground" : ""
                }`}
              >
                <ChatCircleDots weight="fill" className="size-5" />
              </span>
              <ActiveIndicator active={onDms} />
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right">Direct messages</TooltipContent>
        </Tooltip>

        <div className="my-1 h-px w-8 bg-border/60" />

        <div className="flex flex-1 flex-col gap-2 overflow-y-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {servers?.map((s) => {
            const active = params.serverId === s._id
            return (
              <Tooltip key={s._id}>
                <TooltipTrigger asChild>
                  <Link
                    to="/app/$serverId"
                    params={{ serverId: s._id }}
                    className="group relative flex size-12 items-center justify-center"
                  >
                    <Avatar
                      className={`size-12 transition-all duration-150 group-hover:rounded-xl ${
                        active ? "rounded-xl" : "rounded-2xl"
                      }`}
                    >
                      {s.imageUrl ? (
                        <AvatarImage src={s.imageUrl} alt={s.name} />
                      ) : null}
                      <AvatarFallback
                        className={`bg-card text-foreground font-medium transition-all ${
                          active ? "rounded-xl" : "rounded-2xl"
                        } group-hover:rounded-xl group-hover:bg-primary group-hover:text-primary-foreground`}
                      >
                        {initialsFromName(s.name)}
                      </AvatarFallback>
                    </Avatar>
                    <ActiveIndicator active={active} />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">{s.name}</TooltipContent>
              </Tooltip>
            )
          })}

          <Tooltip>
            <TooltipTrigger asChild>
              <CreateServerButton>
                <button
                  type="button"
                  className="group grid size-12 place-items-center rounded-2xl bg-card text-emerald-500 transition-all hover:rounded-xl hover:bg-emerald-500 hover:text-white"
                  aria-label="Add server"
                >
                  <Plus weight="bold" className="size-5" />
                </button>
              </CreateServerButton>
            </TooltipTrigger>
            <TooltipContent side="right">Add a server</TooltipContent>
          </Tooltip>
        </div>
      </aside>
    </TooltipProvider>
  )
}

function ActiveIndicator({ active }: { active: boolean }) {
  return (
    <span
      className={`absolute -left-3 top-1/2 w-1 -translate-y-1/2 rounded-r-full bg-foreground transition-all ${
        active ? "h-9" : "h-0 group-hover:h-5"
      }`}
    />
  )
}
