import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

export const attachmentValidator = v.object({
  storageId: v.id("_storage"),
  name: v.string(),
  contentType: v.string(),
  size: v.number(),
  width: v.optional(v.number()),
  height: v.optional(v.number()),
})

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    name: v.string(),
    email: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    status: v.union(
      v.literal("online"),
      v.literal("idle"),
      v.literal("dnd"),
      v.literal("offline"),
    ),
    lastSeen: v.number(),
  }).index("by_clerk_id", ["clerkId"]),

  servers: defineTable({
    name: v.string(),
    imageUrl: v.optional(v.string()),
    ownerId: v.id("users"),
    inviteCode: v.string(),
  })
    .index("by_owner", ["ownerId"])
    .index("by_invite_code", ["inviteCode"]),

  members: defineTable({
    serverId: v.id("servers"),
    userId: v.id("users"),
    role: v.union(
      v.literal("owner"),
      v.literal("admin"),
      v.literal("member"),
    ),
    nickname: v.optional(v.string()),
    joinedAt: v.number(),
  })
    .index("by_server", ["serverId"])
    .index("by_user", ["userId"])
    .index("by_server_and_user", ["serverId", "userId"]),

  channels: defineTable({
    serverId: v.optional(v.id("servers")),
    name: v.string(),
    type: v.union(v.literal("text"), v.literal("voice"), v.literal("dm")),
    position: v.number(),
    topic: v.optional(v.string()),
  }).index("by_server", ["serverId"]),

  dmParticipants: defineTable({
    channelId: v.id("channels"),
    userId: v.id("users"),
    otherUserId: v.id("users"),
  })
    .index("by_channel", ["channelId"])
    .index("by_user", ["userId"])
    .index("by_user_pair", ["userId", "otherUserId"]),

  messages: defineTable({
    channelId: v.id("channels"),
    authorId: v.id("users"),
    content: v.string(),
    editedAt: v.optional(v.number()),
    replyToId: v.optional(v.id("messages")),
    mentions: v.optional(v.array(v.id("users"))),
    attachments: v.optional(v.array(attachmentValidator)),
  }).index("by_channel", ["channelId"]),

  messageReactions: defineTable({
    messageId: v.id("messages"),
    channelId: v.id("channels"),
    userId: v.id("users"),
    emoji: v.string(),
  })
    .index("by_message", ["messageId"])
    .index("by_message_and_user", ["messageId", "userId", "emoji"]),

  readState: defineTable({
    userId: v.id("users"),
    channelId: v.id("channels"),
    lastReadAt: v.number(),
  }).index("by_user_and_channel", ["userId", "channelId"]),

  typingState: defineTable({
    channelId: v.id("channels"),
    userId: v.id("users"),
    expiresAt: v.number(),
  })
    .index("by_channel", ["channelId"])
    .index("by_channel_and_user", ["channelId", "userId"]),

  voiceParticipants: defineTable({
    channelId: v.id("channels"),
    userId: v.id("users"),
    joinedAt: v.number(),
  })
    .index("by_channel", ["channelId"])
    .index("by_user", ["userId"])
    .index("by_channel_and_user", ["channelId", "userId"]),

  polls: defineTable({
    messageId: v.id("messages"),
    channelId: v.id("channels"),
    authorId: v.id("users"),
    question: v.string(),
    options: v.array(v.string()),
    multiSelect: v.boolean(),
    closesAt: v.optional(v.number()),
    closedAt: v.optional(v.number()),
  })
    .index("by_message", ["messageId"])
    .index("by_channel", ["channelId"]),

  pollVotes: defineTable({
    pollId: v.id("polls"),
    userId: v.id("users"),
    optionIndex: v.number(),
  })
    .index("by_poll", ["pollId"])
    .index("by_poll_and_user", ["pollId", "userId"]),
})
