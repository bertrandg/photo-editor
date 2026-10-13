import { FlipHorizontal2Icon, FlipVertical2Icon, RotateCcwSquareIcon, RotateCwSquareIcon } from "lucide-react"
import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useEditor } from "../../editor-context"
import { centeredAspectCrop, cropToPixels, FULL_CROP } from "../../render/geometry"
import { flip, MAX_STRAIGHTEN_ANGLE, rotateQuarter, transformedSize } from "../../render/transform"
import type { EditorState } from "../../types"
import { PanelSection, SliderField } from "../panel-section"

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

/** After a 90° rotation the frame ratio is inverted (4:3 → 3:4). */
function rotateState(s: EditorState, dir: 1 | -1): EditorState {
  const aspect = s.cropAspect ? 1 / s.cropAspect : undefined
  const inverse = RATIO_PRESETS.find((p) => typeof p.ratio === "number" && aspect && Math.abs(p.ratio - aspect) < 1e-6)
  const keepPreset = s.cropPreset === "free" || s.cropPreset === "original"
  return {
    ...s,
    ...rotateQuarter(s, dir),
    cropAspect: aspect,
    cropPreset: keepPreset ? s.cropPreset : (inverse?.id ?? s.cropPreset),
  }
}

function IconAction({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <Button variant="outline" className="h-14 flex-1 flex-col gap-1 text-[11px] font-normal" onClick={onClick} title={label}>
      {children}
    </Button>
  )
}

export function CropPanel() {
  const { image, state, setState, commit, setShowGrid } = useEditor()
  // Crop coordinates live in the rotated image space.
  const size = transformedSize(state.transform, image.width, image.height)
  const px = cropToPixels(state.crop, size.width, size.height, state.cropAspect)

  const selectPreset = (id: string) => {
    const preset = RATIO_PRESETS.find((p) => p.id === id)
    if (!preset) return
    const aspect = preset.ratio === "original" ? size.width / size.height : (preset.ratio ?? undefined)
    setState((s) => ({
      ...s,
      cropPreset: preset.id,
      cropAspect: aspect,
      crop: aspect ? centeredAspectCrop(aspect, size.width, size.height) : s.crop,
    }))
  }

  const setAngle = (angle: number) => {
    setShowGrid(true)
    setState((s) => ({ ...s, transform: { ...s.transform, angle } }), { transient: true })
  }

  return (
    <div>
      <PanelSection title="Rotation">
        <div className="flex gap-2">
          <IconAction label="Pivoter à gauche" onClick={() => setState((s) => rotateState(s, -1))}>
            <RotateCcwSquareIcon className="size-5!" />
            -90°
          </IconAction>
          <IconAction label="Pivoter à droite" onClick={() => setState((s) => rotateState(s, 1))}>
            <RotateCwSquareIcon className="size-5!" />
            +90°
          </IconAction>
          <IconAction label="Symétrie horizontale" onClick={() => setState((s) => ({ ...s, ...flip(s, "h") }))}>
            <FlipHorizontal2Icon className="size-5!" />
            Horiz.
          </IconAction>
          <IconAction label="Symétrie verticale" onClick={() => setState((s) => ({ ...s, ...flip(s, "v") }))}>
            <FlipVertical2Icon className="size-5!" />
            Vert.
          </IconAction>
        </div>
        <SliderField
          label="Redresser"
          unit="°"
          value={state.transform.angle}
          min={-MAX_STRAIGHTEN_ANGLE}
          max={MAX_STRAIGHTEN_ANGLE}
          step={0.1}
          onChange={setAngle}
          onCommit={() => {
            setShowGrid(false)
            commit()
          }}
        />
      </PanelSection>

      <PanelSection title="Format">
        <ToggleGroup
          value={[state.cropPreset]}
          onValueChange={(v) => v[0] && selectPreset(v[0] as string)}
          variant="outline"
          spacing={2}
          className="grid w-full grid-cols-3"
        >
          {RATIO_PRESETS.map((p) => {
            const r = p.ratio === "original" ? size.width / size.height : p.ratio
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
              crop: s.cropAspect ? centeredAspectCrop(s.cropAspect, size.width, size.height) : FULL_CROP,
            }))
          }
        >
          Recentrer / agrandir au maximum
        </Button>
      </PanelSection>
    </div>
  )
}
