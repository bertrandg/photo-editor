import { EyeIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useEditor } from "../editor-context"
import { getTool } from "../tools"
import { CropStage } from "./crop-stage"
import { ResultStage } from "./result-stage"
import { useLookPreview } from "./use-look-preview"

export function Stage() {
  const { image, orientedPreview: oriented, state, activeTool, showOriginal, setShowOriginal } = useEditor()
  const { crop } = state
  const frame = { x: crop.x / 100, y: crop.y / 100, width: crop.width / 100, height: crop.height / 100 }
  const { canvas, version } = useLookPreview(
    oriented,
    state.adjustments,
    state.filter,
    image.preview.width / image.width,
    frame,
  )
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
