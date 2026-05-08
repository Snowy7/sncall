import { mutation, query, type QueryCtx, type MutationCtx } from "./_generated/server"
import { v } from "convex/values"
import type { Id } from "./_generated/dataModel"

export async function getCurrentUserOrThrow(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) throw new Error("Not authenticated")
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .unique()
  if (!user) throw new Error("User not provisioned")
  return user
}

export async function getCurrentUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) return null
  return await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .unique()
}

export const me = query({
  args: {},
  handler: async (ctx) => {
    return await getCurrentUser(ctx)
  },
})

export const upsertFromClerk = mutation({
  args: {
    name: v.string(),
    email: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")

    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique()

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name,
        email: args.email,
        imageUrl: args.imageUrl,
        lastSeen: Date.now(),
      })
      return existing._id
    }

    return await ctx.db.insert("users", {
      clerkId: identity.subject,
      name: args.name,
      email: args.email,
      imageUrl: args.imageUrl,
      status: "online",
      lastSeen: Date.now(),
    })
  },
})

export const updateStatus = mutation({
  args: {
    status: v.union(
      v.literal("online"),
      v.literal("idle"),
      v.literal("dnd"),
      v.literal("offline"),
    ),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx)
    await ctx.db.patch(user._id, {
      status: args.status,
      lastSeen: Date.now(),
    })
  },
})

export const heartbeat = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx)
    if (!user) return
    await ctx.db.patch(user._id, { lastSeen: Date.now() })
  },
})

export const getMany = query({
  args: { ids: v.array(v.id("users")) },
  handler: async (ctx, args) => {
    const out: Array<{
      _id: Id<"users">
      name: string
      imageUrl?: string
      status: "online" | "idle" | "dnd" | "offline"
    }> = []
    for (const id of args.ids) {
      const u = await ctx.db.get(id)
      if (u) {
        out.push({
          _id: u._id,
          name: u.name,
          imageUrl: u.imageUrl,
          status: u.status,
        })
      }
    }
    return out
  },
})
