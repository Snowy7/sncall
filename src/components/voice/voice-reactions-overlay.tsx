import { useParams } from "@tanstack/react-router"
import { useVoice } from "./voice-provider"

export function VoiceReactionsOverlay() {
  const voice = useVoice()
  const params = useParams({ strict: false }) as { channelId?: string }

  if (!voice.active) return null
  const onCallView = params.channelId === voice.active.channelId
  if (onCallView) return null
  if (voice.floatingReactions.length === 0) return null

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed bottom-24 left-3 z-50 hidden md:block"
    >
      <div className="relative h-32 w-48">
        {voice.floatingReactions.map((r, i) => (
          <span
            key={r.id}
            className="absolute bottom-0 animate-[reactionFloat_2.4s_ease-out_forwards] text-3xl drop-shadow-md"
            style={{ left: `${(i % 5) * 18}%` }}
          >
            {r.emoji}
          </span>
        ))}
      </div>
    </div>
  )
}
