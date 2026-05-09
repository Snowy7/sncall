import { mutation, query } from "./_generated/server"
import { v } from "convex/values"
import { getCurrentUserOrThrow } from "./users"
import type { Doc, Id } from "./_generated/dataModel"

export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUserOrThrow(ctx)
    const myParts = await ctx.db
      .query("dmParticipants")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect()
    const out = await Promise.all(
      myParts.map(async (p) => {
        const channel = await ctx.db.get(p.channelId)
        if (!channel || channel.type !== "dm") return null
        const other = await ctx.db.get(p.otherUserId)
        if (!other) return null

        const lastMsg = await ctx.db
          .query("messages")
          .withIndex("by_channel", (q) => q.eq("channelId", channel._id))
          .order("desc")
          .first()

        return {
          channelId: channel._id,
          other: {
            _id: other._id,
            name: other.name,
            imageUrl: other.imageUrl,
            status: other.status,
          },
          lastMessageAt: lastMsg?._creationTime ?? channel._creationTime,
          lastMessagePreview: lastMsg ? lastMsg.content.slice(0, 80) : null,
        }
      }),
    )
    return out
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => b.lastMessageAt - a.lastMessageAt)
  },
})

export const open = mutation({
  args: { otherUserId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx)
    if (args.otherUserId === user._id) {
      throw new Error("Cannot DM yourself")
    }
    const other = await ctx.db.get(args.otherUserId)
    if (!other) throw new Error("User not found")

    const myParts = await ctx.db
      .query("dmParticipants")
      .withIndex("by_user_pair", (q) =>
        q.eq("userId", user._id).eq("otherUserId", args.otherUserId),
      )
      .collect()
    for (const p of myParts) {
      const ch = await ctx.db.get(p.channelId)
      if (ch && ch.type === "dm") return p.channelId
    }

    const channelId = await ctx.db.insert("channels", {
      name: "dm",
      type: "dm",
      position: 0,
    })
    await ctx.db.insert("dmParticipants", {
      channelId,
      userId: user._id,
      otherUserId: args.otherUserId,
    })
    await ctx.db.insert("dmParticipants", {
      channelId,
      userId: args.otherUserId,
      otherUserId: user._id,
    })
    return channelId
  },
})

export const findContacts = query({
  args: { search: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx)
    const myMemberships = await ctx.db
      .query("members")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect()
    const serverIds = Array.from(new Set(myMemberships.map((m) => m.serverId)))
    const otherIds = new Set<Id<"users">>()
    for (const sid of serverIds) {
      const members = await ctx.db
        .query("members")
        .withIndex("by_server", (q) => q.eq("serverId", sid))
        .collect()
      for (const m of members) {
        if (m.userId !== user._id) otherIds.add(m.userId)
      }
    }
    const all = await Promise.all([...otherIds].map((id) => ctx.db.get(id)))
    const filtered = all.filter((u): u is Doc<"users"> => u !== null)
    const q = args.search?.trim().toLowerCase()
    const matched = q
      ? filtered.filter((u) => u.name.toLowerCase().includes(q))
      : filtered
    return matched
      .slice(0, 30)
      .map((u) => ({
        _id: u._id,
        name: u.name,
        imageUrl: u.imageUrl,
        status: u.status,
      }))
  },
})

export const get = query({
  args: { channelId: v.id("channels") },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx)
    const channel = await ctx.db.get(args.channelId)
    if (!channel || channel.type !== "dm") return null
    const myPart = await ctx.db
      .query("dmParticipants")
      .withIndex("by_channel", (q) => q.eq("channelId", args.channelId))
      .collect()
    const me = myPart.find((p) => p.userId === user._id)
    if (!me) return null
    const other = await ctx.db.get(me.otherUserId)
    if (!other) return null
    return {
      channelId: channel._id,
      other: {
        _id: other._id,
        name: other.name,
        imageUrl: other.imageUrl,
        status: other.status,
      },
    }
  },
})
