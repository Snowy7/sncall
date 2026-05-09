import { useEffect, useState } from "react"
import { useVoice } from "./voice-provider"

const CAPTION_VISIBLE_MS = 6000

export function CaptionsOverlay() {
  const voice = useVoice()
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!voice.captionsOn) return
    const id = window.setInterval(() => setNow(Date.now()), 500)
    return () => window.clearInterval(id)
  }, [voice.captionsOn])

  if (!voice.captionsOn) return null

  const visible = voice.captions.filter((c) => now - c.at < CAPTION_VISIBLE_MS)
  const recent = visible.slice(-3)

  return (
    <div
      aria-live="polite"
      className="pointer-events-none absolute inset-x-2 bottom-2 z-10 flex flex-col items-center gap-1 sm:bottom-4"
    >
      {recent.map((c) => (
        <div
          key={`${c.identity}-${c.at}`}
          className="max-w-3xl rounded-md bg-black/70 px-3 py-1.5 text-sm text-white shadow-lg backdrop-blur"
        >
          <span className="mr-2 text-xs font-semibold text-emerald-300">
            {c.name}:
          </span>
          {c.text}
          {!c.final ? (
            <span className="ml-1 inline-block animate-pulse text-white/60">…</span>
          ) : null}
        </div>
      ))}
    </div>
  )
}
