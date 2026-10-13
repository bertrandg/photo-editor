/// <reference lib="webworker" />
import { applyLook, type Look, type PixelRegion } from "../pipeline"

export interface AdjustRequest {
  id: number
  buffer: ArrayBuffer
  width: number
  height: number
  look: Look
  region: PixelRegion
}

self.onmessage = (e: MessageEvent<AdjustRequest>) => {
  const { id, buffer, width, height, look, region } = e.data
  applyLook(new Uint8ClampedArray(buffer), width, height, look, 1, region)
  ;(self as unknown as DedicatedWorkerGlobalScope).postMessage({ id, buffer }, [buffer])
}
