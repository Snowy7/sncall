import { HeadContent, Scripts, createRootRoute, Outlet } from "@tanstack/react-router"
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools"
import { TanStackDevtools } from "@tanstack/react-devtools"
import { ClerkProvider, useAuth } from "@clerk/tanstack-react-start"
import { ConvexProviderWithClerk } from "convex/react-clerk"
import { Toaster } from "@/components/ui/sonner"

import appCss from "../styles.css?url"
import { convex } from "@/lib/convex"

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "sncall" },
      { name: "description", content: "Real-time chat, servers, and voice calls." },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  notFoundComponent: () => (
    <main className="flex min-h-svh items-center justify-center p-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-medium">404</h1>
        <p className="text-muted-foreground">This page doesn't exist.</p>
      </div>
    </main>
  ),
  shellComponent: RootDocument,
})

function RootDocument() {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body className="bg-background text-foreground antialiased">
        <ClerkProvider>
          <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
            <Outlet />
            <Toaster position="bottom-right" />
          </ConvexProviderWithClerk>
        </ClerkProvider>
        <TanStackDevtools
          config={{ position: "bottom-right" }}
          plugins={[
            { name: "Tanstack Router", render: <TanStackRouterDevtoolsPanel /> },
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}
