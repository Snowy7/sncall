import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { useAction, useMutation } from "convex/react"
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useLocalParticipant,
  useParticipants,
  useRoomContext,
} from "@livekit/components-react"
import {
  RoomEvent,
  Track,
  type RemoteAudioTrack,
  type RemoteParticipant,
} from "livekit-client"
import { toast } from "sonner"
import { api, type Id } from "@/lib/api"
import { playSfx, type SfxId } from "./voice-sfx"
import { applyBlur, removeBlur } from "./voice-blur"

type ActiveCall = {
  channelId: Id<"channels">
  channelName: string
  serverId: Id<"servers">
  token: string
  serverUrl: string
}

export type VoiceSettings = {
  ptt: boolean
  pttKey: string
  micDeviceId?: string
  speakerDeviceId?: string
  noiseSuppression: boolean
  echoCancellation: boolean
  blur: boolean
}

const DEFAULT_SETTINGS: VoiceSettings = {
  ptt: false,
  pttKey: "`",
  noiseSuppression: true,
  echoCancellation: true,
  blur: false,
}

const SETTINGS_KEY = "sncall:voice-settings"
const VOLUME_KEY = "sncall:participant-volumes"
const PERSIST_TOGGLES_KEY = "sncall:voice-toggles"

type FloatingReaction = {
  id: string
  emoji: string
  identity: string
  at: number
}

type DataMsg =
  | { type: "reaction"; emoji: string }
  | { type: "hand"; raised: boolean }
  | { type: "sfx"; sfxId: string }
  | { type: "caption"; text: string; final: boolean }
  | {
      type: "watch"
      action: "start"
      videoId: string
      currentTime: number
      playing: boolean
    }
  | {
      type: "watch"
      action: "state"
      currentTime: number
      playing: boolean
    }
  | { type: "watch"; action: "stop" }
  | {
      type: "spatial"
      x: number
      y: number
    }

type Caption = {
  identity: string
  name: string
  text: string
  final: boolean
  at: number
}

export type WatchState = {
  videoId: string
  hostIdentity: string
  playing: boolean
  currentTime: number
  lastUpdateAt: number
} | null

export type SpatialPosition = { identity: string; x: number; y: number; at: number }

interface SpeechRecognitionResultLike {
  isFinal: boolean
  0: { transcript: string }
}
interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>
}
interface SpeechRecognitionLike {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
}

type VoiceCtx = {
  active: ActiveCall | null
  isConnecting: boolean
  joinVoice(args: {
    channelId: Id<"channels">
    channelName: string
    serverId: Id<"servers">
  }): Promise<void>
  leaveVoice(): Promise<void>

  micOn: boolean
  setMicOn(v: boolean): void
  toggleMic(): void
  camOn: boolean
  setCamOn(v: boolean): void
  toggleCam(): void
  deafened: boolean
  setDeafened(v: boolean): void
  toggleDeafen(): void
  isSharing: boolean

  settings: VoiceSettings
  updateSettings(p: Partial<VoiceSettings>): void

  participantVolume: Record<string, number>
  setParticipantVolume(identity: string, v: number): void

  pinnedSid: string | null
  setPinnedSid(sid: string | null): void

  myHandRaised: boolean
  raisedHands: { identity: string; at: number }[]
  toggleHand(): void

  emitReaction(emoji: string): void
  floatingReactions: FloatingReaction[]

  emitSfx(sfxId: string): void
  playLocalSfx(sfxId: string): void

  captionsOn: boolean
  setCaptionsOn(v: boolean): void
  captions: Caption[]

  watch: WatchState
  startWatch(url: string): void
  stopWatch(): void
  reportWatchState(playing: boolean, currentTime: number): void

  spatialOn: boolean
  setSpatialOn(v: boolean): void
  spatialPositions: Record<string, SpatialPosition>
  setMyPosition(x: number, y: number): void

  settingsOpen: boolean
  setSettingsOpen(v: boolean): void

  pttHeld: boolean
}

const VoiceContext = createContext<VoiceCtx | null>(null)

export function useVoice() {
  const v = useContext(VoiceContext)
  if (!v) throw new Error("useVoice must be inside <VoiceProvider>")
  return v
}

function loadJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return { ...fallback, ...JSON.parse(raw) } as T
  } catch {
    return fallback
  }
}

