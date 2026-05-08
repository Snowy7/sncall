import { mutation, query } from "./_generated/server"
import { v } from "convex/values"
import { getCurrentUserOrThrow } from "./users"

export const list = query({
  args: { channelId: v.id("channels"), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx)
    const channel = await ctx.db.get(args.channelId)
    if (!channel) return []
    const membership = await ctx.db
      .query("members")
      .withIndex("by_server_and_user", (q) =>
        q.eq("serverId", channel.serverId).eq("userId", user._id),
      )
      .unique()
    if (!membership) return []

    const limit = args.limit ?? 100
    const raw = await ctx.db
      .query("messages")
      .withIndex("by_channel", (q) => q.eq("channelId", args.channelId))
      .order("desc")
      .take(limit)

    const ordered = raw.reverse()
    const authorIds = Array.from(new Set(ordered.map((m) => m.authorId)))
    const authors = await Promise.all(authorIds.map((id) => ctx.db.get(id)))
    const authorMap = new Map(
      authors
        .filter((a): a is NonNullable<typeof a> => a !== null)
        .map((a) => [a._id, a]),
    )

    return ordered.map((m) => {
      const author = authorMap.get(m.authorId)
      return {
        _id: m._id,
        _creationTime: m._creationTime,
        content: m.content,
        editedAt: m.editedAt,
        authorId: m.authorId,
        author: author
          ? {
              _id: author._id,
              name: author.name,
              imageUrl: author.imageUrl,
            }
          : null,
      }
    })
  },
})

export const send = mutation({
  args: { channelId: v.id("channels"), content: v.string() },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx)
    const channel = await ctx.db.get(args.channelId)
    if (!channel) throw new Error("Channel not found")
    if (channel.type !== "text") throw new Error("Cannot send messages to voice channel")
    const membership = await ctx.db
      .query("members")
      .withIndex("by_server_and_user", (q) =>
        q.eq("serverId", channel.serverId).eq("userId", user._id),
      )
      .unique()
    if (!membership) throw new Error("Not a member")

    const trimmed = args.content.trim()
    if (trimmed.length === 0) throw new Error("Message cannot be empty")
    if (trimmed.length > 2000) throw new Error("Message too long (max 2000 chars)")

    return await ctx.db.insert("messages", {
      channelId: args.channelId,
      authorId: user._id,
      content: trimmed,
    })
  },
})

export const edit = mutation({
  args: { messageId: v.id("messages"), content: v.string() },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx)
    const message = await ctx.db.get(args.messageId)
    if (!message) throw new Error("Message not found")
    if (message.authorId !== user._id) throw new Error("Not your message")
    const trimmed = args.content.trim()
    if (trimmed.length === 0) throw new Error("Message cannot be empty")
    if (trimmed.length > 2000) throw new Error("Message too long")
    await ctx.db.patch(args.messageId, {
      content: trimmed,
      editedAt: Date.now(),
    })
  },
})

export const remove = mutation({
  args: { messageId: v.id("messages") },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx)
    const message = await ctx.db.get(args.messageId)
    if (!message) throw new Error("Message not found")
    const channel = await ctx.db.get(message.channelId)
    if (!channel) throw new Error("Channel missing")
    const membership = await ctx.db
      .query("members")
      .withIndex("by_server_and_user", (q) =>
        q.eq("serverId", channel.serverId).eq("userId", user._id),
      )
      .unique()
    if (!membership) throw new Error("Not a member")
    const isAuthor = message.authorId === user._id
    const canModerate = membership.role === "owner" || membership.role === "admin"
    if (!isAuthor && !canModerate) throw new Error("Forbidden")
    await ctx.db.delete(args.messageId)
  },
})
