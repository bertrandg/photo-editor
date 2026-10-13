import {
  AlignCenterIcon,
  AlignLeftIcon,
  AlignRightIcon,
  BoldIcon,
  CircleIcon,
  ImageIcon,
  ItalicIcon,
  ScanFaceIcon,
  SquareIcon,
  TypeIcon,
  type LucideIcon,
} from "lucide-react"
import type { ComponentType } from "react"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Toggle } from "@/components/ui/toggle"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cn } from "@/lib/utils"
import { FONT_FAMILIES } from "../../overlays/kinds"
import type { BlurOverlay, ImageOverlay, Overlay, OverlayKind, TextOverlay } from "../../overlays/types"
import { SliderField } from "../panel-section"

export interface OverlayFormProps<T extends Overlay> {
  overlay: T
  onChange: (patch: Partial<T>, opts?: { transient?: boolean }) => void
  onCommit: () => void
}

const COLORS = ["#ffffff", "#000000", "#ef4444", "#f97316", "#facc15", "#22c55e", "#3b82f6", "#a855f7"]

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {COLORS.map((c) => (
        <button
          key={c}
          type="button"
          aria-label={c}
          className={cn(
            "size-6 rounded-full border border-white/20 ring-offset-2 ring-offset-background",
            value.toLowerCase() === c && "ring-2 ring-primary",
          )}
          style={{ background: c }}
          onClick={() => onChange(c)}
        />
      ))}
      <label
        className="relative size-6 cursor-pointer overflow-hidden rounded-full border border-white/20"
        style={{ background: "conic-gradient(red, yellow, lime, aqua, blue, magenta, red)" }}
        title="Couleur personnalisée"
      >
        <input
          type="color"
          className="absolute inset-0 cursor-pointer opacity-0"
          value={value.startsWith("#") && value.length === 7 ? value : "#ffffff"}
          onChange={(e) => onChange(e.target.value)}
        />
      </label>
    </div>
  )
}

