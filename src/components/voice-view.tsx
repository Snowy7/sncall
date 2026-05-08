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
  Monitor,
  MonitorPlay,
  CaretUp,
} from "@phosphor-icons/react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu"
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
import { MobileSidebarTrigger, MobileMembersTrigger } from "./mobile-nav"

export function VoiceView({
  channelId,
  channelName,
  serverId,
}: {
  channelId: Id<"channels">
  channelName: string
  serverId: Id<"servers">
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
        className="flex h-svh min-w-0 flex-1 flex-col bg-background"
      >
        <ConnectedRoom
          channelName={channelName}
          serverId={serverId}
          onLeave={handleLeave}
        />
        <RoomAudioRenderer />
      </LiveKitRoom>
    )
  }

  return (
    <div className="flex h-svh min-w-0 flex-1 flex-col bg-background">
      <header className="flex h-12 shrink-0 items-center gap-1.5 border-b border-border/40 px-2 md:px-4">
        <MobileSidebarTrigger serverId={serverId} />
        <SpeakerHigh className="size-5 shrink-0 text-muted-foreground" />
        <span className="truncate font-medium">{channelName}</span>
        <div className="ml-auto flex items-center gap-1">
          <MobileMembersTrigger serverId={serverId} />
        </div>
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

type ResolutionKey = "720p" | "1080p" | "1440p" | "4k"
type FrameRateKey = "15" | "30" | "60"

const RESOLUTIONS: Record<ResolutionKey, { width: number; height: number; label: string }> = {
  "720p": { width: 1280, height: 720, label: "720p" },
  "1080p": { width: 1920, height: 1080, label: "1080p" },
  "1440p": { width: 2560, height: 1440, label: "1440p" },
  "4k": { width: 3840, height: 2160, label: "4K" },
}

const FRAME_RATES: Record<FrameRateKey, number> = {
  "15": 15,
  "30": 30,
  "60": 60,
}

type ShareSettings = {
  resolution: ResolutionKey
  frameRate: FrameRateKey
  audio: boolean
}

const DEFAULT_SHARE_SETTINGS: ShareSettings = {
  resolution: "1080p",
  frameRate: "30",
  audio: true,
}

const SHARE_SETTINGS_KEY = "sncall:screen-share-settings"

function loadShareSettings(): ShareSettings {
  if (typeof window === "undefined") return DEFAULT_SHARE_SETTINGS
  try {
    const raw = localStorage.getItem(SHARE_SETTINGS_KEY)
    if (!raw) return DEFAULT_SHARE_SETTINGS
    const parsed = JSON.parse(raw)
    return {
      resolution:
        parsed?.resolution && parsed.resolution in RESOLUTIONS
          ? parsed.resolution
          : DEFAULT_SHARE_SETTINGS.resolution,
      frameRate:
        parsed?.frameRate && parsed.frameRate in FRAME_RATES
          ? parsed.frameRate
          : DEFAULT_SHARE_SETTINGS.frameRate,
      audio: typeof parsed?.audio === "boolean" ? parsed.audio : DEFAULT_SHARE_SETTINGS.audio,
    }
  } catch {
    return DEFAULT_SHARE_SETTINGS
  }
}

function ConnectedRoom({
  channelName,
  serverId,
  onLeave,
}: {
  channelName: string
  serverId: Id<"servers">
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
  const [shareSettings, setShareSettings] = useState<ShareSettings>(loadShareSettings)
  const audioContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    try {
      localStorage.setItem(SHARE_SETTINGS_KEY, JSON.stringify(shareSettings))
    } catch {}
  }, [shareSettings])

  async function toggleMic() {
    const next = !micOn
    setMicOn(next)
    try {
      await localParticipant.setMicrophoneEnabled(next)
    } catch {
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

  async function toggleScreenShare(currentlySharing: boolean) {
    if (currentlySharing) {
      try {
        await localParticipant.setScreenShareEnabled(false)
      } catch {
        toast.error("Couldn't stop screen share")
      }
      return
    }
    try {
      const res = RESOLUTIONS[shareSettings.resolution]
      await localParticipant.setScreenShareEnabled(true, {
        resolution: {
          width: res.width,
          height: res.height,
          frameRate: FRAME_RATES[shareSettings.frameRate],
        },
        audio: shareSettings.audio,
        selfBrowserSurface: "exclude",
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : ""
      if (!msg.toLowerCase().includes("permission") && !msg.toLowerCase().includes("denied")) {
        toast.error(msg || "Couldn't start screen share")
      }
    }
  }

  async function applyShareSettings(next: ShareSettings, currentlySharing: boolean) {
    setShareSettings(next)
    if (!currentlySharing) return
    try {
      await localParticipant.setScreenShareEnabled(false)
      const res = RESOLUTIONS[next.resolution]
      await localParticipant.setScreenShareEnabled(true, {
        resolution: {
          width: res.width,
          height: res.height,
          frameRate: FRAME_RATES[next.frameRate],
        },
        audio: next.audio,
        selfBrowserSurface: "exclude",
      })
      toast.success("Screen share updated")
    } catch {
      // sharing was stopped by browser or user
    }
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

  const cameraTracks = tracks.filter(
    (t) => t.source === Track.Source.Camera && t.publication?.track,
  )
  const screenTracks = tracks.filter(
    (t) => t.source === Track.Source.ScreenShare && t.publication?.track,
  )
  const isSharing = screenTracks.some((t) => t.participant.isLocal)

  return (
    <>
      <header className="flex h-12 shrink-0 items-center gap-1.5 border-b border-border/40 px-2 md:px-4">
        <MobileSidebarTrigger serverId={serverId} />
        <SpeakerHigh className="size-5 shrink-0 text-emerald-500" />
        <span className="truncate font-medium">{channelName}</span>
        <span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="hidden sm:inline">Connected · </span>
          {participants.length}
        </span>
        <MobileMembersTrigger serverId={serverId} />
      </header>

      <div
        ref={audioContainerRef}
        className="flex flex-1 flex-col gap-3 overflow-y-auto p-3 sm:p-6"
      >
        {screenTracks.length > 0 ? (
          <>
            <div
              className={`grid flex-1 min-h-0 gap-3 ${
                screenTracks.length === 1
                  ? "grid-cols-1"
                  : "grid-cols-1 md:grid-cols-2"
              }`}
            >
              {screenTracks.map((t) => (
                <ScreenShareTile
                  key={t.publication?.trackSid ?? t.participant.sid}
                  trackRef={t}
                />
              ))}
            </div>
            <div className="grid shrink-0 grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8">
              {participants.map((p) => {
                const cam = cameraTracks.find((c) => c.participant.sid === p.sid)
                return cam ? (
                  <CameraStripTile key={p.sid} trackRef={cam} />
                ) : (
                  <ParticipantStripTile key={p.sid} participant={p} />
                )
              })}
            </div>
          </>
        ) : cameraTracks.length > 0 ? (
          <div className="grid flex-1 grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {cameraTracks.map((t) => (
              <VideoTile key={t.publication?.trackSid ?? t.participant.sid} trackRef={t} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 md:grid-cols-4">
            {participants.map((p) => (
              <ParticipantTile key={p.sid} participant={p} />
            ))}
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-border/40 bg-sidebar/40 px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-4">
        <div className="mx-auto flex max-w-2xl items-center justify-center gap-1.5 sm:gap-2">
          <ControlButton
            onClick={toggleMic}
            label={micOn ? "Mute" : "Unmute"}
            icon={micOn ? <Microphone className="size-5" /> : <MicrophoneSlash className="size-5" />}
            danger={!micOn}
          />
          <ControlButton
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
          <ScreenShareControl
            isSharing={isSharing}
            settings={shareSettings}
            onToggle={() => toggleScreenShare(isSharing)}
            onChangeSettings={(next) => applyShareSettings(next, isSharing)}
          />
          <ControlButton
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
          <Button
            onClick={onLeave}
            variant="destructive"
            size="lg"
            className="ml-1 h-12 rounded-full px-4 sm:ml-2 sm:px-6"
          >
            <PhoneSlash className="size-5" />
            <span className="hidden sm:inline">Leave</span>
          </Button>
        </div>
      </div>
    </>
  )
}

function ScreenShareControl({
  isSharing,
  settings,
  onToggle,
  onChangeSettings,
}: {
  isSharing: boolean
  settings: ShareSettings
  onToggle: () => void
  onChangeSettings: (next: ShareSettings) => void
}) {
  return (
    <div className="relative inline-flex items-stretch">
      <button
        type="button"
        onClick={onToggle}
        aria-label={isSharing ? "Stop screen share" : "Share screen"}
        className={`grid size-12 place-items-center rounded-l-full rounded-r-none border border-r-0 transition ${
          isSharing
            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20"
            : "border-border/60 bg-card hover:bg-accent"
        }`}
      >
        {isSharing ? (
          <MonitorPlay className="size-5" weight="fill" />
        ) : (
          <Monitor className="size-5" />
        )}
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Screen share settings"
            className={`grid h-12 w-7 place-items-center rounded-r-full rounded-l-none border transition ${
              isSharing
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20"
                : "border-border/60 bg-card hover:bg-accent"
            }`}
          >
            <CaretUp className="size-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" side="top" className="w-60">
          <DropdownMenuLabel>Resolution</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={settings.resolution}
            onValueChange={(v) =>
              onChangeSettings({ ...settings, resolution: v as ResolutionKey })
            }
          >
            {(Object.keys(RESOLUTIONS) as ResolutionKey[]).map((key) => (
              <DropdownMenuRadioItem key={key} value={key}>
                {RESOLUTIONS[key].label}
                <span className="ml-auto text-[11px] text-muted-foreground">
                  {RESOLUTIONS[key].width}×{RESOLUTIONS[key].height}
                </span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Frame rate</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={settings.frameRate}
            onValueChange={(v) =>
              onChangeSettings({ ...settings, frameRate: v as FrameRateKey })
            }
          >
            {(Object.keys(FRAME_RATES) as FrameRateKey[]).map((key) => (
              <DropdownMenuRadioItem key={key} value={key}>
                {FRAME_RATES[key]} fps
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuCheckboxItem
            checked={settings.audio}
            onCheckedChange={(checked) =>
              onChangeSettings({ ...settings, audio: !!checked })
            }
          >
            Capture system audio
          </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

function parseParticipantMetadata(metadata: string | undefined): {
  imageUrl?: string
} {
  if (!metadata) return {}
  try {
    const m = JSON.parse(metadata)
    return { imageUrl: typeof m?.imageUrl === "string" ? m.imageUrl : undefined }
  } catch {
    return {}
  }
}

function ParticipantTile({ participant }: { participant: Participant }) {
  const isSpeaking = participant.isSpeaking
  const muted = participant.isMicrophoneEnabled === false
  const name = participant.name || participant.identity
  const { imageUrl } = parseParticipantMetadata(participant.metadata)
  return (
    <div
      className={`relative aspect-square rounded-xl border bg-card/40 p-4 transition sm:aspect-video sm:p-6 ${
        isSpeaking
          ? "border-emerald-500 shadow-[0_0_0_3px_oklch(0.7_0.15_160_/_0.25)]"
          : "border-border/60"
      }`}
    >
      <div className="flex h-full flex-col items-center justify-center gap-2 sm:gap-3">
        <Avatar
          className={`size-14 transition sm:size-20 ${
            isSpeaking ? "ring-2 ring-emerald-500 ring-offset-2 ring-offset-background" : ""
          }`}
        >
          {imageUrl ? <AvatarImage src={imageUrl} alt={name} /> : null}
          <AvatarFallback className="text-base sm:text-2xl">
            {initialsFromName(name)}
          </AvatarFallback>
        </Avatar>
        <div className="flex items-center gap-1.5 text-xs sm:text-sm">
          {muted ? (
            <MicrophoneSlash className="size-3.5 text-rose-500" weight="fill" />
          ) : null}
          <span className="truncate font-medium">{name}</span>
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
      <video
        ref={ref}
        className="h-full w-full object-cover"
        autoPlay
        muted={trackRef.participant.isLocal}
        playsInline
      />
      <div className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-0.5 text-xs text-white backdrop-blur">
        {name}
      </div>
    </div>
  )
}

function ScreenShareTile({
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
    <div className="relative h-full min-h-0 w-full overflow-hidden rounded-xl border border-border/60 bg-black">
      <video
        ref={ref}
        className="h-full w-full object-contain"
        autoPlay
        muted={trackRef.participant.isLocal}
        playsInline
      />
      <div className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded bg-black/70 px-2 py-1 text-xs text-white backdrop-blur">
        <MonitorPlay className="size-3.5 text-emerald-400" weight="fill" />
        <span>{name}'s screen</span>
      </div>
    </div>
  )
}

function CameraStripTile({
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
  const isSpeaking = trackRef.participant.isSpeaking
  return (
    <div
      className={`relative aspect-video overflow-hidden rounded-lg border bg-black transition ${
        isSpeaking ? "border-emerald-500" : "border-border/60"
      }`}
    >
      <video
        ref={ref}
        className="h-full w-full object-cover"
        autoPlay
        muted={trackRef.participant.isLocal}
        playsInline
      />
      <div className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white backdrop-blur">
        {name}
      </div>
    </div>
  )
}

function ParticipantStripTile({ participant }: { participant: Participant }) {
  const isSpeaking = participant.isSpeaking
  const muted = participant.isMicrophoneEnabled === false
  const name = participant.name || participant.identity
  const { imageUrl } = parseParticipantMetadata(participant.metadata)
  return (
    <div
      className={`relative flex aspect-video items-center justify-center rounded-lg border bg-card/40 transition ${
        isSpeaking
          ? "border-emerald-500 shadow-[0_0_0_2px_oklch(0.7_0.15_160_/_0.25)]"
          : "border-border/60"
      }`}
    >
      <Avatar
        className={`size-10 transition ${
          isSpeaking ? "ring-2 ring-emerald-500" : ""
        }`}
      >
        {imageUrl ? <AvatarImage src={imageUrl} alt={name} /> : null}
        <AvatarFallback className="text-xs">
          {initialsFromName(name)}
        </AvatarFallback>
      </Avatar>
      <div className="absolute bottom-1 left-1 flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white backdrop-blur">
        {muted ? <MicrophoneSlash className="size-3 text-rose-400" weight="fill" /> : null}
        <span className="truncate">{name}</span>
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
