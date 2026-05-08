import { useEffect, useRef, useState } from "react"
import { useAction, useMutation, useQuery } from "convex/react"
import { api, type Id } from "@/lib/api"
import { Button } from "@/components/ui/button"
import {
  SpeakerHigh,
  Microphone,
  MicrophoneSlash,
  Phone,
  PhoneSlash,
  Headphones,
  SpeakerSlash,
  VideoCamera,
  VideoCameraSlash,
} from "@phosphor-icons/react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { initialsFromName } from "@/lib/format"
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useLocalParticipant,
  useParticipants,
  useTracks,
} from "@livekit/components-react"
import { Track, type Participant } from "livekit-client"
import "@livekit/components-styles"
import { toast } from "sonner"

export function VoiceView({
  channelId,
  channelName,
}: {
  channelId: Id<"channels">
  channelName: string
}) {
  const issue = useAction(api.livekit.issueToken)
  const join = useMutation(api.voice.join)
  const leave = useMutation(api.voice.leave)
  const participants = useQuery(api.voice.listParticipants, { channelId })

  const [token, setToken] = useState<string | null>(null)
  const [serverUrl, setServerUrl] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleJoin() {
    if (connecting) return
    setConnecting(true)
    setError(null)
    try {
      const { token, url } = await issue({ channelId })
      await join({ channelId })
      setToken(token)
      setServerUrl(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join")
      setConnecting(false)
    }
  }

  async function handleLeave() {
    setToken(null)
    setServerUrl(null)
    setConnecting(false)
    try {
      await leave({ channelId })
    } catch {}
  }

  useEffect(() => {
    return () => {
      leave({ channelId }).catch(() => {})
    }
  }, [channelId, leave])

  if (token && serverUrl) {
    return (
      <LiveKitRoom
        token={token}
        serverUrl={serverUrl}
        connect
        audio
        video={false}
        onDisconnected={handleLeave}
        className="flex h-svh flex-1 flex-col bg-background"
      >
        <ConnectedRoom channelName={channelName} onLeave={handleLeave} />
        <RoomAudioRenderer />
      </LiveKitRoom>
    )
  }

  return (
    <div className="flex h-svh flex-1 flex-col bg-background">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border/40 px-4">
        <SpeakerHigh className="size-5 text-muted-foreground" />
        <span className="font-medium">{channelName}</span>
      </header>

      <div className="grid flex-1 place-items-center p-6">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-5 grid size-20 place-items-center rounded-full bg-primary/10 text-primary">
            <SpeakerHigh weight="duotone" className="size-9" />
          </div>
          <h2 className="text-xl font-medium">{channelName}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {participants && participants.length > 0
              ? `${participants.length} ${participants.length === 1 ? "person is" : "people are"} in here`
              : "No one is here yet — be the first."}
          </p>

          {participants && participants.length > 0 ? (
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              {participants.map((p) => (
                <div
                  key={p.userId}
                  className="flex items-center gap-2 rounded-full border border-border/60 bg-card/50 px-3 py-1.5 text-sm"
                >
                  <Avatar className="size-5">
                    {p.imageUrl ? <AvatarImage src={p.imageUrl} /> : null}
                    <AvatarFallback className="text-[9px]">
                      {initialsFromName(p.name)}
                    </AvatarFallback>
                  </Avatar>
                  {p.name}
                </div>
              ))}
            </div>
          ) : null}

          {error ? (
            <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
              {error}
            </div>
          ) : null}

          <Button
            size="lg"
            onClick={handleJoin}
            disabled={connecting}
            className="mt-6 min-w-[160px]"
          >
            <Phone className="size-4" />
            {connecting ? "Connecting…" : "Join Voice"}
          </Button>
        </div>
      </div>
    </div>
  )
}

function ConnectedRoom({
  channelName,
  onLeave,
}: {
  channelName: string
  onLeave: () => void
}) {
  const participants = useParticipants()
  const { localParticipant } = useLocalParticipant()
  const tracks = useTracks([Track.Source.Camera, Track.Source.ScreenShare], {
    onlySubscribed: false,
  })
  const [micOn, setMicOn] = useState(true)
  const [camOn, setCamOn] = useState(false)
  const [deafened, setDeafened] = useState(false)
  const audioContainerRef = useRef<HTMLDivElement>(null)

  async function toggleMic() {
    const next = !micOn
    setMicOn(next)
    try {
      await localParticipant.setMicrophoneEnabled(next)
    } catch (err) {
      toast.error("Couldn't toggle microphone")
      setMicOn(!next)
    }
  }

  async function toggleCam() {
    const next = !camOn
    setCamOn(next)
    try {
      await localParticipant.setCameraEnabled(next)
    } catch {
      toast.error("Couldn't toggle camera")
      setCamOn(!next)
    }
  }

  function toggleDeafen() {
    setDeafened((d) => !d)
  }

  useEffect(() => {
    const el = audioContainerRef.current
    if (!el) return
    const apply = () => {
      el.querySelectorAll("audio").forEach((a) => (a.muted = deafened))
    }
    apply()
    const observer = new MutationObserver(apply)
    observer.observe(el, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [deafened, participants.length])

  const videoTracks = tracks.filter((t) => t.publication?.track)

  return (
    <>
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border/40 px-4">
        <SpeakerHigh className="size-5 text-emerald-500" />
        <span className="font-medium">{channelName}</span>
        <span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Connected · {participants.length}
        </span>
      </header>

      <div ref={audioContainerRef} className="flex-1 overflow-y-auto p-6">
        {videoTracks.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {videoTracks.map((t) => (
              <VideoTile key={t.publication?.trackSid ?? t.participant.sid} trackRef={t} />
            ))}
          </div>
        ) : (
          <div
            className="grid gap-3"
            style={{
              gridTemplateColumns: `repeat(${Math.min(participants.length || 1, 4)}, minmax(0, 1fr))`,
            }}
          >
            {participants.map((p) => (
              <ParticipantTile key={p.sid} participant={p} />
            ))}
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-border/40 bg-sidebar/40 px-4 py-3">
        <div className="mx-auto flex max-w-2xl items-center justify-center gap-2">
          <ControlButton
            active={micOn}
            onClick={toggleMic}
            label={micOn ? "Mute" : "Unmute"}
            icon={micOn ? <Microphone className="size-5" /> : <MicrophoneSlash className="size-5" />}
            danger={!micOn}
          />
          <ControlButton
            active={camOn}
            onClick={toggleCam}
            label={camOn ? "Stop video" : "Start video"}
            icon={
              camOn ? (
                <VideoCamera className="size-5" />
              ) : (
                <VideoCameraSlash className="size-5" />
              )
            }
            danger={!camOn}
          />
          <ControlButton
            active={!deafened}
            onClick={toggleDeafen}
            label={deafened ? "Undeafen" : "Deafen"}
            icon={
              deafened ? (
                <SpeakerSlash className="size-5" />
              ) : (
                <Headphones className="size-5" />
              )
            }
            danger={deafened}
          />
          <Button onClick={onLeave} variant="destructive" size="lg" className="ml-2">
            <PhoneSlash className="size-5" />
            Leave
          </Button>
        </div>
      </div>
    </>
  )
}

function ParticipantTile({ participant }: { participant: Participant }) {
  const isSpeaking = participant.isSpeaking
  const muted = participant.isMicrophoneEnabled === false
  const name = participant.name || participant.identity
  return (
    <div
      className={`relative aspect-video rounded-xl border bg-card/40 p-6 transition ${
        isSpeaking
          ? "border-emerald-500 shadow-[0_0_0_3px_oklch(0.7_0.15_160_/_0.25)]"
          : "border-border/60"
      }`}
    >
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <Avatar
          className={`size-20 transition ${isSpeaking ? "ring-2 ring-emerald-500" : ""}`}
        >
          <AvatarFallback className="text-2xl">
            {initialsFromName(name)}
          </AvatarFallback>
        </Avatar>
        <div className="flex items-center gap-1.5 text-sm">
          {muted ? (
            <MicrophoneSlash className="size-3.5 text-rose-500" />
          ) : null}
          <span className="font-medium">{name}</span>
        </div>
      </div>
    </div>
  )
}

function VideoTile({
  trackRef,
}: {
  trackRef: ReturnType<typeof useTracks>[number]
}) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    const el = trackRef.publication?.track
    const video = ref.current
    if (!el || !video) return
    el.attach(video)
    return () => {
      el.detach(video)
    }
  }, [trackRef])
  const name = trackRef.participant.name || trackRef.participant.identity
  return (
    <div className="relative aspect-video overflow-hidden rounded-xl border border-border/60 bg-black">
      <video ref={ref} className="h-full w-full object-cover" autoPlay muted={trackRef.participant.isLocal} playsInline />
      <div className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-0.5 text-xs text-white backdrop-blur">
        {name}
      </div>
    </div>
  )
}

function ControlButton({
  onClick,
  icon,
  label,
  danger,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  danger?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`grid size-12 place-items-center rounded-full border transition ${
        danger
          ? "border-rose-500/40 bg-rose-500/10 text-rose-500 hover:bg-rose-500/20"
          : "border-border/60 bg-card hover:bg-accent"
      }`}
    >
      {icon}
    </button>
  )
}
