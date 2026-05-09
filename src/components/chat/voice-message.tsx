import { useEffect, useRef, useState } from "react"
import { Pause, Play } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"

const BAR_COUNT = 48

export function VoiceMessage({
  url,
  size,
}: {
  url: string
  size: number
}) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [bars, setBars] = useState<number[] | null>(null)
  const [duration, setDuration] = useState<number | null>(null)
  const [progress, setProgress] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(url)
        const buf = await res.arrayBuffer()
        const Ctor =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext
        if (!Ctor) return
        const ac = new Ctor()
        const audio = await ac.decodeAudioData(buf)
        const channel = audio.getChannelData(0)
        const block = Math.floor(channel.length / BAR_COUNT)
        const out: number[] = []
        let max = 0
        for (let i = 0; i < BAR_COUNT; i++) {
          let sum = 0
          const start = i * block
          for (let j = 0; j < block; j++) sum += Math.abs(channel[start + j] ?? 0)
          const v = sum / block
          out.push(v)
          if (v > max) max = v
        }
        if (cancelled) {
          ac.close().catch(() => {})
          return
        }
        const norm = max > 0 ? out.map((v) => v / max) : out
        setBars(norm)
        setDuration(audio.duration)
        ac.close().catch(() => {})
      } catch {}
    })()
    return () => {
      cancelled = true
    }
  }, [url])

  useEffect(() => {
    const a = audioRef.current
    if (!a) return
    const onTime = () => {
      if (!a.duration || a.duration === Infinity) return
      setProgress(a.currentTime / a.duration)
    }
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    const onEnd = () => {
      setPlaying(false)
      setProgress(1)
    }
    const onLoaded = () => {
      setLoaded(true)
      if (a.duration && a.duration !== Infinity) setDuration(a.duration)
    }
    a.addEventListener("timeupdate", onTime)
    a.addEventListener("play", onPlay)
    a.addEventListener("pause", onPause)
    a.addEventListener("ended", onEnd)
    a.addEventListener("loadedmetadata", onLoaded)
    return () => {
      a.removeEventListener("timeupdate", onTime)
      a.removeEventListener("play", onPlay)
      a.removeEventListener("pause", onPause)
      a.removeEventListener("ended", onEnd)
      a.removeEventListener("loadedmetadata", onLoaded)
    }
  }, [])

  function toggle() {
    const a = audioRef.current
    if (!a) return
    if (a.paused) void a.play()
    else a.pause()
  }

  function seek(e: React.MouseEvent<HTMLDivElement>) {
    const a = audioRef.current
    if (!a || !a.duration || a.duration === Infinity) return
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    a.currentTime = pct * a.duration
  }

  const totalSec = duration ? Math.round(duration) : null

  return (
    <div className="mt-1 flex max-w-sm items-center gap-3 rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
      <button
        type="button"
        onClick={toggle}
        disabled={!loaded}
        aria-label={playing ? "Pause" : "Play"}
        className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition disabled:opacity-50 hover:bg-primary/90"
      >
        {playing ? (
          <Pause className="size-4" weight="fill" />
        ) : (
          <Play className="size-4" weight="fill" />
        )}
      </button>
      <div className="flex-1 cursor-pointer" onClick={seek}>
        <div className="flex h-7 items-end gap-[2px]">
          {(bars ?? Array.from({ length: BAR_COUNT }, () => 0.5)).map((v, i) => {
            const filled = i / BAR_COUNT < progress
            return (
              <span
                key={i}
                className={cn(
                  "block w-[3px] rounded-sm transition-colors",
                  filled ? "bg-primary" : "bg-muted-foreground/30",
                )}
                style={{
                  height: `${4 + v * 22}px`,
                }}
              />
            )
          })}
        </div>
      </div>
      <div className="text-xs tabular-nums text-muted-foreground">
        {totalSec !== null ? formatSec(totalSec) : "·"}
        {size > 0 ? (
          <span className="ml-2 text-[10px]">
            {Math.round(size / 1024)} KB
          </span>
        ) : null}
      </div>
      <audio ref={audioRef} src={url} preload="metadata" />
    </div>
  )
}

function formatSec(s: number) {
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${r.toString().padStart(2, "0")}`
}
