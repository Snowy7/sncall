import { useRef, useState } from "react"
import { useLocalParticipant, useParticipants } from "@livekit/components-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { initialsFromName } from "@/lib/format"
import { useVoice } from "./voice-provider"
import { Compass, X } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"

export function SpatialButton() {
  const voice = useVoice()
  return (
    <button
      type="button"
      onClick={() => voice.setSpatialOn(!voice.spatialOn)}
      aria-label={voice.spatialOn ? "Stop spatial audio" : "Spatial audio room"}
      title={voice.spatialOn ? "Stop spatial audio" : "Spatial audio room"}
      className={cn(
        "grid size-12 place-items-center rounded-full border transition",
        voice.spatialOn
          ? "border-violet-500/50 bg-violet-500/15 text-violet-500 hover:bg-violet-500/25"
          : "border-border/60 bg-card hover:bg-accent",
      )}
    >
      <Compass className="size-5" weight={voice.spatialOn ? "fill" : "regular"} />
    </button>
  )
}

function parseMeta(metadata: string | undefined): { imageUrl?: string } {
  if (!metadata) return {}
  try {
    const m = JSON.parse(metadata)
    return { imageUrl: typeof m?.imageUrl === "string" ? m.imageUrl : undefined }
  } catch {
    return {}
  }
}

export function SpatialRoom() {
  const voice = useVoice()
  const participants = useParticipants()
  const { localParticipant } = useLocalParticipant()
  const [dragging, setDragging] = useState(false)
  const surfaceRef = useRef<HTMLDivElement>(null)

  if (!voice.spatialOn) return null

  function pointerToPos(e: React.PointerEvent | PointerEvent) {
    const el = surfaceRef.current
    if (!el) return null
    const rect = el.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height
    return {
      x: Math.max(0.04, Math.min(0.96, x)),
      y: Math.max(0.04, Math.min(0.96, y)),
    }
  }

  function onPointerDown(e: React.PointerEvent) {
    if (e.button !== 0) return
    e.preventDefault()
    setDragging(true)
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    const pos = pointerToPos(e)
    if (pos) voice.setMyPosition(pos.x, pos.y)
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragging) return
    const pos = pointerToPos(e)
    if (pos) voice.setMyPosition(pos.x, pos.y)
  }
  function onPointerUp(e: React.PointerEvent) {
    setDragging(false)
    ;(e.target as Element).releasePointerCapture?.(e.pointerId)
  }

  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-violet-500/30 bg-gradient-to-br from-violet-500/10 via-background to-fuchsia-500/10 shadow-xl">
      <div className="flex items-center gap-2 border-b border-violet-500/20 bg-violet-500/10 px-3 py-1.5 text-xs">
        <Compass className="size-3.5 text-violet-500" weight="fill" />
        <span className="font-medium">Spatial room</span>
        <span className="text-muted-foreground">
          · drag your dot to move closer
        </span>
        <button
          type="button"
          onClick={() => voice.setSpatialOn(false)}
          aria-label="Stop spatial audio"
          className="ml-auto grid size-6 place-items-center rounded text-muted-foreground transition hover:bg-accent hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      </div>
      <div
        ref={surfaceRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="relative aspect-[2/1] w-full touch-none select-none"
        style={{
          backgroundImage:
            "radial-gradient(circle at 50% 50%, oklch(0.95 0.02 295 / 0.12), transparent 60%), repeating-linear-gradient(0deg, oklch(0.7 0.02 295 / 0.06) 0, oklch(0.7 0.02 295 / 0.06) 1px, transparent 1px, transparent 32px), repeating-linear-gradient(90deg, oklch(0.7 0.02 295 / 0.06) 0, oklch(0.7 0.02 295 / 0.06) 1px, transparent 1px, transparent 32px)",
        }}
      >
        {participants.map((p) => {
          const pos = voice.spatialPositions[p.identity]
          const x = pos?.x ?? 0.5
          const y = pos?.y ?? 0.5
          const me = p.identity === localParticipant.identity
          const name = p.name || p.identity
          const { imageUrl } = parseMeta(p.metadata)
          const speaking = p.isSpeaking
          return (
            <div
              key={p.identity}
              className={cn(
                "absolute -translate-x-1/2 -translate-y-1/2 transition-[left,top] duration-150 ease-out",
                me ? "z-10 cursor-grab active:cursor-grabbing" : "pointer-events-none",
              )}
              style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
            >
              <div className="relative">
                <span
                  className={cn(
                    "absolute inset-0 -m-3 rounded-full",
                    speaking
                      ? "bg-emerald-500/30 animate-pulse"
                      : "bg-violet-500/15",
                  )}
                  aria-hidden
                />
                <Avatar
                  className={cn(
                    "size-10 ring-2",
                    me
                      ? "ring-violet-500"
                      : speaking
                        ? "ring-emerald-500"
                        : "ring-border",
                  )}
                >
                  {imageUrl ? <AvatarImage src={imageUrl} alt={name} /> : null}
                  <AvatarFallback className="text-xs">
                    {initialsFromName(name)}
                  </AvatarFallback>
                </Avatar>
                <span className="absolute left-1/2 top-full -translate-x-1/2 translate-y-1 whitespace-nowrap rounded bg-background/90 px-1.5 py-0.5 text-[10px] font-medium shadow-sm backdrop-blur">
                  {me ? `you · ${name}` : name}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
