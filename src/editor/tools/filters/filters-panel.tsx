import { useMemo } from "react"
import { cn } from "@/lib/utils"
import { NO_FILTER, useEditor } from "../../editor-context"
import { FILTERS } from "../../filters"
import { applyLook } from "../../pipeline"
import { cropToPixels } from "../../render/geometry"
import { PanelSection, SliderField } from "../panel-section"

/** Thumbnail size in pixels (rendered on the CPU: tiny, a few ms for all). */
const THUMB = 144

/** Current photo (cropped, square cover) at thumbnail size. */
function useThumbBase() {
  const { orientedPreview, state } = useEditor()
  const { crop, cropAspect } = state
  return useMemo(() => {
    const px = cropToPixels(crop, orientedPreview.width, orientedPreview.height, cropAspect)
    const side = Math.min(px.width, px.height)
    const canvas = document.createElement("canvas")
    canvas.width = canvas.height = THUMB
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!
    ctx.imageSmoothingQuality = "high"
    ctx.drawImage(
      orientedPreview,
      px.x + (px.width - side) / 2,
      px.y + (px.height - side) / 2,
      side,
      side,
      0,
      0,
      THUMB,
      THUMB,
    )
    return ctx.getImageData(0, 0, THUMB, THUMB)
  }, [orientedPreview, crop, cropAspect])
}

/** One preview per filter, with the current adjustments applied too. */
function useThumbnails(base: ImageData, adjustments: Record<string, number>) {
  return useMemo(() => {
    const canvas = document.createElement("canvas")
    canvas.width = canvas.height = THUMB
    const ctx = canvas.getContext("2d")!
    const render = (id: string | null) => {
      const data = new ImageData(new Uint8ClampedArray(base.data), THUMB, THUMB)
      applyLook(data.data, THUMB, THUMB, { adjustments, filter: { id, intensity: 100 } }, THUMB / 2048)
      ctx.putImageData(data, 0, 0)
      return canvas.toDataURL("image/jpeg", 0.85)
    }
    return new Map<string | null, string>([[null, render(null)], ...FILTERS.map((f) => [f.id, render(f.id)] as const)])
  }, [base, adjustments])
}

export function FiltersPanel() {
  const { state, setState, commit } = useEditor()
  const thumbs = useThumbnails(useThumbBase(), state.adjustments)
  const selected = state.filter.id

  const select = (id: string | null) =>
    setState((s) => (s.filter.id === id ? s : { ...s, filter: id ? { id, intensity: 100 } : NO_FILTER }))

  const tiles = [{ id: null, label: "Aucun" }, ...FILTERS.map((f) => ({ id: f.id, label: f.label }))]

  return (
    <div>
      <PanelSection title="Filtres">
        {/* Mobile: one horizontal scrolling strip; desktop: grid. */}
        <div className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:grid md:grid-cols-3 md:gap-x-2 md:gap-y-3 md:overflow-visible md:px-0 md:pb-0">
          {tiles.map((t) => {
            const active = t.id === selected
            return (
              <button
                key={t.id ?? "none"}
                type="button"
                aria-pressed={active}
                className="group flex w-18 shrink-0 snap-start flex-col items-center gap-1.5 p-0.5 text-xs outline-none md:w-auto md:min-w-0"
                onClick={() => select(t.id)}
              >
                <img
                  src={thumbs.get(t.id)}
                  alt=""
                  className={cn(
                    "aspect-square w-full rounded-lg object-cover ring-offset-2 ring-offset-sidebar transition group-hover:brightness-110 group-focus-visible:ring-2 group-focus-visible:ring-ring",
                    active && "ring-2 ring-primary",
                  )}
                />
                <span className={cn("max-w-full truncate text-muted-foreground", active && "font-medium text-primary")}>
                  {t.label}
                </span>
              </button>
            )
          })}
        </div>
      </PanelSection>

      {selected && (
        <PanelSection title="Réglage du filtre">
          <SliderField
            label="Intensité"
            unit="%"
            value={state.filter.intensity}
            min={0}
            max={100}
            onChange={(intensity) => setState((s) => ({ ...s, filter: { ...s.filter, intensity } }), { transient: true })}
            onCommit={commit}
          />
        </PanelSection>
      )}
    </div>
  )
}
