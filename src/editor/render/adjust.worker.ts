/// <reference lib="webworker" />
import { applyAdjustments } from "../adjustments"

export interface AdjustRequest {
  id: number
  buffer: ArrayBuffer
  width: number
  height: number
  values: Record<string, number>
}

self.onmessage = (e: MessageEvent<AdjustRequest>) => {
  const { id, buffer, width, height, values } = e.data
  applyAdjustments(new Uint8ClampedArray(buffer), width, height, values, 1)
  ;(self as unknown as DedicatedWorkerGlobalScope).postMessage({ id, buffer }, [buffer])
}
