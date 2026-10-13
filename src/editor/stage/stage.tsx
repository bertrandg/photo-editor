import { EyeIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useEditor } from "../editor-context"
import { getTool } from "../tools"
import { CropStage } from "./crop-stage"
import { ResultStage } from "./result-stage"
import { useAdjustedPreview } from "./use-adjusted-preview"

export function Stage() {
  const { image, state, activeTool, showOriginal, setShowOriginal } = useEditor()
  const { canvas, version } = useAdjustedPreview(image, state.adjustments)
  const tool = getTool(activeTool)
  const source = showOriginal ? image.preview : canvas

  return (
    <div className="relative flex min-h-0 flex-1 flex-col bg-black/20">
      <div className="absolute top-4 left-4 z-10">
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
      <div className="min-h-0 flex-1 p-10 pt-16">
        {tool.stage === "crop" ? (
          <CropStage source={source} version={version} />
        ) : (
          <ResultStage source={source} version={version} interactive={!!tool.interactiveOverlays} />
        )}
      </div>
    </div>
  )
}
