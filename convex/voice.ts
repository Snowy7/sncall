import { mutation, query } from "./_generated/server"
import { v } from "convex/values"
import { getCurrentUserOrThrow } from "./users"

export const join = mutation({
  args: { channelId: v.id("channels") },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx)
    const channel = await ctx.db.get(args.channelId)
    if (!channel) throw new Error("Channel not found")
    if (channel.type !== "voice") throw new Error("Not a voice channel")
    if (!channel.serverId) throw new Error("Channel has no server")
    const membership = await ctx.db
      .query("members")
      .withIndex("by_server_and_user", (q) =>
        q.eq("serverId", channel.serverId!).eq("userId", user._id),
      )
      .unique()
    if (!membership) throw new Error("Not a member")

    const existing = await ctx.db
      .query("voiceParticipants")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect()
    for (const p of existing) await ctx.db.delete(p._id)

    await ctx.db.insert("voiceParticipants", {
      channelId: args.channelId,
      userId: user._id,
      joinedAt: Date.now(),
    })
  },
})

export const leave = mutation({
  args: { channelId: v.id("channels") },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx)
    const existing = await ctx.db
      .query("voiceParticipants")
      .withIndex("by_channel_and_user", (q) =>
        q.eq("channelId", args.channelId).eq("userId", user._id),
      )
      .unique()
    if (existing) await ctx.db.delete(existing._id)
  },
})

export const listParticipants = query({
  args: { channelId: v.id("channels") },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx)
    const channel = await ctx.db.get(args.channelId)
    if (!channel) return []
    if (!channel.serverId) return []
    const membership = await ctx.db
      .query("members")
      .withIndex("by_server_and_user", (q) =>
        q.eq("serverId", channel.serverId!).eq("userId", user._id),
      )
      .unique()
    if (!membership) return []

    const participants = await ctx.db
      .query("voiceParticipants")
      .withIndex("by_channel", (q) => q.eq("channelId", args.channelId))
      .collect()
    const enriched = await Promise.all(
      participants.map(async (p) => {
        const u = await ctx.db.get(p.userId)
        if (!u) return null
        return {
          userId: u._id,
          name: u.name,
          imageUrl: u.imageUrl,
          joinedAt: p.joinedAt,
        }
      }),
    )
    return enriched.filter((p): p is NonNullable<typeof p> => p !== null)
  },
})
