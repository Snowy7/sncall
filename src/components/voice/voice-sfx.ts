export type SfxId =
  | "ding"
  | "buzz"
  | "airhorn"
  | "applause"
  | "drum"
  | "chirp"
  | "rimshot"
  | "fanfare"

export type SfxPreset = {
  id: SfxId
  label: string
  emoji: string
}

export const SFX_PRESETS: SfxPreset[] = [
  { id: "ding", label: "Ding", emoji: "🔔" },
  { id: "buzz", label: "Buzz", emoji: "🐝" },
  { id: "airhorn", label: "Airhorn", emoji: "📣" },
  { id: "applause", label: "Applause", emoji: "👏" },
  { id: "drum", label: "Drum", emoji: "🥁" },
  { id: "chirp", label: "Chirp", emoji: "📡" },
  { id: "rimshot", label: "Rimshot", emoji: "🥁" },
  { id: "fanfare", label: "Fanfare", emoji: "🎺" },
]

let sharedCtx: AudioContext | null = null
function ctx(): AudioContext | null {
  if (typeof window === "undefined") return null
  if (sharedCtx && sharedCtx.state !== "closed") return sharedCtx
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext
  if (!Ctor) return null
  sharedCtx = new Ctor()
  return sharedCtx
}

function envelope(gain: GainNode, t0: number, attack: number, hold: number, release: number, peak = 0.6) {
  gain.gain.cancelScheduledValues(t0)
  gain.gain.setValueAtTime(0, t0)
  gain.gain.linearRampToValueAtTime(peak, t0 + attack)
  gain.gain.setValueAtTime(peak, t0 + attack + hold)
  gain.gain.linearRampToValueAtTime(0, t0 + attack + hold + release)
}

export function playSfx(id: SfxId) {
  const ac = ctx()
  if (!ac) return
  if (ac.state === "suspended") void ac.resume().catch(() => {})
  const t0 = ac.currentTime
  const out = ac.createGain()
  out.gain.value = 1
  out.connect(ac.destination)

  switch (id) {
    case "ding": {
      const o = ac.createOscillator()
      const g = ac.createGain()
      o.frequency.setValueAtTime(880, t0)
      o.frequency.exponentialRampToValueAtTime(660, t0 + 0.4)
      o.type = "sine"
      envelope(g, t0, 0.005, 0.02, 0.45, 0.5)
      o.connect(g).connect(out)
      o.start(t0)
      o.stop(t0 + 0.6)
      break
    }
    case "buzz": {
      const o = ac.createOscillator()
      const g = ac.createGain()
      o.frequency.setValueAtTime(160, t0)
      o.type = "sawtooth"
      envelope(g, t0, 0.01, 0.25, 0.05, 0.3)
      o.connect(g).connect(out)
      o.start(t0)
      o.stop(t0 + 0.4)
      break
    }
    case "airhorn": {
      const o1 = ac.createOscillator()
      const o2 = ac.createOscillator()
      const g = ac.createGain()
      o1.type = "square"
      o2.type = "square"
      o1.frequency.setValueAtTime(220, t0)
      o2.frequency.setValueAtTime(330, t0)
      envelope(g, t0, 0.02, 0.55, 0.1, 0.35)
      o1.connect(g)
      o2.connect(g)
      g.connect(out)
      o1.start(t0)
      o2.start(t0)
      o1.stop(t0 + 0.7)
      o2.stop(t0 + 0.7)
      break
    }
    case "applause": {
      const dur = 1.2
      const buf = ac.createBuffer(1, ac.sampleRate * dur, ac.sampleRate)
      const data = buf.getChannelData(0)
      for (let i = 0; i < data.length; i++) {
        const env = Math.min(1, i / (ac.sampleRate * 0.2)) * Math.max(0, 1 - i / data.length)
        data[i] = (Math.random() * 2 - 1) * env * 0.6
      }
      const src = ac.createBufferSource()
      src.buffer = buf
      const filter = ac.createBiquadFilter()
      filter.type = "bandpass"
      filter.frequency.value = 2200
      filter.Q.value = 0.7
      src.connect(filter).connect(out)
      src.start(t0)
      break
    }
    case "drum": {
      const o = ac.createOscillator()
      const g = ac.createGain()
      o.type = "sine"
      o.frequency.setValueAtTime(180, t0)
      o.frequency.exponentialRampToValueAtTime(50, t0 + 0.18)
      envelope(g, t0, 0.001, 0.01, 0.18, 0.8)
      o.connect(g).connect(out)
      o.start(t0)
      o.stop(t0 + 0.25)
      break
    }
    case "chirp": {
      const o = ac.createOscillator()
      const g = ac.createGain()
      o.type = "sine"
      o.frequency.setValueAtTime(1200, t0)
      o.frequency.exponentialRampToValueAtTime(2400, t0 + 0.12)
      envelope(g, t0, 0.005, 0.04, 0.06, 0.4)
      o.connect(g).connect(out)
      o.start(t0)
      o.stop(t0 + 0.2)
      break
    }
    case "rimshot": {
      const dur = 0.18
      const buf = ac.createBuffer(1, ac.sampleRate * dur, ac.sampleRate)
      const data = buf.getChannelData(0)
      for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.max(0, 1 - i / data.length) * 0.6
      }
      const src = ac.createBufferSource()
      src.buffer = buf
      const filter = ac.createBiquadFilter()
      filter.type = "highpass"
      filter.frequency.value = 1200
      src.connect(filter).connect(out)
      src.start(t0)
      const o = ac.createOscillator()
      const g = ac.createGain()
      o.type = "sine"
      o.frequency.setValueAtTime(800, t0 + 0.12)
      o.frequency.exponentialRampToValueAtTime(220, t0 + 0.32)
      envelope(g, t0 + 0.12, 0.001, 0.01, 0.18, 0.5)
      o.connect(g).connect(out)
      o.start(t0 + 0.12)
      o.stop(t0 + 0.4)
      break
    }
    case "fanfare": {
      const notes = [523, 659, 784, 1046]
      notes.forEach((f, i) => {
        const o = ac.createOscillator()
        const g = ac.createGain()
        o.type = "triangle"
        o.frequency.setValueAtTime(f, t0 + i * 0.1)
        envelope(g, t0 + i * 0.1, 0.005, 0.06, 0.06, 0.35)
        o.connect(g).connect(out)
        o.start(t0 + i * 0.1)
        o.stop(t0 + i * 0.1 + 0.18)
      })
      break
    }
  }
}
