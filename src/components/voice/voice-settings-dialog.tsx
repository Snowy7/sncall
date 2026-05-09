import { useEffect, useRef, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useVoice } from "./voice-provider"
import { Microphone, SpeakerHigh, Keyboard } from "@phosphor-icons/react"

type DeviceInfo = { deviceId: string; label: string }

export function VoiceSettingsDialog() {
  const voice = useVoice()
  const [mics, setMics] = useState<DeviceInfo[]>([])
  const [speakers, setSpeakers] = useState<DeviceInfo[]>([])
  const [permissionDenied, setPermissionDenied] = useState(false)
  const [bindingKey, setBindingKey] = useState(false)
  const bindingRef = useRef(bindingKey)
  bindingRef.current = bindingKey

  useEffect(() => {
    if (!voice.settingsOpen) return
    let cancelled = false
    async function load() {
      try {
        const all = await navigator.mediaDevices.enumerateDevices()
        if (cancelled) return
        const labelled = all.some((d) => d.label)
        if (!labelled) {
          try {
            const tmp = await navigator.mediaDevices.getUserMedia({
              audio: true,
            })
            tmp.getTracks().forEach((t) => t.stop())
          } catch {
            setPermissionDenied(true)
          }
        }
        const fresh = await navigator.mediaDevices.enumerateDevices()
        if (cancelled) return
        setMics(
          fresh
            .filter((d) => d.kind === "audioinput")
            .map((d) => ({
              deviceId: d.deviceId,
              label: d.label || "Microphone",
            })),
        )
        setSpeakers(
          fresh
            .filter((d) => d.kind === "audiooutput")
            .map((d) => ({
              deviceId: d.deviceId,
              label: d.label || "Speaker",
            })),
        )
      } catch {}
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [voice.settingsOpen])

  useEffect(() => {
    if (!bindingKey) return
    function onKey(e: KeyboardEvent) {
      e.preventDefault()
      e.stopPropagation()
      if (e.key === "Escape") {
        setBindingKey(false)
        return
      }
      const k = e.code === "Space" ? "Space" : e.key
      if (!k || k === "Shift" || k === "Control" || k === "Alt" || k === "Meta") {
        return
      }
      voice.updateSettings({ pttKey: k })
      setBindingKey(false)
    }
    window.addEventListener("keydown", onKey, true)
    return () => window.removeEventListener("keydown", onKey, true)
  }, [bindingKey, voice])

  const supportsOutputSelect =
    typeof window !== "undefined" &&
    "setSinkId" in HTMLMediaElement.prototype

  return (
    <Dialog
      open={voice.settingsOpen}
      onOpenChange={(o) => voice.setSettingsOpen(o)}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Voice settings</DialogTitle>
          <DialogDescription>
            Pick your devices, configure push-to-talk, and tune audio
            processing.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <Section
            title="Input device"
            icon={<Microphone className="size-4" />}
          >
            {permissionDenied ? (
              <p className="text-xs text-muted-foreground">
                Microphone access blocked — enable it in your browser
                settings to choose a device.
              </p>
            ) : null}
            <select
              value={voice.settings.micDeviceId ?? ""}
              onChange={(e) =>
                voice.updateSettings({
                  micDeviceId: e.target.value || undefined,
                })
              }
              className="w-full rounded-md border border-border/60 bg-background px-2 py-1.5 text-sm"
            >
              <option value="">System default</option>
              {mics.map((m) => (
                <option key={m.deviceId} value={m.deviceId}>
                  {m.label}
                </option>
              ))}
            </select>
          </Section>

          <Section
            title="Output device"
            icon={<SpeakerHigh className="size-4" />}
          >
            {!supportsOutputSelect ? (
              <p className="text-xs text-muted-foreground">
                Your browser doesn't support speaker selection — change it
                in your OS sound settings instead.
              </p>
            ) : (
              <select
                value={voice.settings.speakerDeviceId ?? ""}
                onChange={(e) =>
                  voice.updateSettings({
                    speakerDeviceId: e.target.value || undefined,
                  })
                }
                className="w-full rounded-md border border-border/60 bg-background px-2 py-1.5 text-sm"
              >
                <option value="">System default</option>
                {speakers.map((s) => (
                  <option key={s.deviceId} value={s.deviceId}>
                    {s.label}
                  </option>
                ))}
              </select>
            )}
          </Section>

          <Section
            title="Push-to-talk"
            icon={<Keyboard className="size-4" />}
          >
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={voice.settings.ptt}
                onChange={(e) =>
                  voice.updateSettings({ ptt: e.target.checked })
                }
              />
              Hold a key to transmit
            </label>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Key:</span>
              <Button
                size="sm"
                variant={bindingKey ? "default" : "outline"}
                onClick={() => setBindingKey(true)}
                disabled={!voice.settings.ptt}
                className="font-mono"
              >
                {bindingKey ? "Press a key…" : voice.settings.pttKey}
              </Button>
              {bindingKey ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setBindingKey(false)}
                >
                  Cancel
                </Button>
              ) : null}
            </div>
          </Section>

          <Section title="Audio processing">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={voice.settings.noiseSuppression}
                onChange={(e) =>
                  voice.updateSettings({
                    noiseSuppression: e.target.checked,
                  })
                }
              />
              Noise suppression
            </label>
            <label className="mt-1.5 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={voice.settings.echoCancellation}
                onChange={(e) =>
                  voice.updateSettings({
                    echoCancellation: e.target.checked,
                  })
                }
              />
              Echo cancellation
            </label>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Audio changes apply on your next call.
            </p>
          </Section>

          <Section title="Video">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={voice.settings.blur}
                onChange={(e) =>
                  voice.updateSettings({ blur: e.target.checked })
                }
              />
              Background blur
            </label>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Applies to your camera. May not run smoothly on low-end devices.
            </p>
          </Section>

          <Section title="Shortcuts">
            <ul className="space-y-1 text-xs text-muted-foreground">
              <Shortcut combo="Cmd/Ctrl + M">Toggle mute</Shortcut>
              <Shortcut combo="Cmd/Ctrl + D">Toggle deafen</Shortcut>
              <Shortcut combo="Cmd/Ctrl + V">Toggle camera</Shortcut>
              <Shortcut combo="Cmd/Ctrl + H">Toggle hand</Shortcut>
            </ul>
          </Section>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Section({
  title,
  icon,
  children,
}: {
  title: string
  icon?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {icon}
        {title}
      </div>
      <div>{children}</div>
    </div>
  )
}

function Shortcut({
  combo,
  children,
}: {
  combo: string
  children: React.ReactNode
}) {
  return (
    <li className="flex items-center justify-between">
      <span>{children}</span>
      <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-foreground/80">
        {combo}
      </span>
    </li>
  )
}
