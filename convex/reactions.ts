import { mutation } from "./_generated/server"
import { v } from "convex/values"
import { getCurrentUserOrThrow } from "./users"
import { ensureChannelAccess } from "./access"

export const toggle = mutation({
  args: { messageId: v.id("messages"), emoji: v.string() },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx)
    const message = await ctx.db.get(args.messageId)
    if (!message) throw new Error("Message not found")
    await ensureChannelAccess(ctx, message.channelId, user._id)

    const emoji = args.emoji.trim()
    if (!emoji) throw new Error("Empty emoji")
    if (emoji.length > 16) throw new Error("Emoji too long")

    const existing = await ctx.db
      .query("messageReactions")
      .withIndex("by_message_and_user", (q) =>
        q
          .eq("messageId", args.messageId)
          .eq("userId", user._id)
          .eq("emoji", emoji),
      )
      .unique()

    if (existing) {
      await ctx.db.delete(existing._id)
      return { added: false }
    }
    await ctx.db.insert("messageReactions", {
      messageId: args.messageId,
      channelId: message.channelId,
      userId: user._id,
      emoji,
    })
    return { added: true }
  },
})