function loadRecord(key: string): Record<string, number> {
  if (typeof window === "undefined") return {}
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return typeof parsed === "object" && parsed ? parsed : {}
  } catch {
    return {}
  }
}

export function VoiceProvider({ children }: { children: React.ReactNode }) {
  const issue = useAction(api.livekit.issueToken)
  const join = useMutation(api.voice.join)
  const leave = useMutation(api.voice.leave)

  const [active, setActive] = useState<ActiveCall | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)

  const persisted = loadJSON(PERSIST_TOGGLES_KEY, {
    micOn: true,
    camOn: false,
    deafened: false,
  })
  const [micOn, setMicOnState] = useState(persisted.micOn)
  const [camOn, setCamOnState] = useState(persisted.camOn)
  const [deafened, setDeafenedState] = useState(persisted.deafened)
  const [isSharing, setIsSharing] = useState(false)

  const [settings, setSettings] = useState<VoiceSettings>(() =>
    loadJSON(SETTINGS_KEY, DEFAULT_SETTINGS),
  )
  const [participantVolume, setParticipantVolumeState] = useState<
    Record<string, number>
  >(() => loadRecord(VOLUME_KEY))

  const [pinnedSid, setPinnedSid] = useState<string | null>(null)
  const [myHandRaised, setMyHandRaised] = useState(false)
  const [raisedHands, setRaisedHands] = useState<
    { identity: string; at: number }[]
  >([])
  const [floatingReactions, setFloatingReactions] = useState<FloatingReaction[]>(
    [],
  )
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [pttHeld, setPttHeld] = useState(false)
  const [captionsOn, setCaptionsOn] = useState(false)
  const [captions, setCaptions] = useState<Caption[]>([])
  const [watch, setWatch] = useState<WatchState>(null)
  const [spatialOn, setSpatialOnState] = useState(false)
  const [spatialPositions, setSpatialPositions] = useState<
    Record<string, SpatialPosition>
  >({})

  const setMicOn = useCallback((v: boolean) => setMicOnState(v), [])
  const setCamOn = useCallback((v: boolean) => setCamOnState(v), [])
  const setDeafened = useCallback((v: boolean) => setDeafenedState(v), [])

  const toggleMic = useCallback(() => setMicOnState((m) => !m), [])
  const toggleCam = useCallback(() => setCamOnState((c) => !c), [])
  const toggleDeafen = useCallback(() => setDeafenedState((d) => !d), [])

  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
    } catch {}
  }, [settings])

  useEffect(() => {
    try {
      localStorage.setItem(VOLUME_KEY, JSON.stringify(participantVolume))
    } catch {}
  }, [participantVolume])

  useEffect(() => {
    try {
      localStorage.setItem(
        PERSIST_TOGGLES_KEY,
        JSON.stringify({ micOn, camOn, deafened }),
      )
    } catch {}
  }, [micOn, camOn, deafened])

  const updateSettings = useCallback((p: Partial<VoiceSettings>) => {
    setSettings((s) => ({ ...s, ...p }))
  }, [])

  const setParticipantVolume = useCallback((identity: string, v: number) => {
    setParticipantVolumeState((prev) => ({ ...prev, [identity]: v }))
  }, [])

  const emitReactionRef = useRef<(emoji: string) => void>(() => {})
  const toggleHandRef = useRef<() => void>(() => {})
  const emitSfxRef = useRef<(sfxId: string) => void>(() => {})
  const playLocalSfxRef = useRef<(sfxId: string) => void>(() => {})
  const startWatchRef = useRef<(url: string) => void>(() => {})
  const stopWatchRef = useRef<() => void>(() => {})
  const reportWatchStateRef = useRef<(playing: boolean, t: number) => void>(
    () => {},
  )
  const setMyPositionRef = useRef<(x: number, y: number) => void>(() => {})

  const emitReaction = useCallback((emoji: string) => {
    emitReactionRef.current(emoji)
  }, [])
  const toggleHand = useCallback(() => {
    toggleHandRef.current()
  }, [])
  const emitSfx = useCallback((id: string) => {
    emitSfxRef.current(id)
  }, [])
  const playLocalSfx = useCallback((id: string) => {
    playLocalSfxRef.current(id)
  }, [])
  const startWatch = useCallback((url: string) => {
    startWatchRef.current(url)
  }, [])
  const stopWatch = useCallback(() => {
    stopWatchRef.current()
  }, [])
  const reportWatchState = useCallback((playing: boolean, t: number) => {
    reportWatchStateRef.current(playing, t)
  }, [])
  const setMyPosition = useCallback((x: number, y: number) => {
    setMyPositionRef.current(x, y)
  }, [])
  const setSpatialOn = useCallback((v: boolean) => setSpatialOnState(v), [])

  const pushFloating = useCallback(
    (r: Omit<FloatingReaction, "id" | "at">) => {
      const item: FloatingReaction = {
        ...r,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        at: Date.now(),
      }
      setFloatingReactions((prev) => [...prev, item])
      setTimeout(() => {
        setFloatingReactions((prev) => prev.filter((x) => x.id !== item.id))
      }, 2400)
    },
    [],
  )

  const joinVoice = useCallback(
    async (args: {
      channelId: Id<"channels">
      channelName: string
      serverId: Id<"servers">
    }) => {
      if (isConnecting) return
      if (active && active.channelId === args.channelId) return
      setIsConnecting(true)
      try {
        if (active) {
          try {
            await leave({ channelId: active.channelId })
          } catch {}
          setActive(null)
        }
        const { token, url } = await issue({ channelId: args.channelId })
        await join({ channelId: args.channelId })
        setActive({
          channelId: args.channelId,
          channelName: args.channelName,
          serverId: args.serverId,
          token,
          serverUrl: url,
        })
        setPinnedSid(null)
        setMyHandRaised(false)
        setRaisedHands([])
        setCaptions([])
        setCaptionsOn(false)
        setWatch(null)
        setSpatialOnState(false)
        setSpatialPositions({})
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to join voice")
      } finally {
        setIsConnecting(false)
      }
    },
    [active, isConnecting, issue, join, leave],
  )

  const leaveVoice = useCallback(async () => {
    const cur = active
    setActive(null)
    setIsSharing(false)
    setPinnedSid(null)
    setMyHandRaised(false)
    setRaisedHands([])
    setCaptions([])
    setCaptionsOn(false)
    setWatch(null)
    setSpatialOnState(false)
    setSpatialPositions({})
    if (!cur) return
    try {
      await leave({ channelId: cur.channelId })
    } catch {}
  }, [active, leave])

  const ctxValue: VoiceCtx = useMemo(
    () => ({
      active,
      isConnecting,
      joinVoice,
      leaveVoice,
      micOn,
      setMicOn,
      toggleMic,
      camOn,
      setCamOn,
      toggleCam,
      deafened,
      setDeafened,
      toggleDeafen,
      isSharing,
      settings,
      updateSettings,
      participantVolume,
      setParticipantVolume,
      pinnedSid,
      setPinnedSid,
      myHandRaised,
      raisedHands,
      toggleHand,
      emitReaction,
      floatingReactions,
      emitSfx,
      playLocalSfx,
      captionsOn,
      setCaptionsOn,
      captions,
      watch,
      startWatch,
      stopWatch,
      reportWatchState,
      spatialOn,
      setSpatialOn,
      spatialPositions,
      setMyPosition,
      settingsOpen,
      setSettingsOpen,
      pttHeld,
    }),
    [
      active,
      isConnecting,
      joinVoice,
      leaveVoice,
      micOn,
      setMicOn,
      toggleMic,
      camOn,
      setCamOn,
      toggleCam,
      deafened,
      setDeafened,
      toggleDeafen,
      isSharing,
      settings,
      updateSettings,
      participantVolume,
      setParticipantVolume,
      pinnedSid,
      myHandRaised,
      raisedHands,
      toggleHand,
      emitReaction,
      floatingReactions,
      emitSfx,
      playLocalSfx,
      captionsOn,
      captions,
      watch,
      startWatch,
      stopWatch,
      reportWatchState,
      spatialOn,
      setSpatialOn,
      spatialPositions,
      setMyPosition,
      settingsOpen,
      pttHeld,
    ],
  )

  return (
    <VoiceContext.Provider value={ctxValue}>
      {active ? (
        <LiveKitRoom
          token={active.token}
          serverUrl={active.serverUrl}
          connect
          audio={{
            deviceId: settings.micDeviceId,
            noiseSuppression: settings.noiseSuppression,
            echoCancellation: settings.echoCancellation,
          }}
          video={false}
          onDisconnected={() => {
            void leaveVoice()
          }}
          className="contents"
        >
          {children}
          <RoomAudioRenderer />
          <VoiceController
            emitReactionRef={emitReactionRef}
            toggleHandRef={toggleHandRef}
            emitSfxRef={emitSfxRef}
            playLocalSfxRef={playLocalSfxRef}
            startWatchRef={startWatchRef}
            stopWatchRef={stopWatchRef}
            reportWatchStateRef={reportWatchStateRef}
            setMyPositionRef={setMyPositionRef}
            pushFloating={pushFloating}
            setMyHandRaised={setMyHandRaised}
            setRaisedHands={setRaisedHands}
            setIsSharing={setIsSharing}
            setPttHeld={setPttHeld}
            captionsOn={captionsOn}
            setCaptions={setCaptions}
            setWatch={setWatch}
            spatialOn={spatialOn}
            spatialPositions={spatialPositions}
            setSpatialPositions={setSpatialPositions}
          />
        </LiveKitRoom>
      ) : (
        children
      )}
    </VoiceContext.Provider>
  )
}

