/**
 * Overlays are positioned relative to the cropped output so they stay put
 * whatever the export resolution:
 *  - `x`, `y`: center of the overlay, in fraction (0–1) of the output size
 *  - `size`: a percentage of the output width (meaning depends on the kind)
 */
interface OverlayBase {
  id: string
  x: number
  y: number
  size: number
  opacity: number
}

export interface TextOverlay extends OverlayBase {
  kind: "text"
  text: string
  color: string
  fontFamily: string
  bold: boolean
  italic: boolean
  align: CanvasTextAlign
  /** Background box color, or `null` for none. */
  background: string | null
  shadow: boolean
}

export interface ImageOverlay extends OverlayBase {
  kind: "image"
  image: ImageBitmap
  name: string
}

/**
 * Blurs (or pixelates) what is under it: face, license plate…
 * `size` = width in % of the output width, `heightPct` = height in % of the
 * output height (free resizing, unlike text and images).
 */
export interface BlurOverlay extends OverlayBase {
  kind: "blur"
  heightPct: number
  style: "blur" | "pixelate"
  shape: "rect" | "ellipse"
  /** 1–100 */
  strength: number
}

export type Overlay = TextOverlay | ImageOverlay | BlurOverlay
export type OverlayKind = Overlay["kind"]
