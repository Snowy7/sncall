import { useEffect, useRef, useState } from "react"
import { useLocalParticipant } from "@livekit/components-react"
import { useVoice } from "./voice-provider"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Television, X } from "@phosphor-icons/react"

declare global {
  interface Window {
    YT?: {
      Player: new (
        el: HTMLElement | string,
        opts: YtPlayerOptions,
      ) => YtPlayer
      PlayerState: { PLAYING: number; PAUSED: number; ENDED: number }
    }
    onYouTubeIframeAPIReady?: () => void
  }
}

type YtPlayerOptions = {
  videoId: string
  width?: number
  height?: number
  playerVars?: Record<string, string | number>
  events?: {
    onReady?: (e: { target: YtPlayer }) => void
    onStateChange?: (e: { data: number; target: YtPlayer }) => void
  }
}

type YtPlayer = {
  playVideo(): void
  pauseVideo(): void
  seekTo(seconds: number, allowSeekAhead?: boolean): void
  getCurrentTime(): number
  getPlayerState(): number
  destroy(): void
}

let ytLoading: Promise<void> | null = null
function loadYouTubeAPI(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve()
  if (window.YT?.Player) return Promise.resolve()
  if (ytLoading) return ytLoading
  ytLoading = new Promise<void>((resolve) => {
    const prev = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      prev?.()
      resolve()
    }
    const tag = document.createElement("script")
    tag.src = "https://www.youtube.com/iframe_api"
    document.head.appendChild(tag)
  })
  return ytLoading
}

export function WatchPartyButton() {
  const voice = useVoice()
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState("")

  const isActive = !!voice.watch

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (isActive) voice.stopWatch()
          else setOpen(true)
        }}
        aria-label={isActive ? "Stop watch party" : "Start watch party"}
        title={isActive ? "Stop watch party" : "Start watch party"}
        className={`grid size-12 place-items-center rounded-full border transition ${
          isActive
            ? "border-rose-500/40 bg-rose-500/10 text-rose-500 hover:bg-rose-500/20"
            : "border-border/60 bg-card hover:bg-accent"
        }`}
      >
        <Television className="size-5" weight={isActive ? "fill" : "regular"} />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Watch party</DialogTitle>
            <DialogDescription>
              Paste any YouTube link. Everyone in the call will see the player
              and you'll control playback.
            </DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            placeholder="https://youtube.com/watch?v=…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                voice.startWatch(url)
                setOpen(false)
                setUrl("")
              }
            }}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                voice.startWatch(url)
                setOpen(false)
                setUrl("")
              }}
              disabled={!url.trim()}
            >
              Start
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function WatchPartyPlayer() {
  const voice = useVoice()
  const { localParticipant } = useLocalParticipant()
  const containerRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<YtPlayer | null>(null)
  const lastReportRef = useRef(0)

  const watch = voice.watch
  const isHost = !!watch && watch.hostIdentity === localParticipant.identity

  useEffect(() => {
    if (!watch) return
    let cancelled = false
    void loadYouTubeAPI().then(() => {
      if (cancelled) return
      const Y = window.YT
      if (!Y || !containerRef.current) return
      containerRef.current.innerHTML = ""
      const slot = document.createElement("div")
      containerRef.current.appendChild(slot)
      new Y.Player(slot, {
        videoId: watch.videoId,
        width: 0,
        height: 0,
        playerVars: { autoplay: 1, rel: 0, modestbranding: 1, playsinline: 1 },
        events: {
          onReady: ({ target }) => {
            playerRef.current = target
            try {
              if (watch.currentTime > 0)
                target.seekTo(watch.currentTime, true)
              if (watch.playing) target.playVideo()
              else target.pauseVideo()
            } catch {}
          },
          onStateChange: ({ data, target }) => {
            if (!isHost) return
            const Y2 = window.YT
            if (!Y2) return
            if (
              data === Y2.PlayerState.PLAYING ||
              data === Y2.PlayerState.PAUSED
            ) {
              const t = target.getCurrentTime()
              voice.reportWatchState(data === Y2.PlayerState.PLAYING, t)
              lastReportRef.current = Date.now()
            }
          },
        },
      })
    })
    return () => {
      cancelled = true
      const p = playerRef.current
      playerRef.current = null
      try {
        p?.destroy()
      } catch {}
    }
  }, [watch?.videoId])

  useEffect(() => {
    if (!watch) return
    if (isHost) return
    const p = playerRef.current
    if (!p) return
    try {
      const local = p.getCurrentTime()
      const drift = Math.abs(local - watch.currentTime)
      if (drift > 1.5) p.seekTo(watch.currentTime, true)
      const Y = window.YT
      if (!Y) return
      const state = p.getPlayerState()
      if (watch.playing && state !== Y.PlayerState.PLAYING) p.playVideo()
      else if (!watch.playing && state === Y.PlayerState.PLAYING) p.pauseVideo()
    } catch {}
  }, [watch?.currentTime, watch?.playing, watch?.lastUpdateAt, isHost])

  useEffect(() => {
    if (!isHost || !watch) return
    const id = window.setInterval(() => {
      const p = playerRef.current
      if (!p) return
      try {
        const t = p.getCurrentTime()
        const Y = window.YT
        if (!Y) return
        const state = p.getPlayerState()
        const playing = state === Y.PlayerState.PLAYING
        if (Date.now() - lastReportRef.current > 4000) {
          voice.reportWatchState(playing, t)
          lastReportRef.current = Date.now()
        }
      } catch {}
    }, 2000)
    return () => window.clearInterval(id)
  }, [isHost, watch])

  if (!watch) return null

  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-border/60 bg-black shadow-xl">
      <div className="flex items-center gap-2 border-b border-white/10 bg-black/60 px-3 py-1.5 text-xs text-white">
        <Television className="size-3.5" />
        <span className="font-medium">Watch party</span>
        <span className="text-white/60">
          · {isHost ? "you're hosting" : "synced to host"}
        </span>
        <button
          type="button"
          onClick={() => {
            if (isHost) voice.stopWatch()
          }}
          disabled={!isHost}
          className="ml-auto grid size-6 place-items-center rounded text-white/70 transition hover:bg-white/10 hover:text-white disabled:opacity-40"
          aria-label="Stop watch party"
          title={isHost ? "End watch party" : "Only the host can end"}
        >
          <X className="size-3.5" />
        </button>
      </div>
      <div className="relative aspect-video w-full">
        <div
          ref={containerRef}
          className="absolute inset-0 [&>iframe]:h-full [&>iframe]:w-full"
        />
      </div>
    </div>
  )
}
