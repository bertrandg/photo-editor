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
  const { image, state, setState, commit } = useEditor()
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const size = useFitSize(containerRef, image.width / image.height)

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
          <canvas ref={canvasRef} style={{ width: size.width, height: size.height, display: "block" }} />
        </ReactCrop>
      )}
    </div>
  )
}
