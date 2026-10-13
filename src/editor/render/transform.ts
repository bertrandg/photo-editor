import type { CropRect } from "../types"

/**
 * Geometric transform of the image, applied before cropping.
 *
 * Composition, from the source to the screen:
 *   1. `quarter` × 90° clockwise rotation
 *   2. horizontal / vertical mirror (in screen space)
 *   3. `angle` straightening rotation (degrees, clockwise), with an automatic
 *      zoom so that no empty corner is ever visible.
 */
export interface ImageTransform {
  quarter: 0 | 1 | 2 | 3
  flipH: boolean
  flipV: boolean
  angle: number
}

export const IDENTITY_TRANSFORM: ImageTransform = { quarter: 0, flipH: false, flipV: false, angle: 0 }

export const MAX_STRAIGHTEN_ANGLE = 45

export function isIdentity(t: ImageTransform) {
  return t.quarter === 0 && !t.flipH && !t.flipV && t.angle === 0
}

/** Size of the transformed image (the space in which the crop is expressed). */
export function transformedSize(t: ImageTransform, width: number, height: number) {
  return t.quarter % 2 ? { width: height, height: width } : { width, height }
}

/** Zoom needed so that the straightened image fully covers its frame. */
function coverScale(angleDeg: number, w: number, h: number) {
  if (!angleDeg) return 1
  const a = (Math.abs(angleDeg) * Math.PI) / 180
  const cos = Math.cos(a)
  const sin = Math.sin(a)
  const s = Math.max((w * cos + h * sin) / w, (w * sin + h * cos) / h)
  // Tiny overscan so anti-aliased edges never leak transparent pixels.
  return s * (1 + 2 / Math.min(w, h))
}

/**
 * Sets up `ctx` so that `ctx.drawImage(source, 0, 0, srcW, srcH)` draws the
 * transformed image inside a frame of `transformedSize(...)` at the origin.
 * Compose with the existing transform (call after translate/scale for crops).
 */
export function applyTransform(ctx: CanvasRenderingContext2D, t: ImageTransform, srcW: number, srcH: number) {
  const { width: w, height: h } = transformedSize(t, srcW, srcH)
  const s = coverScale(t.angle, w, h)
  ctx.translate(w / 2, h / 2)
  ctx.rotate((t.angle * Math.PI) / 180)
  ctx.scale(t.flipH ? -1 : 1, t.flipV ? -1 : 1)
  ctx.rotate((t.quarter * Math.PI) / 2)
  ctx.scale(s, s)
  ctx.translate(-srcW / 2, -srcH / 2)
}

/** Renders the transformed (uncropped) image into a new canvas. */
export function renderTransformed(source: CanvasImageSource, srcW: number, srcH: number, t: ImageTransform) {
  const { width, height } = transformedSize(t, srcW, srcH)
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!
  ctx.imageSmoothingQuality = "high"
  applyTransform(ctx, t, srcW, srcH)
  ctx.drawImage(source, 0, 0, srcW, srcH)
  return canvas
}

/* ------------------------------------------------------------------ */
/* Operations as seen on screen. Each one returns the new transform and */
/* the crop moved accordingly, so the user keeps the same framing.      */
/* ------------------------------------------------------------------ */

interface Geometry {
  transform: ImageTransform
  crop: CropRect
}

const mod4 = (n: number) => (((n % 4) + 4) % 4) as ImageTransform["quarter"]

/** Rotates the visible image by 90° (clockwise when `dir` = 1). */
export function rotateQuarter({ transform: t, crop }: Geometry, dir: 1 | -1): Geometry {
  // A mirror reverses the direction of rotations applied underneath it.
  const mirrored = t.flipH !== t.flipV
  const quarter = mod4(t.quarter + (mirrored ? -dir : dir))
  const rotated =
    dir === 1
      ? { x: 100 - crop.y - crop.height, y: crop.x, width: crop.height, height: crop.width }
      : { x: crop.y, y: 100 - crop.x - crop.width, width: crop.height, height: crop.width }
  return { transform: { ...t, quarter }, crop: rotated }
}

/** Mirrors the visible image. */
export function flip({ transform: t, crop }: Geometry, axis: "h" | "v"): Geometry {
  // Mirroring the straightened view = mirror underneath + opposite angle.
  const angle = t.angle ? -t.angle : 0
  if (axis === "h") {
    return { transform: { ...t, flipH: !t.flipH, angle }, crop: { ...crop, x: 100 - crop.x - crop.width } }
  }
  return { transform: { ...t, flipV: !t.flipV, angle }, crop: { ...crop, y: 100 - crop.y - crop.height } }
}
