import { cn } from "@/lib/utils"
import { useEditor } from "../../editor-context"
import { getOverlayBox } from "../../overlays/kinds"
import type { Overlay } from "../../overlays/types"
import { cropToPixels } from "../../render/geometry"

const MARGIN = 0.04 // fraction of the output size

/** 3×3 grid that snaps the overlay to a corner / edge / center of the image. */
export function PositionGrid({ overlay, onChange }: { overlay: Overlay; onChange: (pos: { x: number; y: number }) => void }) {
  const { image, state } = useEditor()
  const crop = cropToPixels(state.crop, image.width, image.height, state.cropAspect)
  // Measure in a normalized space whose aspect ratio matches the output.
  const W = 1000
  const H = (W * crop.height) / crop.width
  const box = getOverlayBox(overlay, W, H)
  const halfW = box.width / 2 / W
  const halfH = box.height / 2 / H
  const marginY = (MARGIN * W) / H

  const xs = [MARGIN + halfW, 0.5, 1 - MARGIN - halfW]
  const ys = [marginY + halfH, 0.5, 1 - marginY - halfH]
  const near = (a: number, b: number) => Math.abs(a - b) < 0.005

  return (
    <div className="grid w-24 grid-cols-3 gap-1 rounded-lg border bg-muted/30 p-1">
      {ys.flatMap((y, row) =>
        xs.map((x, col) => {
          const active = near(overlay.x, x) && near(overlay.y, y)
          return (
            <button
              key={`${row}-${col}`}
              type="button"
              aria-label={`Position ${row + 1}-${col + 1}`}
              className={cn(
                "flex aspect-square items-center justify-center rounded-md hover:bg-accent",
                active && "bg-primary/20",
              )}
              onClick={() => onChange({ x, y })}
            >
              <span className={cn("size-1.5 rounded-full bg-muted-foreground", active && "size-2 bg-primary")} />
            </button>
          )
        }),
      )}
    </div>
  )
}
