import { useEffect, useMemo, useState } from "react"
import { applyAdjustments, hasActiveAdjustments } from "../adjustments"

/**
 * Applies the adjustments to `base` (the downscaled, transformed preview) and
 * returns a canvas that is updated in place (at most once per frame).
 * `version` changes whenever the canvas content changes. Without any active
 * adjustment, `base` is returned as is (no pixel work, e.g. while straightening).
 *
 * @param scale ratio between the preview and the full resolution image
 */
export function useAdjustedPreview(base: HTMLCanvasElement, adjustments: Record<string, number>, scale: number) {
  const canvas = useMemo(() => document.createElement("canvas"), [])

  const active = hasActiveAdjustments(adjustments)
  const pixels = useMemo(
    () => (active ? base.getContext("2d", { willReadFrequently: true })!.getImageData(0, 0, base.width, base.height) : null),
    [base, active],
  )
  const [version, setVersion] = useState(0)

  useEffect(() => {
    if (!pixels) return
    const frame = requestAnimationFrame(() => {
      const data = new ImageData(new Uint8ClampedArray(pixels.data), pixels.width, pixels.height)
      applyAdjustments(data.data, data.width, data.height, adjustments, scale)
      canvas.width = data.width
      canvas.height = data.height
      canvas.getContext("2d")!.putImageData(data, 0, 0)
      setVersion((v) => v + 1)
    })
    return () => cancelAnimationFrame(frame)
  }, [pixels, canvas, adjustments, scale])

  return active ? { canvas, version } : { canvas: base, version: 0 }
}
