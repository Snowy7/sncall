import { mutation, query } from "./_generated/server"
import { v } from "convex/values"
import { getCurrentUserOrThrow } from "./users"

function makeInviteCode() {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789"
  let s = ""
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)]
  return s
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return []
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique()
    if (!user) return []
    const memberships = await ctx.db
      .query("members")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect()
    const servers = await Promise.all(
      memberships.map(async (m) => {
        const s = await ctx.db.get(m.serverId)
        if (!s) return null
        return { ...s, role: m.role }
      }),
    )
    return servers.filter((s): s is NonNullable<typeof s> => s !== null)
  },
})

export const get = query({
  args: { serverId: v.id("servers") },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx)
    const member = await ctx.db
      .query("members")
      .withIndex("by_server_and_user", (q) =>
        q.eq("serverId", args.serverId).eq("userId", user._id),
      )
      .unique()
    if (!member) return null
    const server = await ctx.db.get(args.serverId)
    if (!server) return null
    return { ...server, role: member.role }
  },
})

export const create = mutation({
  args: { name: v.string(), imageUrl: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx)
    const trimmed = args.name.trim()
    if (trimmed.length < 2 || trimmed.length > 50) {
      throw new Error("Server name must be 2-50 characters")
    }
    const inviteCode = makeInviteCode()
    const serverId = await ctx.db.insert("servers", {
      name: trimmed,
      imageUrl: args.imageUrl,
      ownerId: user._id,
      inviteCode,
    })
    await ctx.db.insert("members", {
      serverId,
      userId: user._id,
      role: "owner",
      joinedAt: Date.now(),
    })
    await ctx.db.insert("channels", {
      serverId,
      name: "general",
      type: "text",
      position: 0,
    })
    await ctx.db.insert("channels", {
      serverId,
      name: "General",
      type: "voice",
      position: 1,
    })
    return serverId
  },
})

export const update = mutation({
  args: {
    serverId: v.id("servers"),
    name: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx)
    const server = await ctx.db.get(args.serverId)
    if (!server) throw new Error("Server not found")
    if (server.ownerId !== user._id) throw new Error("Only owner can update")
    const patch: Record<string, unknown> = {}
    if (args.name !== undefined) {
      const trimmed = args.name.trim()
      if (trimmed.length < 2 || trimmed.length > 50) {
        throw new Error("Server name must be 2-50 characters")
      }
      patch.name = trimmed
    }
    if (args.imageUrl !== undefined) patch.imageUrl = args.imageUrl
    await ctx.db.patch(args.serverId, patch)
  },
})

export const remove = mutation({
  args: { serverId: v.id("servers") },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx)
    const server = await ctx.db.get(args.serverId)
    if (!server) throw new Error("Server not found")
    if (server.ownerId !== user._id) throw new Error("Only owner can delete")

    const channels = await ctx.db
      .query("channels")
      .withIndex("by_server", (q) => q.eq("serverId", args.serverId))
      .collect()
    for (const c of channels) {
      const messages = await ctx.db
        .query("messages")
        .withIndex("by_channel", (q) => q.eq("channelId", c._id))
        .collect()
      for (const m of messages) await ctx.db.delete(m._id)
      const participants = await ctx.db
        .query("voiceParticipants")
        .withIndex("by_channel", (q) => q.eq("channelId", c._id))
        .collect()
      for (const p of participants) await ctx.db.delete(p._id)
      await ctx.db.delete(c._id)
    }
    const members = await ctx.db
      .query("members")
      .withIndex("by_server", (q) => q.eq("serverId", args.serverId))
      .collect()
    for (const m of members) await ctx.db.delete(m._id)
    await ctx.db.delete(args.serverId)
  },
})

export const leave = mutation({
  args: { serverId: v.id("servers") },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx)
    const server = await ctx.db.get(args.serverId)
    if (!server) throw new Error("Server not found")
    if (server.ownerId === user._id) {
      throw new Error("Owner cannot leave; delete the server instead")
    }
    const membership = await ctx.db
      .query("members")
      .withIndex("by_server_and_user", (q) =>
        q.eq("serverId", args.serverId).eq("userId", user._id),
      )
      .unique()
    if (!membership) throw new Error("Not a member")
    await ctx.db.delete(membership._id)
  },
})

export const getByInviteCode = query({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const server = await ctx.db
      .query("servers")
      .withIndex("by_invite_code", (q) => q.eq("inviteCode", args.code))
      .unique()
    if (!server) return null
    const memberCount = (
      await ctx.db
        .query("members")
        .withIndex("by_server", (q) => q.eq("serverId", server._id))
        .collect()
    ).length
    return {
      _id: server._id,
      name: server.name,
      imageUrl: server.imageUrl,
      memberCount,
    }
  },
})

export const joinByInviteCode = mutation({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx)
    const server = await ctx.db
      .query("servers")
      .withIndex("by_invite_code", (q) => q.eq("inviteCode", args.code))
      .unique()
    if (!server) throw new Error("Invalid invite")
    const existing = await ctx.db
      .query("members")
      .withIndex("by_server_and_user", (q) =>
        q.eq("serverId", server._id).eq("userId", user._id),
      )
      .unique()
    if (existing) return server._id
    await ctx.db.insert("members", {
      serverId: server._id,
      userId: user._id,
      role: "member",
      joinedAt: Date.now(),
    })
    return server._id
  },
})

export const regenerateInvite = mutation({
  args: { serverId: v.id("servers") },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx)
    const server = await ctx.db.get(args.serverId)
    if (!server) throw new Error("Server not found")
    if (server.ownerId !== user._id) throw new Error("Only owner can regenerate invite")
    const inviteCode = makeInviteCode()
    await ctx.db.patch(args.serverId, { inviteCode })
    return inviteCode
  },
})
