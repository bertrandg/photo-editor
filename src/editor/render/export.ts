import { hasActiveAdjustments } from "../adjustments"
import { drawOverlays } from "../overlays/kinds"
import type { EditorState, LoadedImage } from "../types"
import { cropToPixels } from "./geometry"
import { applyTransform, transformedSize } from "./transform"
import type { AdjustRequest } from "./adjust.worker"

export type ExportFormat = "image/png" | "image/jpeg" | "image/webp"

export const EXPORT_FORMATS: { type: ExportFormat; label: string; ext: string }[] = [
  { type: "image/jpeg", label: "JPEG", ext: "jpg" },
  { type: "image/png", label: "PNG", ext: "png" },
  { type: "image/webp", label: "WebP", ext: "webp" },
]

/** Conservative canvas limits that work in all modern desktop browsers. */
const MAX_CANVAS_DIM = 16384
const MAX_CANVAS_AREA = 120_000_000
/** Rows processed per worker round-trip (keeps memory usage bounded). */
const STRIP_ROWS = 512
/** Extra rows around each strip so convolution kernels have their neighbors. */
const STRIP_PAD = 2

let worker: Worker | null = null
let nextId = 0

function adjustInWorker(data: ImageData, values: Record<string, number>): Promise<Uint8ClampedArray> {
  worker ??= new Worker(new URL("./adjust.worker.ts", import.meta.url), { type: "module" })
  const w = worker
  const id = nextId++
  return new Promise((resolve, reject) => {
    const onMessage = (e: MessageEvent<{ id: number; buffer: ArrayBuffer }>) => {
      if (e.data.id !== id) return
      w.removeEventListener("message", onMessage)
      w.removeEventListener("error", onError)
      resolve(new Uint8ClampedArray(e.data.buffer))
    }
    const onError = (e: ErrorEvent) => {
      w.removeEventListener("message", onMessage)
      w.removeEventListener("error", onError)
      reject(e.error ?? new Error(e.message))
    }
    w.addEventListener("message", onMessage)
    w.addEventListener("error", onError)
    const buffer = data.data.buffer as ArrayBuffer
    const req: AdjustRequest = { id, buffer, width: data.width, height: data.height, values }
    w.postMessage(req, [buffer])
  })
}

function cropOf(image: LoadedImage, state: EditorState) {
  const { width, height } = transformedSize(state.transform, image.width, image.height)
  return cropToPixels(state.crop, width, height, state.cropAspect)
}

async function renderAt(image: LoadedImage, state: EditorState, scale: number) {
  const crop = cropOf(image, state)
  const outW = Math.max(1, Math.round(crop.width * scale))
  const outH = Math.max(1, Math.round(crop.height * scale))

  const canvas = document.createElement("canvas")
  canvas.width = outW
  canvas.height = outH
  const ctx = canvas.getContext("2d", { willReadFrequently: true })
  if (!ctx) throw new Error("Canvas indisponible")
  ctx.imageSmoothingQuality = "high"
  // Draw only the cropped part of the transformed image, straight from the
  // full resolution bitmap (no intermediate full-size canvas).
  ctx.save()
  ctx.scale(outW / crop.width, outH / crop.height)
  ctx.translate(-crop.x, -crop.y)
  applyTransform(ctx, state.transform, image.width, image.height)
  ctx.drawImage(image.full, 0, 0, image.width, image.height)
  ctx.restore()

  if (hasActiveAdjustments(state.adjustments)) {
    for (let y = 0; y < outH; y += STRIP_ROWS) {
      const top = Math.max(0, y - STRIP_PAD)
      const bottom = Math.min(outH, y + STRIP_ROWS + STRIP_PAD)
      const strip = ctx.getImageData(0, top, outW, bottom - top)
      const processed = await adjustInWorker(strip, state.adjustments)
      const rows = Math.min(STRIP_ROWS, outH - y)
      const offset = (y - top) * outW * 4
      const body = new ImageData(processed.slice(offset, offset + rows * outW * 4), outW, rows)
      ctx.putImageData(body, 0, y)
    }
  }

  await document.fonts.ready
  drawOverlays(ctx, state.overlays, outW, outH)
  return canvas
}

function toBlob(canvas: HTMLCanvasElement, type: ExportFormat, quality: number) {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Encodage impossible"))), type, quality),
  )
}

/**
 * Renders the edited image at full resolution (downscaled only if it exceeds
 * the browser canvas limits) and returns the encoded file.
 */
export async function exportImage(image: LoadedImage, state: EditorState, type: ExportFormat, quality = 0.92) {
  const crop = cropOf(image, state)
  let scale = Math.min(
    1,
    MAX_CANVAS_DIM / crop.width,
    MAX_CANVAS_DIM / crop.height,
    Math.sqrt(MAX_CANVAS_AREA / (crop.width * crop.height)),
  )

  // Retry at lower resolution if the browser cannot allocate the canvas.
  for (let attempt = 0; ; attempt++) {
    try {
      const canvas = await renderAt(image, state, scale)
      const blob = await toBlob(canvas, type, quality)
      canvas.width = canvas.height = 0 // release memory early
      return { blob, width: Math.round(crop.width * scale), height: Math.round(crop.height * scale), downscaled: scale < 1 }
    } catch (err) {
      if (attempt >= 3) throw err
      scale *= 0.7
    }
  }
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
