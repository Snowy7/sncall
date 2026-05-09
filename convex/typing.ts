import { mutation, query } from "./_generated/server"
import { v } from "convex/values"
import { getCurrentUserOrThrow } from "./users"
import { ensureChannelAccess } from "./access"

const TYPING_TTL_MS = 5_000

export const ping = mutation({
  args: { channelId: v.id("channels") },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx)
    await ensureChannelAccess(ctx, args.channelId, user._id)
    const now = Date.now()
    const expiresAt = now + TYPING_TTL_MS
    const existing = await ctx.db
      .query("typingState")
      .withIndex("by_channel_and_user", (q) =>
        q.eq("channelId", args.channelId).eq("userId", user._id),
      )
      .unique()
    if (existing) {
      await ctx.db.patch(existing._id, { expiresAt })
    } else {
      await ctx.db.insert("typingState", {
        channelId: args.channelId,
        userId: user._id,
        expiresAt,
      })
    }
  },
})

export const stop = mutation({
  args: { channelId: v.id("channels") },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx)
    const existing = await ctx.db
      .query("typingState")
      .withIndex("by_channel_and_user", (q) =>
        q.eq("channelId", args.channelId).eq("userId", user._id),
      )
      .unique()
    if (existing) await ctx.db.delete(existing._id)
  },
})

export const list = query({
  args: { channelId: v.id("channels") },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx)
    try {
      await ensureChannelAccess(ctx, args.channelId, user._id)
    } catch {
      return []
    }
    const now = Date.now()
    const all = await ctx.db
      .query("typingState")
      .withIndex("by_channel", (q) => q.eq("channelId", args.channelId))
      .collect()
    const active = all.filter(
      (t) => t.userId !== user._id && t.expiresAt > now,
    )
    const out = await Promise.all(
      active.map(async (t) => {
        const u = await ctx.db.get(t.userId)
        if (!u) return null
        return { userId: u._id, name: u.name }
      }),
    )
    return out.filter((x): x is NonNullable<typeof x> => x !== null)
  },
})
