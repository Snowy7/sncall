import { createFileRoute, Outlet } from "@tanstack/react-router"
import { Show, RedirectToSignIn } from "@clerk/tanstack-react-start"
import { ServerList } from "@/components/server-list"
import { AuthBootstrap } from "@/components/auth-bootstrap"

export const Route = createFileRoute("/app")({ component: AppShell })

function AppShell() {
  return (
    <>
      <Show when="signed-out">
        <RedirectToSignIn />
      </Show>
      <Show when="signed-in">
        <AuthBootstrap>
          <div className="flex h-svh w-full overflow-hidden">
            <div className="hidden md:flex">
              <ServerList />
            </div>
            <Outlet />
          </div>
        </AuthBootstrap>
      </Show>
    </>
  )
}
