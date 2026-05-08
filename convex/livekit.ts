"use node"

import { action } from "./_generated/server"
import { v } from "convex/values"
import { AccessToken } from "livekit-server-sdk"
import { api } from "./_generated/api"

export const issueToken = action({
  args: { channelId: v.id("channels") },
  handler: async (ctx, args): Promise<{ token: string; url: string }> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")

    const channel = await ctx.runQuery(api.channels.get, {
      channelId: args.channelId,
    })
    if (!channel) throw new Error("Channel not found or no access")
    if (channel.type !== "voice") throw new Error("Not a voice channel")

    const apiKey = process.env.LIVEKIT_API_KEY
    const apiSecret = process.env.LIVEKIT_API_SECRET
    const wsUrl = process.env.LIVEKIT_URL
    if (!apiKey || !apiSecret || !wsUrl) {
      throw new Error("LiveKit env not configured")
    }

    const me = await ctx.runQuery(api.users.me)
    if (!me) throw new Error("User not provisioned")

    const at = new AccessToken(apiKey, apiSecret, {
      identity: me._id,
      name: me.name,
      metadata: JSON.stringify({ imageUrl: me.imageUrl ?? null }),
      ttl: 60 * 60,
    })
    at.addGrant({
      room: `channel-${args.channelId}`,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    })
    const token = await at.toJwt()
    return { token, url: wsUrl }
  },
})