function TextForm({ overlay, onChange, onCommit }: OverlayFormProps<TextOverlay>) {
  return (
    <>
      <div className="flex flex-col gap-2">
        <Label className="font-normal">Texte</Label>
        <Textarea
          value={overlay.text}
          rows={2}
          autoFocus
          onChange={(e) => onChange({ text: e.target.value }, { transient: true })}
          onBlur={onCommit}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label className="font-normal">Police</Label>
        <ToggleGroup
          value={[overlay.fontFamily]}
          onValueChange={(v) => v[0] && onChange({ fontFamily: v[0] as string })}
          variant="outline"
          size="sm"
          spacing={0}
          className="w-full"
        >
          {FONT_FAMILIES.map((f) => (
            <ToggleGroupItem key={f.id} value={f.id} className="flex-1" style={{ fontFamily: f.css }}>
              {f.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <div className="flex gap-2">
          <Toggle
            variant="outline"
            size="sm"
            pressed={overlay.bold}
            onPressedChange={(bold) => onChange({ bold })}
            aria-label="Gras"
          >
            <BoldIcon />
          </Toggle>
          <Toggle
            variant="outline"
            size="sm"
            pressed={overlay.italic}
            onPressedChange={(italic) => onChange({ italic })}
            aria-label="Italique"
          >
            <ItalicIcon />
          </Toggle>
          <ToggleGroup
            value={[overlay.align]}
            onValueChange={(v) => v[0] && onChange({ align: v[0] as CanvasTextAlign })}
            variant="outline"
            size="sm"
            spacing={0}
            className="ml-auto"
          >
            <ToggleGroupItem value="left" aria-label="Aligner à gauche">
              <AlignLeftIcon />
            </ToggleGroupItem>
            <ToggleGroupItem value="center" aria-label="Centrer">
              <AlignCenterIcon />
            </ToggleGroupItem>
            <ToggleGroupItem value="right" aria-label="Aligner à droite">
              <AlignRightIcon />
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      <SliderField
        label="Taille"
        value={overlay.size}
        min={1}
        max={40}
        step={0.5}
        onChange={(size) => onChange({ size }, { transient: true })}
        onCommit={onCommit}
      />

      <div className="flex flex-col gap-2">
        <Label className="font-normal">Couleur</Label>
        <ColorPicker value={overlay.color} onChange={(color) => onChange({ color })} />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label className="font-normal">Fond</Label>
          <Toggle
            variant="outline"
            size="sm"
            pressed={overlay.background !== null}
            onPressedChange={(on) => onChange({ background: on ? "#000000" : null })}
          >
            {overlay.background !== null ? "Activé" : "Aucun"}
          </Toggle>
        </div>
        {overlay.background !== null && (
          <ColorPicker value={overlay.background} onChange={(background) => onChange({ background })} />
        )}
      </div>

      <div className="flex items-center justify-between">
        <Label className="font-normal">Ombre portée</Label>
        <Toggle variant="outline" size="sm" pressed={overlay.shadow} onPressedChange={(shadow) => onChange({ shadow })}>
          {overlay.shadow ? "Activée" : "Aucune"}
        </Toggle>
      </div>
    </>
  )
}

function ImageForm({ overlay, onChange, onCommit }: OverlayFormProps<ImageOverlay>) {
  return (
    <>
      <div className="flex items-center gap-3 text-sm">
        <div className="size-10 shrink-0 overflow-hidden rounded-md border bg-muted">
          <ImageThumb bitmap={overlay.image} />
        </div>
        <span className="truncate text-muted-foreground">{overlay.name}</span>
      </div>
      <SliderField
        label="Largeur"
        unit="%"
        value={overlay.size}
        min={2}
        max={100}
        step={0.5}
        onChange={(size) => onChange({ size }, { transient: true })}
        onCommit={onCommit}
      />
    </>
  )
}

function ImageThumb({ bitmap }: { bitmap: ImageBitmap }) {
  return (
    <canvas
      className="size-full object-contain"
      ref={(c) => {
        if (!c) return
        c.width = 80
        c.height = 80
        const ctx = c.getContext("2d")!
        const s = Math.min(80 / bitmap.width, 80 / bitmap.height)
        const w = bitmap.width * s
        const h = bitmap.height * s
        ctx.clearRect(0, 0, 80, 80)
        ctx.drawImage(bitmap, (80 - w) / 2, (80 - h) / 2, w, h)
      }}
    />
  )
}

function BlurForm({ overlay, onChange, onCommit }: OverlayFormProps<BlurOverlay>) {
  return (
    <>
      <div className="flex flex-col gap-2">
        <Label className="font-normal">Effet</Label>
        <ToggleGroup
          value={[overlay.style]}
          onValueChange={(v) => v[0] && onChange({ style: v[0] as BlurOverlay["style"] })}
          variant="outline"
          size="sm"
          spacing={0}
          className="w-full"
        >
          <ToggleGroupItem value="blur" className="flex-1">
            Flou
          </ToggleGroupItem>
          <ToggleGroupItem value="pixelate" className="flex-1">
            Pixels
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      <div className="flex flex-col gap-2">
        <Label className="font-normal">Forme</Label>
        <ToggleGroup
          value={[overlay.shape]}
          onValueChange={(v) => v[0] && onChange({ shape: v[0] as BlurOverlay["shape"] })}
          variant="outline"
          size="sm"
          spacing={0}
          className="w-full"
        >
          <ToggleGroupItem value="ellipse" className="flex-1">
            <CircleIcon />
            Ellipse
          </ToggleGroupItem>
          <ToggleGroupItem value="rect" className="flex-1">
            <SquareIcon />
            Rectangle
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      <SliderField
        label="Intensité"
        value={overlay.strength}
        min={1}
        max={100}
        onChange={(strength) => onChange({ strength }, { transient: true })}
        onCommit={onCommit}
      />
      <SliderField
        label="Largeur"
        unit="%"
        value={overlay.size}
        min={1}
        max={100}
        step={0.5}
        onChange={(size) => onChange({ size }, { transient: true })}
        onCommit={onCommit}
      />
      <SliderField
        label="Hauteur"
        unit="%"
        value={overlay.heightPct}
        min={1}
        max={100}
        step={0.5}
        onChange={(heightPct) => onChange({ heightPct }, { transient: true })}
        onCommit={onCommit}
      />
    </>
  )
}

/** Kind-specific settings form. Add a kind = add a form here. */
export const OVERLAY_FORMS: { [K in OverlayKind]: ComponentType<OverlayFormProps<Extract<Overlay, { kind: K }>>> } = {
  text: TextForm,
  image: ImageForm,
  blur: BlurForm,
}

export const OVERLAY_LABELS: { [K in OverlayKind]: (o: Extract<Overlay, { kind: K }>) => string } = {
  text: (o) => o.text.split("\n")[0] || "Texte",
  image: (o) => o.name,
  blur: (o) => (o.style === "pixelate" ? "Pixellisation" : "Flou"),
}

/** Icon (layer list, "Ajouter" buttons) and title of the settings section. */
export const OVERLAY_META: { [K in OverlayKind]: { icon: LucideIcon; title: string } } = {
  text: { icon: TypeIcon, title: "Texte sélectionné" },
  image: { icon: ImageIcon, title: "Image sélectionnée" },
  blur: { icon: ScanFaceIcon, title: "Flou sélectionné" },
}
