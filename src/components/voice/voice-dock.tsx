import { Link, useParams } from "@tanstack/react-router"
import {
  useLocalParticipant,
  useParticipants,
  useConnectionQualityIndicator,
} from "@livekit/components-react"
import { ConnectionQuality } from "livekit-client"
import {
  Microphone,
  MicrophoneSlash,
  Headphones,
  SpeakerSlash,
  PhoneSlash,
  Hand,
  ArrowsOut,
  WifiHigh,
  WifiMedium,
  WifiLow,
  WifiX,
} from "@phosphor-icons/react"
import { useVoice } from "./voice-provider"
import { cn } from "@/lib/utils"

export function VoiceDock() {
  const voice = useVoice()
  if (!voice.active) return null
  return <VoiceDockInner />
}

function VoiceDockInner() {
  const voice = useVoice()
  const params = useParams({ strict: false }) as { channelId?: string }
  const active = voice.active!
  const isViewing = params.channelId === active.channelId

  if (isViewing) return null

  return (
    <div className="border-t border-border/40 bg-emerald-500/5 px-2 py-1.5">
      <div className="rounded-md border border-emerald-500/30 bg-card/60 p-2 backdrop-blur">
        <div className="flex items-center gap-2">
          <DockHeader serverId={active.serverId} channelId={active.channelId} channelName={active.channelName} />
        </div>
        <SpeakingRow />
        <div className="mt-2 flex items-center justify-between gap-1">
          <DockControls />
          <Link
            to="/app/$serverId/$channelId"
            params={{
              serverId: active.serverId,
              channelId: active.channelId,
            }}
            aria-label="Return to call"
            title="Return to call"
            className="grid size-7 place-items-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-foreground"
          >
            <ArrowsOut className="size-4" />
          </Link>
        </div>
      </div>
    </div>
  )
}

function DockHeader({
  channelName,
}: {
  serverId: string
  channelId: string
  channelName: string
}) {
  const { localParticipant } = useLocalParticipant()
  const { quality } = useConnectionQualityIndicator({
    participant: localParticipant,
  })
  const Icon =
    quality === ConnectionQuality.Excellent
      ? WifiHigh
      : quality === ConnectionQuality.Good
        ? WifiMedium
        : quality === ConnectionQuality.Poor
          ? WifiLow
          : WifiX
  const tone =
    quality === ConnectionQuality.Excellent
      ? "text-emerald-500"
      : quality === ConnectionQuality.Good
        ? "text-amber-400"
        : quality === ConnectionQuality.Poor
          ? "text-rose-500"
          : "text-muted-foreground"
  return (
    <>
      <span className="grid size-2 shrink-0 rounded-full bg-emerald-500 ring-2 ring-emerald-500/30" />
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
          Voice connected
        </div>
        <div className="truncate text-sm font-medium leading-tight">
          {channelName}
        </div>
      </div>
      <Icon className={cn("size-4 shrink-0", tone)} />
    </>
  )
}

function SpeakingRow() {
  const participants = useParticipants()
  const speaking = participants.filter((p) => p.isSpeaking)
  const voice = useVoice()
  const handCount = voice.raisedHands.length

  if (speaking.length === 0 && handCount === 0) return null

  return (
    <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
      {speaking.length > 0 ? (
        <>
          <SpeakingDots />
          <span className="truncate">
            {speaking
              .slice(0, 2)
              .map((p) => p.name || p.identity)
              .join(", ")}
            {speaking.length > 2 ? ` +${speaking.length - 2}` : ""}
          </span>
        </>
      ) : null}
      {handCount > 0 ? (
        <span className="ml-auto flex items-center gap-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-amber-600 dark:text-amber-300">
          <Hand className="size-3" weight="fill" />
          {handCount}
        </span>
      ) : null}
    </div>
  )
}

function SpeakingDots() {
  return (
    <span className="flex items-end gap-[2px]">
      <span className="block w-[3px] animate-[speakDot_1s_ease-in-out_infinite] rounded-full bg-emerald-500" style={{ height: 6, animationDelay: "0ms" }} />
      <span className="block w-[3px] animate-[speakDot_1s_ease-in-out_infinite] rounded-full bg-emerald-500" style={{ height: 9, animationDelay: "150ms" }} />
      <span className="block w-[3px] animate-[speakDot_1s_ease-in-out_infinite] rounded-full bg-emerald-500" style={{ height: 6, animationDelay: "300ms" }} />
    </span>
  )
}

function DockControls() {
  const voice = useVoice()
  const micActive = voice.settings.ptt ? voice.pttHeld : voice.micOn
  return (
    <div className="flex items-center gap-1">
      {!voice.settings.ptt ? (
        <DockButton
          onClick={voice.toggleMic}
          aria-label={voice.micOn ? "Mute" : "Unmute"}
          danger={!voice.micOn}
        >
          {voice.micOn ? (
            <Microphone className="size-4" />
          ) : (
            <MicrophoneSlash className="size-4" />
          )}
        </DockButton>
      ) : (
        <DockButton
          onClick={() => voice.setSettingsOpen(true)}
          aria-label="Push-to-talk"
          danger={!micActive}
          highlight={micActive}
        >
          {micActive ? (
            <Microphone className="size-4" weight="fill" />
          ) : (
            <MicrophoneSlash className="size-4" />
          )}
        </DockButton>
      )}
      <DockButton
        onClick={voice.toggleDeafen}
        aria-label={voice.deafened ? "Undeafen" : "Deafen"}
        danger={voice.deafened}
      >
        {voice.deafened ? (
          <SpeakerSlash className="size-4" />
        ) : (
          <Headphones className="size-4" />
        )}
      </DockButton>
      <DockButton
        onClick={voice.toggleHand}
        aria-label={voice.myHandRaised ? "Lower hand" : "Raise hand"}
        highlight={voice.myHandRaised}
      >
        <Hand
          className="size-4"
          weight={voice.myHandRaised ? "fill" : "regular"}
        />
      </DockButton>
      <DockButton
        onClick={() => void voice.leaveVoice()}
        aria-label="Disconnect"
        danger
      >
        <PhoneSlash className="size-4" />
      </DockButton>
    </div>
  )
}

function DockButton({
  onClick,
  children,
  danger,
  highlight,
  ...rest
}: {
  onClick: () => void
  children: React.ReactNode
  danger?: boolean
  highlight?: boolean
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "children">) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "grid size-7 place-items-center rounded-md transition",
        danger
          ? "text-rose-500 hover:bg-rose-500/10"
          : highlight
            ? "text-amber-500 hover:bg-amber-500/10"
            : "text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
      {...rest}
    >
      {children}
    </button>
  )
}
