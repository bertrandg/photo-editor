import { useEffect, useMemo, useState } from "react"
import { applyAdjustments } from "../adjustments"
import type { LoadedImage } from "../types"

/**
 * Applies the adjustments to the downscaled preview and returns a canvas that
 * is updated in place (at most once per frame). `version` changes whenever the
 * canvas content changes.
 */
export function useAdjustedPreview(image: LoadedImage, adjustments: Record<string, number>) {
  const { preview } = image
  const canvas = useMemo(() => {
    const c = document.createElement("canvas")
    c.width = preview.width
    c.height = preview.height
    return c
  }, [preview])

  const base = useMemo(
    () => preview.getContext("2d", { willReadFrequently: true })!.getImageData(0, 0, preview.width, preview.height),
    [preview],
  )
  const [version, setVersion] = useState(0)

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const data = new ImageData(new Uint8ClampedArray(base.data), base.width, base.height)
      applyAdjustments(data.data, data.width, data.height, adjustments, preview.width / image.width)
      canvas.getContext("2d")!.putImageData(data, 0, 0)
      setVersion((v) => v + 1)
    })
    return () => cancelAnimationFrame(frame)
  }, [base, canvas, adjustments, preview, image.width])

  return { canvas, version }
}
