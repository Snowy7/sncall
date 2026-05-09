import type { LocalVideoTrack } from "livekit-client"

export type BackgroundProcessorWrapper = {
  name: string
  destroy(): Promise<void>
}

type Factory = (blurRadius?: number) => BackgroundProcessorWrapper

let cachedFactory: Factory | null = null
let factoryPromise: Promise<Factory | null> | null = null

async function loadFactory(): Promise<Factory | null> {
  if (cachedFactory) return cachedFactory
  if (factoryPromise) return factoryPromise
  factoryPromise = import("@livekit/track-processors")
    .then((mod) => {
      cachedFactory = mod.BackgroundBlur as unknown as Factory
      return cachedFactory
    })
    .catch(() => null)
  return factoryPromise
}

export async function applyBlur(
  track: LocalVideoTrack,
  blurRadius = 12,
): Promise<BackgroundProcessorWrapper | null> {
  try {
    const factory = await loadFactory()
    if (!factory) return null
    const processor = factory(blurRadius)
    await track.setProcessor(
      processor as unknown as Parameters<LocalVideoTrack["setProcessor"]>[0],
    )
    return processor
  } catch {
    return null
  }
}

export async function removeBlur(track: LocalVideoTrack) {
  try {
    await track.stopProcessor()
  } catch {}
}

export const BackgroundBlur = applyBlur
