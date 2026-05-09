import { createFileRoute, Outlet } from "@tanstack/react-router"
import { DmSidebar } from "@/components/dm/dm-sidebar"

export const Route = createFileRoute("/app/dms")({ component: DmsLayout })

function DmsLayout() {
  return (
    <>
      <div className="hidden md:flex">
        <DmSidebar />
      </div>
      <Outlet />
    </>
  )
}