function VoiceController({
  emitReactionRef,
  toggleHandRef,
  emitSfxRef,
  playLocalSfxRef,
  startWatchRef,
  stopWatchRef,
  reportWatchStateRef,
  setMyPositionRef,
  pushFloating,
  setMyHandRaised,
  setRaisedHands,
  setIsSharing,
  setPttHeld,
  captionsOn,
  setCaptions,
  setWatch,
  spatialOn,
  spatialPositions,
  setSpatialPositions,
}: {
  emitReactionRef: React.MutableRefObject<(emoji: string) => void>
  toggleHandRef: React.MutableRefObject<() => void>
  emitSfxRef: React.MutableRefObject<(sfxId: string) => void>
  playLocalSfxRef: React.MutableRefObject<(sfxId: string) => void>
  startWatchRef: React.MutableRefObject<(url: string) => void>
  stopWatchRef: React.MutableRefObject<() => void>
  reportWatchStateRef: React.MutableRefObject<
    (playing: boolean, currentTime: number) => void
  >
  setMyPositionRef: React.MutableRefObject<(x: number, y: number) => void>
  pushFloating: (r: { emoji: string; identity: string }) => void
  setMyHandRaised: (v: boolean | ((p: boolean) => boolean)) => void
  setRaisedHands: React.Dispatch<
    React.SetStateAction<{ identity: string; at: number }[]>
  >
  setIsSharing: (v: boolean) => void
  setPttHeld: (v: boolean) => void
  captionsOn: boolean
  setCaptions: React.Dispatch<React.SetStateAction<Caption[]>>
  setWatch: React.Dispatch<React.SetStateAction<WatchState>>
  spatialOn: boolean
  spatialPositions: Record<string, SpatialPosition>
  setSpatialPositions: React.Dispatch<
    React.SetStateAction<Record<string, SpatialPosition>>
  >
}) {
  const room = useRoomContext()
  const { localParticipant } = useLocalParticipant()
  const participants = useParticipants()
  const voice = useVoice()
  const {
    settings,
    micOn,
    camOn,
    deafened,
    participantVolume,
    leaveVoice,
    toggleMic,
    toggleCam,
    toggleDeafen,
    myHandRaised,
  } = voice

  const myHandRaisedRef = useRef(myHandRaised)
  useEffect(() => {
    myHandRaisedRef.current = myHandRaised
  }, [myHandRaised])

  useEffect(() => {
    emitReactionRef.current = (emoji: string) => {
      const payload: DataMsg = { type: "reaction", emoji }
      const data = new TextEncoder().encode(JSON.stringify(payload))
      void localParticipant.publishData(data, { reliable: false })
      pushFloating({ emoji, identity: localParticipant.identity })
    }
    toggleHandRef.current = () => {
      const next = !myHandRaisedRef.current
      setMyHandRaised(next)
      const payload: DataMsg = { type: "hand", raised: next }
      const data = new TextEncoder().encode(JSON.stringify(payload))
      void localParticipant.publishData(data, { reliable: true })
      setRaisedHands((prev) => {
        const without = prev.filter((p) => p.identity !== localParticipant.identity)
        return next
          ? [...without, { identity: localParticipant.identity, at: Date.now() }]
          : without
      })
    }
    emitSfxRef.current = (sfxId: string) => {
      playSfx(sfxId as SfxId)
      const payload: DataMsg = { type: "sfx", sfxId }
      const data = new TextEncoder().encode(JSON.stringify(payload))
      void localParticipant.publishData(data, { reliable: false })
    }
    playLocalSfxRef.current = (sfxId: string) => {
      playSfx(sfxId as SfxId)
    }
    startWatchRef.current = (url: string) => {
      const id = parseYouTubeId(url)
      if (!id) {
        toast.error("Couldn't parse a YouTube link from that URL")
        return
      }
      const next: WatchState = {
        videoId: id,
        hostIdentity: localParticipant.identity,
        playing: true,
        currentTime: 0,
        lastUpdateAt: Date.now(),
      }
      setWatch(next)
      const payload: DataMsg = {
        type: "watch",
        action: "start",
        videoId: id,
        currentTime: 0,
        playing: true,
      }
      const data = new TextEncoder().encode(JSON.stringify(payload))
      void localParticipant.publishData(data, { reliable: true })
    }
    stopWatchRef.current = () => {
      setWatch(null)
      const payload: DataMsg = { type: "watch", action: "stop" }
      const data = new TextEncoder().encode(JSON.stringify(payload))
      void localParticipant.publishData(data, { reliable: true })
    }
    reportWatchStateRef.current = (playing: boolean, currentTime: number) => {
      setWatch((cur) =>
        cur && cur.hostIdentity === localParticipant.identity
          ? { ...cur, playing, currentTime, lastUpdateAt: Date.now() }
          : cur,
      )
      const payload: DataMsg = {
        type: "watch",
        action: "state",
        playing,
        currentTime,
      }
      const data = new TextEncoder().encode(JSON.stringify(payload))
      void localParticipant.publishData(data, { reliable: false })
    }
    setMyPositionRef.current = (x: number, y: number) => {
      const id = localParticipant.identity
      setSpatialPositions((prev) => ({
        ...prev,
        [id]: { identity: id, x, y, at: Date.now() },
      }))
      const payload: DataMsg = { type: "spatial", x, y }
      const data = new TextEncoder().encode(JSON.stringify(payload))
      void localParticipant.publishData(data, { reliable: false })
    }
  }, [
    emitReactionRef,
    toggleHandRef,
    emitSfxRef,
    playLocalSfxRef,
    startWatchRef,
    stopWatchRef,
    reportWatchStateRef,
    setMyPositionRef,
    localParticipant,
    pushFloating,
    setMyHandRaised,
    setRaisedHands,
    setWatch,
    setSpatialPositions,
  ])

  useEffect(() => {
    if (!room) return
    const onData = (
      payload: Uint8Array,
      participant?: RemoteParticipant,
    ) => {
      try {
        const text = new TextDecoder().decode(payload)
        const msg = JSON.parse(text) as DataMsg
        const id = participant?.identity
        if (!id) return
        if (msg.type === "reaction") {
          pushFloating({ emoji: msg.emoji, identity: id })
        } else if (msg.type === "hand") {
          setRaisedHands((prev) => {
            const without = prev.filter((p) => p.identity !== id)
            return msg.raised ? [...without, { identity: id, at: Date.now() }] : without
          })
        } else if (msg.type === "sfx") {
          playSfx(msg.sfxId as SfxId)
        } else if (msg.type === "watch") {
          if (msg.action === "start") {
            setWatch({
              videoId: msg.videoId,
              hostIdentity: id,
              playing: msg.playing,
              currentTime: msg.currentTime,
              lastUpdateAt: Date.now(),
            })
          } else if (msg.action === "stop") {
            setWatch(null)
          } else if (msg.action === "state") {
            setWatch((cur) =>
              cur && cur.hostIdentity === id
                ? {
                    ...cur,
                    playing: msg.playing,
                    currentTime: msg.currentTime,
                    lastUpdateAt: Date.now(),
                  }
                : cur,
            )
          }
        } else if (msg.type === "spatial") {
          setSpatialPositions((prev) => ({
            ...prev,
            [id]: { identity: id, x: msg.x, y: msg.y, at: Date.now() },
          }))
        } else if (msg.type === "caption") {
          const name = participant?.name || id
          setCaptions((prev) => {
            const without = prev.filter(
              (c) => !(c.identity === id && !c.final),
            )
            const next: Caption = {
              identity: id,
              name,
              text: msg.text,
              final: msg.final,
              at: Date.now(),
            }
            const trimmed = [...without, next].slice(-12)
            return trimmed
          })
        }
      } catch {}
    }
    room.on(RoomEvent.DataReceived, onData)
    return () => {
      room.off(RoomEvent.DataReceived, onData)
    }
  }, [room, pushFloating, setRaisedHands, setCaptions, setWatch, setSpatialPositions])

  useEffect(() => {
    if (!room) return
    const onJoin = (p: RemoteParticipant) => {
      const name = p.name || p.identity
      toast(`${name} joined the call`)
    }
    const onLeave = (p: RemoteParticipant) => {
      const name = p.name || p.identity
      toast(`${name} left the call`)
      setRaisedHands((prev) => prev.filter((x) => x.identity !== p.identity))
    }
    room.on(RoomEvent.ParticipantConnected, onJoin)
    room.on(RoomEvent.ParticipantDisconnected, onLeave)
    return () => {
      room.off(RoomEvent.ParticipantConnected, onJoin)
      room.off(RoomEvent.ParticipantDisconnected, onLeave)
    }
  }, [room, setRaisedHands])

  useEffect(() => {
    if (settings.ptt) return
    void localParticipant.setMicrophoneEnabled(micOn).catch(() => {})
  }, [settings.ptt, micOn, localParticipant])

  useEffect(() => {
    if (!settings.ptt) return
    void localParticipant.setMicrophoneEnabled(false).catch(() => {})
    setPttHeld(false)
  }, [settings.ptt, localParticipant, setPttHeld])

  useEffect(() => {
    void localParticipant.setCameraEnabled(camOn).catch(() => {})
  }, [camOn, localParticipant])

  useEffect(() => {
    if (!settings.micDeviceId) return
    void room
      ?.switchActiveDevice("audioinput", settings.micDeviceId)
      .catch(() => {})
  }, [room, settings.micDeviceId])

  useEffect(() => {
    if (!settings.speakerDeviceId) return
    void room
      ?.switchActiveDevice("audiooutput", settings.speakerDeviceId)
      .catch(() => {})
  }, [room, settings.speakerDeviceId])

  useEffect(() => {
    const isSelfShare = localParticipant.getTrackPublication(
      Track.Source.ScreenShare,
    )?.track
    setIsSharing(!!isSelfShare)
    const onTrack = () => {
      const cur = localParticipant.getTrackPublication(Track.Source.ScreenShare)
        ?.track
      setIsSharing(!!cur)
    }
    localParticipant.on("localTrackPublished", onTrack)
    localParticipant.on("localTrackUnpublished", onTrack)
    return () => {
      localParticipant.off("localTrackPublished", onTrack)
      localParticipant.off("localTrackUnpublished", onTrack)
    }
  }, [localParticipant, setIsSharing])

  useEffect(() => {
    for (const p of participants) {
      if (p.isLocal) continue
      const vol = participantVolume[p.identity]
      const pubs = p.audioTrackPublications
      pubs.forEach((pub) => {
        const t = pub.track as RemoteAudioTrack | undefined
        if (!t) return
        try {
          if (spatialOn) {
            t.setVolume(0)
          } else if (deafened) {
            t.setVolume(0)
          } else {
            t.setVolume(typeof vol === "number" ? vol : 1)
          }
        } catch {}
      })
    }
  }, [participants, participantVolume, deafened, spatialOn])

  const audioCtxRef = useRef<AudioContext | null>(null)
  const spatialNodesRef = useRef<
    Map<
      string,
      {
        source: MediaStreamAudioSourceNode
        panner: StereoPannerNode
        gain: GainNode
      }
    >
  >(new Map())

  useEffect(() => {
    if (!spatialOn) {
      const map = spatialNodesRef.current
      map.forEach((n) => {
        try {
          n.source.disconnect()
          n.panner.disconnect()
          n.gain.disconnect()
        } catch {}
      })
      map.clear()
      const ctx = audioCtxRef.current
      if (ctx) {
        void ctx.close().catch(() => {})
        audioCtxRef.current = null
      }
      return
    }
    if (!audioCtxRef.current) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext
      if (!Ctor) return
      audioCtxRef.current = new Ctor()
    }
    const ctx = audioCtxRef.current
    if (!ctx) return
    if (ctx.state === "suspended") void ctx.resume().catch(() => {})

    const nodes = spatialNodesRef.current
    const seen = new Set<string>()
    for (const p of participants) {
      if (p.isLocal) continue
      seen.add(p.identity)
      let bundle = nodes.get(p.identity)
      const audioPub = p.audioTrackPublications.values().next().value
      const track = audioPub?.track as RemoteAudioTrack | undefined
      const mst = track?.mediaStreamTrack
      if (!mst) {
        if (bundle) {
          try {
            bundle.source.disconnect()
            bundle.panner.disconnect()
            bundle.gain.disconnect()
          } catch {}
          nodes.delete(p.identity)
        }
        continue
      }
      if (!bundle) {
        try {
          const stream = new MediaStream([mst])
          const source = ctx.createMediaStreamSource(stream)
          const panner = ctx.createStereoPanner()
          const gain = ctx.createGain()
          source.connect(panner).connect(gain).connect(ctx.destination)
          bundle = { source, panner, gain }
          nodes.set(p.identity, bundle)
        } catch {
          continue
        }
      }
      const me = spatialPositions[localParticipant.identity]
      const them = spatialPositions[p.identity]
      const mx = me?.x ?? 0.5
      const my = me?.y ?? 0.5
      const tx = them?.x ?? 0.5
      const ty = them?.y ?? 0.5
      const dx = tx - mx
      const dy = ty - my
      const dist = Math.min(1, Math.sqrt(dx * dx + dy * dy) * 1.4)
      const gainVal = Math.max(0.05, 1 - dist) ** 1.5
      const pan = Math.max(-1, Math.min(1, dx * 2.2))
      try {
        bundle.gain.gain.setTargetAtTime(gainVal, ctx.currentTime, 0.05)
        bundle.panner.pan.setTargetAtTime(pan, ctx.currentTime, 0.05)
      } catch {}
    }
    nodes.forEach((bundle, id) => {
      if (!seen.has(id)) {
        try {
          bundle.source.disconnect()
          bundle.panner.disconnect()
          bundle.gain.disconnect()
        } catch {}
        nodes.delete(id)
      }
    })
  }, [spatialOn, participants, spatialPositions, localParticipant.identity])

  useEffect(() => {
    if (!spatialOn) return
    const id = localParticipant.identity
    if (!spatialPositions[id]) {
      setMyPositionRef.current(0.5, 0.5)
    }
  }, [spatialOn, spatialPositions, localParticipant.identity, setMyPositionRef])

  useEffect(() => {
    if (!camOn) return
    if (!settings.blur) {
      const pub = localParticipant.getTrackPublication(Track.Source.Camera)
      const track = pub?.track
      if (track && (track as { getProcessor?: unknown }).getProcessor) {
        void removeBlur(track as never).catch(() => {})
      }
      return
    }
    let cancelled = false
    const apply = async () => {
      const pub = localParticipant.getTrackPublication(Track.Source.Camera)
      const track = pub?.track
      if (!track) return
      const proc = await applyBlur(track as never)
      if (!proc && !cancelled) {
        toast.error("Background blur not supported on this device")
      }
    }
    void apply()
    return () => {
      cancelled = true
    }
  }, [camOn, settings.blur, localParticipant])

  useEffect(() => {
    if (!captionsOn) return
    const W = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike
      webkitSpeechRecognition?: new () => SpeechRecognitionLike
    }
    const Ctor = W.SpeechRecognition || W.webkitSpeechRecognition
    if (!Ctor) {
      toast.error("Live captions aren't supported in this browser")
      return
    }
    const rec = new Ctor()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = navigator.language || "en-US"
    let stopped = false
    rec.onresult = (event) => {
      const last = event.results[event.results.length - 1]
      if (!last) return
      const text = last[0]?.transcript?.trim() ?? ""
      if (!text) return
      const final = last.isFinal
      const payload: DataMsg = { type: "caption", text, final }
      const data = new TextEncoder().encode(JSON.stringify(payload))
      void localParticipant.publishData(data, { reliable: false })
      setCaptions((prev) => {
        const without = prev.filter(
          (c) => !(c.identity === localParticipant.identity && !c.final),
        )
        const me: Caption = {
          identity: localParticipant.identity,
          name: localParticipant.name || localParticipant.identity,
          text,
          final,
          at: Date.now(),
        }
        return [...without, me].slice(-12)
      })
    }
    rec.onerror = () => {}
    rec.onend = () => {
      if (!stopped) {
        try {
          rec.start()
        } catch {}
      }
    }
    try {
      rec.start()
    } catch {}
    return () => {
      stopped = true
      try {
        rec.stop()
      } catch {}
    }
  }, [captionsOn, localParticipant, setCaptions])

  useEffect(() => {
    function isTypingTarget(t: EventTarget | null) {
      if (!(t instanceof HTMLElement)) return false
      const tag = t.tagName.toLowerCase()
      if (tag === "input" || tag === "textarea" || tag === "select") return true
      if (t.isContentEditable) return true
      return false
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return
      if (e.altKey || e.ctrlKey || e.metaKey) {
        if ((e.key === "m" || e.key === "M") && !isTypingTarget(e.target)) {
          e.preventDefault()
          toggleMic()
        } else if ((e.key === "d" || e.key === "D") && !isTypingTarget(e.target)) {
          e.preventDefault()
          toggleDeafen()
        } else if ((e.key === "v" || e.key === "V") && !isTypingTarget(e.target)) {
          e.preventDefault()
          toggleCam()
        } else if ((e.key === "h" || e.key === "H") && !isTypingTarget(e.target)) {
          e.preventDefault()
          toggleHandRef.current()
        }
        return
      }
      if (settings.ptt && !isTypingTarget(e.target)) {
        const k = settings.pttKey
        const matches =
          (k === "Space" && e.code === "Space") ||
          e.key === k ||
          e.code === k
        if (matches) {
          e.preventDefault()
          setPttHeld(true)
          void localParticipant.setMicrophoneEnabled(true).catch(() => {})
        }
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (settings.ptt) {
        const k = settings.pttKey
        const matches =
          (k === "Space" && e.code === "Space") ||
          e.key === k ||
          e.code === k
        if (matches) {
          e.preventDefault()
          setPttHeld(false)
          void localParticipant.setMicrophoneEnabled(false).catch(() => {})
        }
      }
    }
    const onBlur = () => {
      if (settings.ptt) {
        setPttHeld(false)
        void localParticipant.setMicrophoneEnabled(false).catch(() => {})
      }
    }
    window.addEventListener("keydown", onKeyDown)
    window.addEventListener("keyup", onKeyUp)
    window.addEventListener("blur", onBlur)
    return () => {
      window.removeEventListener("keydown", onKeyDown)
      window.removeEventListener("keyup", onKeyUp)
      window.removeEventListener("blur", onBlur)
    }
  }, [
    settings.ptt,
    settings.pttKey,
    localParticipant,
    setPttHeld,
    toggleMic,
    toggleCam,
    toggleDeafen,
    toggleHandRef,
    leaveVoice,
  ])

  return null
}

function parseYouTubeId(input: string): string | null {
  const trimmed = input.trim()
  if (/^[\w-]{11}$/.test(trimmed)) return trimmed
  try {
    const u = new URL(
      trimmed.startsWith("http") ? trimmed : `https://${trimmed}`,
    )
    const host = u.hostname.replace(/^www\./, "")
    if (host === "youtu.be") {
      const id = u.pathname.replace("/", "")
      return /^[\w-]{11}$/.test(id) ? id : null
    }
    if (host === "youtube.com" || host === "m.youtube.com") {
      const v = u.searchParams.get("v")
      if (v && /^[\w-]{11}$/.test(v)) return v
      const m = u.pathname.match(/\/(?:embed|shorts|live)\/([\w-]{11})/)
      if (m) return m[1]!
    }
  } catch {}
  return null
}
