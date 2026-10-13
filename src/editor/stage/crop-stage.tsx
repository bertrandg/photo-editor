import { useEffect, useRef } from "react"
import ReactCrop, { type PercentCrop } from "react-image-crop"
import { useEditor } from "../editor-context"
import { useFitSize } from "./use-fit-size"

interface Props {
  source: HTMLCanvasElement
  version: number
}

/** Full (uncropped) image with an editable crop frame. */
export function CropStage({ source, version }: Props) {
  const { state, setState, commit, showGrid } = useEditor()
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const size = useFitSize(containerRef, source.width / source.height)

  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    c.width = source.width
    c.height = source.height
    c.getContext("2d")!.drawImage(source, 0, 0)
  }, [source, version, size.width])

  const crop: PercentCrop = { unit: "%", ...state.crop }

  return (
    <div ref={containerRef} className="flex h-full w-full items-center justify-center">
      {size.width > 0 && (
        <ReactCrop
          crop={crop}
          aspect={state.cropAspect}
          keepSelection
          ruleOfThirds
          minWidth={16}
          minHeight={16}
          onChange={(_px, percent) =>
            setState(
              (s) => ({ ...s, crop: { x: percent.x, y: percent.y, width: percent.width, height: percent.height } }),
              { transient: true },
            )
          }
          onComplete={commit}
        >
          <div className="relative" style={{ width: size.width, height: size.height }}>
            <canvas ref={canvasRef} className="block h-full w-full" />
            {showGrid && <AlignmentGrid />}
          </div>
        </ReactCrop>
      )}
    </div>
  )
}

/** Dense grid displayed while straightening, to line up the horizon. */
function AlignmentGrid() {
  return (
    <div
      className="pointer-events-none absolute inset-0"
      style={{
        backgroundImage:
          "linear-gradient(to right, rgba(255,255,255,0.35) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.35) 1px, transparent 1px)",
        backgroundSize: "12.5% 12.5%",
        boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.35)",
      }}
    />
  )
}
