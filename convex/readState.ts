import { mutation, query } from "./_generated/server"
import { v } from "convex/values"
import { getCurrentUserOrThrow } from "./users"
import { ensureChannelAccess } from "./access"
import type { Id } from "./_generated/dataModel"

export const markRead = mutation({
  args: { channelId: v.id("channels") },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx)
    await ensureChannelAccess(ctx, args.channelId, user._id)
    const now = Date.now()
    const existing = await ctx.db
      .query("readState")
      .withIndex("by_user_and_channel", (q) =>
        q.eq("userId", user._id).eq("channelId", args.channelId),
      )
      .unique()
    if (existing) {
      await ctx.db.patch(existing._id, { lastReadAt: now })
    } else {
      await ctx.db.insert("readState", {
        userId: user._id,
        channelId: args.channelId,
        lastReadAt: now,
      })
    }
  },
})

export const summary = query({
  args: { channelIds: v.array(v.id("channels")) },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx)
    const out: Record<string, { unread: number; mentions: number }> = {}

    for (const channelId of args.channelIds) {
      const state = await ctx.db
        .query("readState")
        .withIndex("by_user_and_channel", (q) =>
          q.eq("userId", user._id).eq("channelId", channelId),
        )
        .unique()
      const lastReadAt = state?.lastReadAt ?? 0

      const recent = await ctx.db
        .query("messages")
        .withIndex("by_channel", (q) => q.eq("channelId", channelId))
        .order("desc")
        .take(50)

      let unread = 0
      let mentions = 0
      for (const m of recent) {
        if (m._creationTime <= lastReadAt) continue
        if (m.authorId === user._id) continue
        unread += 1
        if ((m.mentions ?? []).includes(user._id)) mentions += 1
      }
      out[channelId] = { unread, mentions }
    }
    return out as Record<Id<"channels">, { unread: number; mentions: number }>
  },
})
