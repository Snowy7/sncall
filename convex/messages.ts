import { mutation, query } from "./_generated/server"
import { v } from "convex/values"
import { getCurrentUserOrThrow } from "./users"
import { ensureChannelAccess } from "./access"
import { attachmentValidator } from "./schema"
import type { Doc, Id } from "./_generated/dataModel"

export const list = query({
  args: { channelId: v.id("channels"), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx)
    try {
      await ensureChannelAccess(ctx, args.channelId, user._id)
    } catch {
      return []
    }

    const limit = args.limit ?? 100
    const raw = await ctx.db
      .query("messages")
      .withIndex("by_channel", (q) => q.eq("channelId", args.channelId))
      .order("desc")
      .take(limit)

    const ordered = raw.reverse()

    const userIdSet = new Set<Id<"users">>()
    for (const m of ordered) {
      userIdSet.add(m.authorId)
      for (const id of m.mentions ?? []) userIdSet.add(id)
    }
    const replyIds = ordered
      .map((m) => m.replyToId)
      .filter((id): id is Id<"messages"> => !!id)

    const [authors, replies] = await Promise.all([
      Promise.all([...userIdSet].map((id) => ctx.db.get(id))),
      Promise.all(replyIds.map((id) => ctx.db.get(id))),
    ])
    const userMap = new Map<Id<"users">, Doc<"users">>()
    for (const a of authors) {
      if (a) userMap.set(a._id, a)
    }
    const replyMap = new Map<Id<"messages">, Doc<"messages">>()
    for (const r of replies) {
      if (r) replyMap.set(r._id, r)
    }
    const replyAuthorIds = [...replies]
      .filter((r): r is Doc<"messages"> => !!r)
      .map((r) => r.authorId)
    for (const id of replyAuthorIds) {
      if (!userMap.has(id)) {
        const u = await ctx.db.get(id)
        if (u) userMap.set(u._id, u)
      }
    }

    const messageIds = ordered.map((m) => m._id)
    const reactionsByMessage = new Map<Id<"messages">, Doc<"messageReactions">[]>()
    for (const id of messageIds) {
      const reactions = await ctx.db
        .query("messageReactions")
        .withIndex("by_message", (q) => q.eq("messageId", id))
        .collect()
      reactionsByMessage.set(id, reactions)
    }

    const attachmentsToHydrate: Array<{ messageIdx: number; attIdx: number; storageId: Id<"_storage"> }> = []
    ordered.forEach((m, i) => {
      ;(m.attachments ?? []).forEach((a, j) => {
        attachmentsToHydrate.push({
          messageIdx: i,
          attIdx: j,
          storageId: a.storageId,
        })
      })
    })
    const urls = await Promise.all(
      attachmentsToHydrate.map((a) => ctx.storage.getUrl(a.storageId)),
    )
    const urlByKey = new Map<string, string | null>()
    attachmentsToHydrate.forEach((a, i) => {
      urlByKey.set(`${a.messageIdx}:${a.attIdx}`, urls[i])
    })

    return ordered.map((m, i) => {
      const author = userMap.get(m.authorId)
      const reactionsRaw = reactionsByMessage.get(m._id) ?? []
      const grouped = new Map<
        string,
        { emoji: string; count: number; mine: boolean; userIds: Id<"users">[] }
      >()
      for (const r of reactionsRaw) {
        const g = grouped.get(r.emoji) ?? {
          emoji: r.emoji,
          count: 0,
          mine: false,
          userIds: [],
        }
        g.count += 1
        g.userIds.push(r.userId)
        if (r.userId === user._id) g.mine = true
        grouped.set(r.emoji, g)
      }

      const replyDoc = m.replyToId ? replyMap.get(m.replyToId) ?? null : null
      const replyAuthor = replyDoc ? userMap.get(replyDoc.authorId) : null

      const mentionUsers = (m.mentions ?? [])
        .map((id) => userMap.get(id))
        .filter((u): u is Doc<"users"> => !!u)
        .map((u) => ({ _id: u._id, name: u.name }))

      const attachments = (m.attachments ?? []).map((a, j) => ({
        ...a,
        url: urlByKey.get(`${i}:${j}`) ?? null,
      }))

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
        reactions: [...grouped.values()].sort((a, b) => b.count - a.count),
        replyTo: replyDoc
          ? {
              _id: replyDoc._id,
              content: replyDoc.content,
              authorId: replyDoc.authorId,
              author: replyAuthor
                ? { _id: replyAuthor._id, name: replyAuthor.name }
                : null,
            }
          : null,
        mentions: mentionUsers,
        attachments,
      }
    })
  },
})

export const send = mutation({
  args: {
    channelId: v.id("channels"),
    content: v.string(),
    replyToId: v.optional(v.id("messages")),
    mentions: v.optional(v.array(v.id("users"))),
    attachments: v.optional(v.array(attachmentValidator)),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx)
    const { channel } = await ensureChannelAccess(ctx, args.channelId, user._id)
    if (channel.type === "voice")
      throw new Error("Cannot send messages to voice channel")

    const trimmed = args.content.trim()
    const hasAttachments = (args.attachments ?? []).length > 0
    if (trimmed.length === 0 && !hasAttachments)
      throw new Error("Message cannot be empty")
    if (trimmed.length > 2000) throw new Error("Message too long (max 2000 chars)")

    if (args.replyToId) {
      const target = await ctx.db.get(args.replyToId)
      if (!target || target.channelId !== args.channelId) {
        throw new Error("Reply target not in this channel")
      }
    }

    const cleanedMentions = args.mentions
      ? Array.from(new Set(args.mentions))
      : undefined

    return await ctx.db.insert("messages", {
      channelId: args.channelId,
      authorId: user._id,
      content: trimmed,
      replyToId: args.replyToId,
      mentions: cleanedMentions,
      attachments: args.attachments,
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
    const access = await ensureChannelAccess(ctx, message.channelId, user._id)
    const isAuthor = message.authorId === user._id
    const canModerate = access.role === "owner" || access.role === "admin"
    if (!isAuthor && !canModerate) throw new Error("Forbidden")

    const reactions = await ctx.db
      .query("messageReactions")
      .withIndex("by_message", (q) => q.eq("messageId", args.messageId))
      .collect()
    for (const r of reactions) await ctx.db.delete(r._id)

    if (message.attachments) {
      for (const a of message.attachments) {
        try {
          await ctx.storage.delete(a.storageId)
        } catch {}
      }
    }

    await ctx.db.delete(args.messageId)
  },
})
