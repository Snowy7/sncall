import { ConvexReactClient } from "convex/react"

const url = import.meta.env.VITE_CONVEX_URL as string | undefined

if (!url && import.meta.env.PROD) {
  throw new Error("Missing VITE_CONVEX_URL")
}

export const convex = new ConvexReactClient(url ?? "https://placeholder.convex.cloud")
