import type { QueryCtx, MutationCtx } from "./_generated/server"
import type { Doc, Id } from "./_generated/dataModel"

export async function ensureChannelAccess(
  ctx: QueryCtx | MutationCtx,
  channelId: Id<"channels">,
  userId: Id<"users">,
): Promise<{ channel: Doc<"channels">; role: "owner" | "admin" | "member" | "dm" }> {
  const channel = await ctx.db.get(channelId)
  if (!channel) throw new Error("Channel not found")

  if (channel.type === "dm") {
    const dm = await ctx.db
      .query("dmParticipants")
      .withIndex("by_channel", (q) => q.eq("channelId", channelId))
      .collect()
    if (!dm.some((p) => p.userId === userId)) {
      throw new Error("Not a participant in this DM")
    }
    return { channel, role: "dm" }
  }

  if (!channel.serverId) throw new Error("Channel has no server")
  const membership = await ctx.db
    .query("members")
    .withIndex("by_server_and_user", (q) =>
      q.eq("serverId", channel.serverId!).eq("userId", userId),
    )
    .unique()
  if (!membership) throw new Error("Not a member of this server")
  return { channel, role: membership.role }
}

