import { mutation, query } from "./_generated/server"
import { v } from "convex/values"
import { getCurrentUserOrThrow } from "./users"

export const listForServer = query({
  args: { serverId: v.id("servers") },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx)
    const me = await ctx.db
      .query("members")
      .withIndex("by_server_and_user", (q) =>
        q.eq("serverId", args.serverId).eq("userId", user._id),
      )
      .unique()
    if (!me) return []
    const members = await ctx.db
      .query("members")
      .withIndex("by_server", (q) => q.eq("serverId", args.serverId))
      .collect()
    const enriched = await Promise.all(
      members.map(async (m) => {
        const u = await ctx.db.get(m.userId)
        if (!u) return null
        return {
          _id: m._id,
          userId: u._id,
          role: m.role,
          nickname: m.nickname,
          name: u.name,
          imageUrl: u.imageUrl,
          status: u.status,
          lastSeen: u.lastSeen,
        }
      }),
    )
    return enriched.filter((m): m is NonNullable<typeof m> => m !== null)
  },
})

export const setRole = mutation({
  args: {
    memberId: v.id("members"),
    role: v.union(v.literal("admin"), v.literal("member")),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx)
    const target = await ctx.db.get(args.memberId)
    if (!target) throw new Error("Member not found")
    const server = await ctx.db.get(target.serverId)
    if (!server) throw new Error("Server not found")
    if (server.ownerId !== user._id) throw new Error("Only owner can change roles")
    if (target.role === "owner") throw new Error("Cannot demote owner")
    await ctx.db.patch(args.memberId, { role: args.role })
  },
})

export const kick = mutation({
  args: { memberId: v.id("members") },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx)
    const target = await ctx.db.get(args.memberId)
    if (!target) throw new Error("Member not found")
    const server = await ctx.db.get(target.serverId)
    if (!server) throw new Error("Server not found")
    const me = await ctx.db
      .query("members")
      .withIndex("by_server_and_user", (q) =>
        q.eq("serverId", target.serverId).eq("userId", user._id),
      )
      .unique()
    if (!me) throw new Error("Not a member")
    const canKick = me.role === "owner" || (me.role === "admin" && target.role === "member")
    if (!canKick) throw new Error("Forbidden")
    if (target.role === "owner") throw new Error("Cannot kick owner")
    await ctx.db.delete(args.memberId)
  },
})
