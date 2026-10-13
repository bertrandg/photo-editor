import { Button } from "@/components/ui/button"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useEditor } from "../../editor-context"
import { centeredAspectCrop, cropToPixels, FULL_CROP } from "../../render/geometry"
import { PanelSection } from "../panel-section"

interface RatioPreset {
  id: string
  label: string
  /** width / height, `null` = free, `"original"` = image ratio. */
  ratio: number | null | "original"
}

/** Add a ratio here to make it available in the panel. */
export const RATIO_PRESETS: RatioPreset[] = [
  { id: "free", label: "Libre", ratio: null },
  { id: "original", label: "Original", ratio: "original" },
  { id: "1:1", label: "Carré", ratio: 1 },
  { id: "4:3", label: "4:3", ratio: 4 / 3 },
  { id: "3:4", label: "3:4", ratio: 3 / 4 },
  { id: "16:9", label: "16:9", ratio: 16 / 9 },
  { id: "9:16", label: "9:16", ratio: 9 / 16 },
  { id: "3:2", label: "3:2", ratio: 3 / 2 },
  { id: "2:3", label: "2:3", ratio: 2 / 3 },
]

function RatioIcon({ ratio }: { ratio: number | null }) {
  if (ratio === null) {
    return <div className="size-5 rounded-[3px] border-[1.5px] border-dashed border-current" />
  }
  const w = ratio >= 1 ? 20 : 20 * ratio
  const h = ratio >= 1 ? 20 / ratio : 20
  return <div className="rounded-[3px] border-[1.5px] border-current" style={{ width: w, height: h }} />
}

export function CropPanel() {
  const { image, state, setState } = useEditor()
  const px = cropToPixels(state.crop, image.width, image.height, state.cropAspect)

  const selectPreset = (id: string) => {
    const preset = RATIO_PRESETS.find((p) => p.id === id)
    if (!preset) return
    const aspect = preset.ratio === "original" ? image.width / image.height : (preset.ratio ?? undefined)
    setState((s) => ({
      ...s,
      cropPreset: preset.id,
      cropAspect: aspect,
      crop: aspect ? centeredAspectCrop(aspect, image.width, image.height) : s.crop,
    }))
  }

  return (
    <div>
      <PanelSection title="Format">
        <ToggleGroup
          value={[state.cropPreset]}
          onValueChange={(v) => v[0] && selectPreset(v[0] as string)}
          variant="outline"
          spacing={2}
          className="grid w-full grid-cols-3"
        >
          {RATIO_PRESETS.map((p) => {
            const r = p.ratio === "original" ? image.width / image.height : p.ratio
            return (
              <ToggleGroupItem
                key={p.id}
                value={p.id}
                className="flex h-16 w-full flex-col gap-1.5 text-xs data-pressed:border-primary data-pressed:bg-primary/15 data-pressed:text-primary"
              >
                <div className="flex size-5 items-center justify-center">
                  <RatioIcon ratio={r} />
                </div>
                {p.label}
              </ToggleGroupItem>
            )
          })}
        </ToggleGroup>
      </PanelSection>

      <PanelSection title="Dimensions">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Taille finale</span>
          <span className="tabular-nums">
            {px.width} × {px.height} px
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Image d'origine</span>
          <span className="text-muted-foreground tabular-nums">
            {image.width} × {image.height} px
          </span>
        </div>
        <Button
          variant="link"
          size="sm"
          className="self-start px-0"
          disabled={state.crop === FULL_CROP}
          onClick={() =>
            setState((s) => ({
              ...s,
              crop: s.cropAspect ? centeredAspectCrop(s.cropAspect, image.width, image.height) : FULL_CROP,
            }))
          }
        >
          Recentrer / agrandir au maximum
        </Button>
      </PanelSection>
    </div>
  )
}
