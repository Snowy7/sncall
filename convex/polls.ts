import { mutation, query } from "./_generated/server"
import { v } from "convex/values"
import { getCurrentUserOrThrow } from "./users"
import { ensureChannelAccess } from "./access"
import type { Id } from "./_generated/dataModel"

const MAX_OPTIONS = 8
const MAX_QUESTION_LEN = 200
const MAX_OPTION_LEN = 80

export const create = mutation({
  args: {
    channelId: v.id("channels"),
    question: v.string(),
    options: v.array(v.string()),
    multiSelect: v.optional(v.boolean()),
    durationMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx)
    const { channel } = await ensureChannelAccess(ctx, args.channelId, user._id)
    if (channel.type !== "text" && channel.type !== "dm") {
      throw new Error("Polls only allowed in text/DM channels")
    }
    const q = args.question.trim()
    if (!q) throw new Error("Question required")
    if (q.length > MAX_QUESTION_LEN) throw new Error("Question too long")
    const options = args.options
      .map((o) => o.trim())
      .filter((o) => o.length > 0)
    if (options.length < 2) throw new Error("At least 2 options required")
    if (options.length > MAX_OPTIONS)
      throw new Error(`Max ${MAX_OPTIONS} options`)
    for (const o of options) {
      if (o.length > MAX_OPTION_LEN)
        throw new Error(`Option too long: ${o.slice(0, 20)}…`)
    }

    const messageId = await ctx.db.insert("messages", {
      channelId: args.channelId,
      authorId: user._id,
      content: `📊 ${q}`,
    })
    const closesAt =
      args.durationMs && args.durationMs > 0
        ? Date.now() + args.durationMs
        : undefined
    const pollId = await ctx.db.insert("polls", {
      messageId,
      channelId: args.channelId,
      authorId: user._id,
      question: q,
      options,
      multiSelect: !!args.multiSelect,
      closesAt,
    })
    return { messageId, pollId }
  },
})

export const vote = mutation({
  args: { pollId: v.id("polls"), optionIndex: v.number() },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx)
    const poll = await ctx.db.get(args.pollId)
    if (!poll) throw new Error("Poll not found")
    if (poll.closedAt) throw new Error("Poll is closed")
    if (poll.closesAt && Date.now() >= poll.closesAt) {
      await ctx.db.patch(poll._id, { closedAt: poll.closesAt })
      throw new Error("Poll is closed")
    }
    await ensureChannelAccess(ctx, poll.channelId, user._id)
    if (args.optionIndex < 0 || args.optionIndex >= poll.options.length) {
      throw new Error("Invalid option")
    }

    const existing = await ctx.db
      .query("pollVotes")
      .withIndex("by_poll_and_user", (q) =>
        q.eq("pollId", args.pollId).eq("userId", user._id),
      )
      .collect()

    const matching = existing.find((v) => v.optionIndex === args.optionIndex)
    if (matching) {
      await ctx.db.delete(matching._id)
      return
    }
    if (!poll.multiSelect) {
      for (const v of existing) await ctx.db.delete(v._id)
    }
    await ctx.db.insert("pollVotes", {
      pollId: args.pollId,
      userId: user._id,
      optionIndex: args.optionIndex,
    })
  },
})

export const close = mutation({
  args: { pollId: v.id("polls") },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx)
    const poll = await ctx.db.get(args.pollId)
    if (!poll) throw new Error("Poll not found")
    if (poll.authorId !== user._id) throw new Error("Only the author can close")
    if (poll.closedAt) return
    await ctx.db.patch(args.pollId, { closedAt: Date.now() })
  },
})

export const get = query({
  args: { messageId: v.id("messages") },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx)
    const poll = await ctx.db
      .query("polls")
      .withIndex("by_message", (q) => q.eq("messageId", args.messageId))
      .unique()
    if (!poll) return null
    try {
      await ensureChannelAccess(ctx, poll.channelId, user._id)
    } catch {
      return null
    }
    const votes = await ctx.db
      .query("pollVotes")
      .withIndex("by_poll", (q) => q.eq("pollId", poll._id))
      .collect()
    const counts = new Array<number>(poll.options.length).fill(0)
    const myVotes = new Set<number>()
    for (const v of votes) {
      counts[v.optionIndex] = (counts[v.optionIndex] ?? 0) + 1
      if (v.userId === user._id) myVotes.add(v.optionIndex)
    }
    const total = votes.length
    const closed =
      !!poll.closedAt ||
      (!!poll.closesAt && Date.now() >= poll.closesAt)
    return {
      pollId: poll._id,
      authorId: poll.authorId,
      question: poll.question,
      options: poll.options,
      multiSelect: poll.multiSelect,
      counts,
      total,
      myVotes: [...myVotes],
      closed,
      closesAt: poll.closesAt ?? null,
    } as {
      pollId: Id<"polls">
      authorId: Id<"users">
      question: string
      options: string[]
      multiSelect: boolean
      counts: number[]
      total: number
      myVotes: number[]
      closed: boolean
      closesAt: number | null
    }
  },
})
