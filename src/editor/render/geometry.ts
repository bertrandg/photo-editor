import type { CropRect } from "../types"

export const FULL_CROP: CropRect = { x: 0, y: 0, width: 100, height: 100 }

/**
 * Converts a percent crop to integer pixel coordinates of an image.
 * When `aspect` is given, the result is snapped to that exact ratio
 * (percent values lose precision on large images).
 */
export function cropToPixels(crop: CropRect, width: number, height: number, aspect?: number) {
  const x = Math.round((crop.x / 100) * width)
  const y = Math.round((crop.y / 100) * height)
  let w = Math.max(1, Math.min(width - x, Math.round((crop.width / 100) * width)))
  let h = Math.max(1, Math.min(height - y, Math.round((crop.height / 100) * height)))
  if (aspect) {
    const snappedH = Math.round(w / aspect)
    if (snappedH <= height - y) h = Math.max(1, snappedH)
    else w = Math.max(1, Math.round(h * aspect))
  }
  return { x, y, width: w, height: h }
}

/** Largest centered crop with the given aspect ratio (width / height). */
export function centeredAspectCrop(aspect: number, width: number, height: number): CropRect {
  const imageAspect = width / height
  if (imageAspect > aspect) {
    const w = (aspect / imageAspect) * 100
    return { x: (100 - w) / 2, y: 0, width: w, height: 100 }
  }
  const h = (imageAspect / aspect) * 100
  return { x: 0, y: (100 - h) / 2, width: 100, height: h }
}
