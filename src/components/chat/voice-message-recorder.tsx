import { useEffect, useRef, useState } from "react"
import { Microphone, Stop, Trash, PaperPlaneRight } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const MAX_DURATION_MS = 120_000

export function VoiceMessageRecorder({
  onSend,
  onCancel,
}: {
  onSend: (file: File, durationMs: number) => Promise<void> | void
  onCancel: () => void
}) {
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [reviewing, setReviewing] = useState<{
    blob: Blob
    duration: number
    url: string
  } | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startedAtRef = useRef(0)
  const tickRef = useRef<number | null>(null)
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    void start()
    return () => {
      cleanup()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mr = new MediaRecorder(stream, { mimeType: pickMimeType() })
      recorderRef.current = mr
      chunksRef.current = []
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: mr.mimeType || "audio/webm",
        })
        const duration = Date.now() - startedAtRef.current
        const url = URL.createObjectURL(blob)
        setReviewing({ blob, duration, url })
      }
      mr.start(250)
      startedAtRef.current = Date.now()
      setRecording(true)
      tickRef.current = window.setInterval(() => {
        const e = Date.now() - startedAtRef.current
        setElapsed(e)
        if (e >= MAX_DURATION_MS) stop()
      }, 100)
    } catch {
      toast.error("Microphone access denied")
      onCancel()
    }
  }

  function stop() {
    setRecording(false)
    if (tickRef.current) {
      window.clearInterval(tickRef.current)
      tickRef.current = null
    }
    const mr = recorderRef.current
    if (mr && mr.state !== "inactive") mr.stop()
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }

  function cleanup() {
    if (tickRef.current) {
      window.clearInterval(tickRef.current)
      tickRef.current = null
    }
    const mr = recorderRef.current
    if (mr && mr.state !== "inactive") {
      try {
        mr.stop()
      } catch {}
    }
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (reviewing) URL.revokeObjectURL(reviewing.url)
  }

  async function send() {
    if (!reviewing) return
    const ext =
      reviewing.blob.type.includes("ogg")
        ? "ogg"
        : reviewing.blob.type.includes("mp4")
          ? "m4a"
          : "webm"
    const file = new File(
      [reviewing.blob],
      `voice-${Date.now()}.${ext}`,
      { type: reviewing.blob.type || "audio/webm" },
    )
    await onSend(file, reviewing.duration)
    URL.revokeObjectURL(reviewing.url)
    setReviewing(null)
  }

  function discard() {
    if (reviewing) URL.revokeObjectURL(reviewing.url)
    setReviewing(null)
    onCancel()
  }

  return (
    <div className="mb-1 flex items-center gap-2 rounded-md border border-border/60 bg-muted/30 px-2 py-1.5">
      {recording ? (
        <>
          <span className="flex size-6 items-center justify-center">
            <span className="size-2 animate-pulse rounded-full bg-rose-500" />
          </span>
          <span className="text-xs tabular-nums text-muted-foreground">
            Recording · {formatTime(elapsed)} / {formatTime(MAX_DURATION_MS)}
          </span>
          <Bars elapsed={elapsed} />
          <button
            type="button"
            onClick={stop}
            aria-label="Stop"
            className="ml-auto grid size-7 place-items-center rounded-full bg-rose-500 text-white transition hover:bg-rose-400"
          >
            <Stop className="size-3.5" weight="fill" />
          </button>
        </>
      ) : reviewing ? (
        <>
          <Microphone className="size-4 text-muted-foreground" />
          <audio ref={audioRef} src={reviewing.url} />
          <button
            type="button"
            onClick={() => {
              const a = audioRef.current
              if (!a) return
              if (a.paused) void a.play()
              else a.pause()
            }}
            className="text-xs text-primary hover:underline"
          >
            Play preview
          </button>
          <span className="text-xs tabular-nums text-muted-foreground">
            {formatTime(reviewing.duration)}
          </span>
          <button
            type="button"
            onClick={discard}
            aria-label="Discard"
            className={cn(
              "ml-auto grid size-7 place-items-center rounded text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <Trash className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={send}
            aria-label="Send"
            className="grid size-7 place-items-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <PaperPlaneRight className="size-3.5" weight="fill" />
          </button>
        </>
      ) : (
        <span className="text-xs text-muted-foreground">Preparing mic…</span>
      )}
    </div>
  )
}

function Bars({ elapsed }: { elapsed: number }) {
  const bars = 16
  const t = elapsed / 250
  return (
    <div className="flex h-5 items-end gap-[2px]">
      {Array.from({ length: bars }, (_, i) => {
        const phase = (Math.sin(t + i * 0.7) + 1) / 2
        const height = 4 + phase * 16
        return (
          <span
            key={i}
            className="block w-[2px] rounded-sm bg-rose-500/80"
            style={{ height: `${height}px` }}
          />
        )
      })}
    </div>
  )
}

function pickMimeType() {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
    "audio/ogg",
  ]
  for (const m of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(m)) return m
    } catch {}
  }
  return ""
}

function formatTime(ms: number) {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${r.toString().padStart(2, "0")}`
}
