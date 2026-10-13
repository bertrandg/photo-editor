import { EyeIcon } from "lucide-react"
import { useMemo } from "react"
import { Button } from "@/components/ui/button"
import { useEditor } from "../editor-context"
import { renderTransformed } from "../render/transform"
import { getTool } from "../tools"
import { CropStage } from "./crop-stage"
import { ResultStage } from "./result-stage"
import { useAdjustedPreview } from "./use-adjusted-preview"

export function Stage() {
  const { image, state, activeTool, showOriginal, setShowOriginal } = useEditor()
  const { transform } = state
  // Transformed (rotated / mirrored / straightened) preview, before adjustments.
  const oriented = useMemo(
    () => renderTransformed(image.preview, image.preview.width, image.preview.height, transform),
    [image.preview, transform],
  )
  const { canvas, version } = useAdjustedPreview(oriented, state.adjustments, image.preview.width / image.width)
  const tool = getTool(activeTool)
  const source = showOriginal ? oriented : canvas

  return (
    <div className="relative flex min-h-0 flex-1 flex-col bg-black/20">
      <div className="absolute top-3 left-3 z-10 md:top-4 md:left-4">
        <Button
          variant="outline"
          size="sm"
          className="rounded-full bg-background/80 backdrop-blur"
          aria-pressed={showOriginal}
          onPointerDown={() => setShowOriginal(true)}
          onPointerUp={() => setShowOriginal(false)}
          onPointerLeave={() => setShowOriginal(false)}
          onKeyDown={(e) => e.key === " " && setShowOriginal(true)}
          onKeyUp={() => setShowOriginal(false)}
          title="Maintenir pour voir l'original"
        >
          <EyeIcon />
          Avant / Après
        </Button>
      </div>
      <div className="min-h-0 flex-1 p-3 pt-13 md:p-10 md:pt-16">
        {tool.stage === "crop" ? (
          <CropStage source={source} version={showOriginal ? -1 : version} />
        ) : (
          <ResultStage source={source} version={showOriginal ? -1 : version} interactive={!!tool.interactiveOverlays} />
        )}
      </div>
    </div>
  )
}
