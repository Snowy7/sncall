import { mutation, query } from "./_generated/server"
import { v } from "convex/values"
import { getCurrentUserOrThrow } from "./users"

async function ensureMember(
  ctx: { db: any; auth: any },
  serverId: any,
  userId: any,
) {
  const membership = await ctx.db
    .query("members")
    .withIndex("by_server_and_user", (q: any) =>
      q.eq("serverId", serverId).eq("userId", userId),
    )
    .unique()
  if (!membership) throw new Error("Not a member of this server")
  return membership
}

export const listForServer = query({
  args: { serverId: v.id("servers") },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx)
    await ensureMember(ctx, args.serverId, user._id)
    const channels = await ctx.db
      .query("channels")
      .withIndex("by_server", (q) => q.eq("serverId", args.serverId))
      .collect()
    return channels.sort((a, b) => a.position - b.position)
  },
})

export const get = query({
  args: { channelId: v.id("channels") },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx)
    const channel = await ctx.db.get(args.channelId)
    if (!channel) return null
    await ensureMember(ctx, channel.serverId, user._id)
    return channel
  },
})

export const create = mutation({
  args: {
    serverId: v.id("servers"),
    name: v.string(),
    type: v.union(v.literal("text"), v.literal("voice")),
    topic: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx)
    const membership = await ensureMember(ctx, args.serverId, user._id)
    if (membership.role === "member") {
      throw new Error("Only admins or owners can create channels")
    }
    const trimmed = args.name.trim().toLowerCase().replace(/\s+/g, "-")
    if (trimmed.length < 1 || trimmed.length > 50) {
      throw new Error("Channel name must be 1-50 characters")
    }
    const existing = await ctx.db
      .query("channels")
      .withIndex("by_server", (q) => q.eq("serverId", args.serverId))
      .collect()
    const maxPos = existing.reduce((m, c) => Math.max(m, c.position), -1)
    return await ctx.db.insert("channels", {
      serverId: args.serverId,
      name: trimmed,
      type: args.type,
      position: maxPos + 1,
      topic: args.topic,
    })
  },
})

export const rename = mutation({
  args: { channelId: v.id("channels"), name: v.string() },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx)
    const channel = await ctx.db.get(args.channelId)
    if (!channel) throw new Error("Channel not found")
    const membership = await ensureMember(ctx, channel.serverId, user._id)
    if (membership.role === "member") throw new Error("Forbidden")
    const trimmed = args.name.trim().toLowerCase().replace(/\s+/g, "-")
    if (trimmed.length < 1 || trimmed.length > 50) {
      throw new Error("Channel name must be 1-50 characters")
    }
    await ctx.db.patch(args.channelId, { name: trimmed })
  },
})

export const remove = mutation({
  args: { channelId: v.id("channels") },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx)
    const channel = await ctx.db.get(args.channelId)
    if (!channel) throw new Error("Channel not found")
    const membership = await ensureMember(ctx, channel.serverId, user._id)
    if (membership.role === "member") throw new Error("Forbidden")

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_channel", (q) => q.eq("channelId", args.channelId))
      .collect()
    for (const m of messages) await ctx.db.delete(m._id)
    const participants = await ctx.db
      .query("voiceParticipants")
      .withIndex("by_channel", (q) => q.eq("channelId", args.channelId))
      .collect()
    for (const p of participants) await ctx.db.delete(p._id)
    await ctx.db.delete(args.channelId)
  },
})
