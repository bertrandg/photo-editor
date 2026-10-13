import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { applyAdjustments, hasActiveAdjustments } from "../adjustments"
import { GpuPreview } from "../render/gpu-preview"

interface Output {
  canvas: HTMLCanvasElement
  /** Changes whenever the canvas content changes. */
  version: number
}

/**
 * Applies the adjustments to `base` (the downscaled, transformed preview).
 *
 * - No active adjustment: `base` is returned as is (no pixel work at all).
 * - Otherwise the GPU renders it synchronously (~1–2 ms, even on old phones).
 * - CPU fallback (no WebGL, lost context…): at most one render per frame.
 *
 * @param scale ratio between the preview and the full resolution image
 */
export function useAdjustedPreview(base: HTMLCanvasElement, adjustments: Record<string, number>, scale: number) {
  const active = hasActiveAdjustments(adjustments)
  // `undefined` = not created yet, `null` = WebGL unavailable.
  const gpuRef = useRef<GpuPreview | null | undefined>(undefined)
  const cpuCanvas = useMemo(() => document.createElement("canvas"), [])
  const [output, setOutput] = useState<Output>({ canvas: cpuCanvas, version: 0 })

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

    if (gpu?.render(base, adjustments, scale)) {
      // Layout effect: the new frame is ready before the browser paints.
      setOutput((o) => ({ canvas: gpu.canvas, version: o.version + 1 }))
      return
    }

    const frame = requestAnimationFrame(() => {
      const data = base.getContext("2d", { willReadFrequently: true })!.getImageData(0, 0, base.width, base.height)
      applyAdjustments(data.data, data.width, data.height, adjustments, scale)
      cpuCanvas.width = data.width
      cpuCanvas.height = data.height
      cpuCanvas.getContext("2d")!.putImageData(data, 0, 0)
      setOutput((o) => ({ canvas: cpuCanvas, version: o.version + 1 }))
    })
    return () => cancelAnimationFrame(frame)
  }, [active, base, adjustments, scale, cpuCanvas])

  return active ? output : { canvas: base, version: 0 }
}
