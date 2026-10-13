import { useEffect, useRef, useState } from "react"
import { drawOverlays } from "../overlays/kinds"
import { useEditor } from "../editor-context"
import { cropToPixels } from "../render/geometry"
import { OverlayLayer } from "./overlay-layer"
import { useFitSize } from "./use-fit-size"

interface Props {
  source: HTMLCanvasElement
  version: number
  /** Allow selecting / moving overlays directly on the image. */
  interactive: boolean
}

/** Cropped + adjusted image with its overlays, as it will be exported. */
export function ResultStage({ source, version, interactive }: Props) {
  const { image, state, showOriginal } = useEditor()
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // Redraw once web fonts are available (text overlays).
  const [fontsReady, setFontsReady] = useState(false)
  useEffect(() => {
    document.fonts.ready.then(() => setFontsReady(true))
  }, [])

  const crop = cropToPixels(state.crop, source.width, source.height, state.cropAspect)
  const size = useFitSize(containerRef, crop.width / crop.height)

  // Render at display resolution (capped by the preview resolution) for crisp text.
  const dpr = window.devicePixelRatio || 1
  const outW = Math.max(1, Math.round(Math.min(size.width * dpr, crop.width)))
  const outH = Math.max(1, Math.round((outW * crop.height) / crop.width))

  useEffect(() => {
    const c = canvasRef.current
    if (!c || !size.width) return
    c.width = outW
    c.height = outH
    const ctx = c.getContext("2d")!
    ctx.imageSmoothingQuality = "high"
    ctx.drawImage(showOriginal ? image.preview : source, crop.x, crop.y, crop.width, crop.height, 0, 0, outW, outH)
    if (!showOriginal) drawOverlays(ctx, state.overlays, outW, outH)
  }, [source, version, image.preview, showOriginal, state.overlays, crop.x, crop.y, crop.width, crop.height, outW, outH, size.width, fontsReady])


  return (
    <div ref={containerRef} className="flex h-full w-full items-center justify-center">
      {size.width > 0 && (
        <div className="relative" style={{ width: size.width, height: size.height }}>
          <canvas ref={canvasRef} className="block h-full w-full" />
          {interactive && !showOriginal && <OverlayLayer width={size.width} height={size.height} />}
        </div>
      )}
    </div>
  )
}
