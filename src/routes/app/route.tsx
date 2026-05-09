import { createFileRoute, Outlet } from "@tanstack/react-router"
import { Show, RedirectToSignIn } from "@clerk/tanstack-react-start"
import { ServerList } from "@/components/server-list"
import { AuthBootstrap } from "@/components/auth-bootstrap"
import { VoiceProvider } from "@/components/voice/voice-provider"
import { VoiceSettingsDialog } from "@/components/voice/voice-settings-dialog"
import { VoiceReactionsOverlay } from "@/components/voice/voice-reactions-overlay"

export const Route = createFileRoute("/app")({ component: AppShell })

function AppShell() {
  return (
    <>
      <Show when="signed-out">
        <RedirectToSignIn />
      </Show>
      <Show when="signed-in">
        <AuthBootstrap>
          <VoiceProvider>
            <div className="flex h-svh w-full overflow-hidden">
              <div className="hidden md:flex">
                <ServerList />
              </div>
              <Outlet />
            </div>
            <VoiceSettingsDialog />
            <VoiceReactionsOverlay />
          </VoiceProvider>
        </AuthBootstrap>
      </Show>
    </>
  )
}
