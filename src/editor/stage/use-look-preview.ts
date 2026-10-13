import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { applyLook, hasActiveLook, type FilterState } from "../pipeline"
import { GpuPreview, type Frame } from "../render/gpu-preview"

interface Output {
  canvas: HTMLCanvasElement
  /** Changes whenever the canvas content changes. */
  version: number
}

/**
 * Applies the look (filter + adjustments) to `base`, the downscaled and
 * transformed preview.
 *
 * - Nothing active: `base` is returned as is (no pixel work at all).
 * - Otherwise the GPU renders it synchronously (~1–2 ms, even on old phones).
 * - CPU fallback (no WebGL, lost context…): at most one render per frame.
 *
 * @param scale ratio between the preview and the full resolution image
 * @param frame output frame (crop) in fractions of `base`, for vignettes
 */
export function useLookPreview(
  base: HTMLCanvasElement,
  adjustments: Record<string, number>,
  filter: FilterState,
  scale: number,
  frame: Frame,
) {
  const look = useMemo(() => ({ adjustments, filter }), [adjustments, filter])
  const active = hasActiveLook(look)
  // `undefined` = not created yet, `null` = WebGL unavailable.
  const gpuRef = useRef<GpuPreview | null | undefined>(undefined)
  const cpuCanvas = useMemo(() => document.createElement("canvas"), [])
  const [output, setOutput] = useState<Output>({ canvas: cpuCanvas, version: 0 })
  const { x, y, width, height } = frame

  // Free the WebGL context when the editor closes.
  useEffect(
    () => () => {
      gpuRef.current?.dispose()
      gpuRef.current = undefined
    },
    [],
  )

  useLayoutEffect(() => {
    if (!active) return
    if (gpuRef.current === undefined) gpuRef.current = GpuPreview.create()
    const gpu = gpuRef.current
    const frame = { x, y, width, height }

    if (gpu?.render(base, look, scale, frame)) {
      // Layout effect: the new frame is ready before the browser paints.
      setOutput((o) => ({ canvas: gpu.canvas, version: o.version + 1 }))
      return
    }

    const raf = requestAnimationFrame(() => {
      const W = base.width
      const H = base.height
      const data = base.getContext("2d", { willReadFrequently: true })!.getImageData(0, 0, W, H)
      applyLook(data.data, W, H, look, scale, {
        offsetX: -x * W,
        offsetY: -y * H,
        frameW: width * W,
        frameH: height * H,
      })
      cpuCanvas.width = W
      cpuCanvas.height = H
      cpuCanvas.getContext("2d")!.putImageData(data, 0, 0)
      setOutput((o) => ({ canvas: cpuCanvas, version: o.version + 1 }))
    })
    return () => cancelAnimationFrame(raf)
  }, [active, base, look, scale, x, y, width, height, cpuCanvas])

  return active ? output : { canvas: base, version: 0 }
}
