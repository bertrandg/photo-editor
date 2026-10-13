import type { ImageOverlay, Overlay, OverlayKind, TextOverlay } from "./types"

/** Rendering contract for an overlay kind. Add a kind = add an entry here. */
interface OverlayRenderer<T extends Overlay> {
  /** Size in pixels of the overlay for an output of width `outW`. */
  measure: (ctx: CanvasRenderingContext2D, overlay: T, outW: number) => { width: number; height: number }
  /** Draws the overlay inside the box (top-left at `x`, `y`). */
  draw: (ctx: CanvasRenderingContext2D, overlay: T, box: Box, outW: number) => void
}

export interface Box {
  x: number
  y: number
  width: number
  height: number
}

export const FONT_FAMILIES = [
  { id: "sans", label: "Sans", css: "'Geist Variable', system-ui, sans-serif" },
  { id: "serif", label: "Serif", css: "Georgia, 'Times New Roman', serif" },
  { id: "mono", label: "Mono", css: "ui-monospace, Menlo, monospace" },
  { id: "display", label: "Impact", css: "Impact, 'Arial Black', sans-serif" },
] as const

const LINE_HEIGHT = 1.2
const TEXT_PADDING = 0.3 // in em, used when a background is set

function fontFor(o: TextOverlay, outW: number) {
  const px = Math.max(1, (o.size / 100) * outW)
  const family = FONT_FAMILIES.find((f) => f.id === o.fontFamily)?.css ?? FONT_FAMILIES[0].css
  return { px, font: `${o.italic ? "italic " : ""}${o.bold ? 700 : 400} ${px}px ${family}` }
}

const textRenderer: OverlayRenderer<TextOverlay> = {
  measure(ctx, o, outW) {
    const { px, font } = fontFor(o, outW)
    ctx.font = font
    const lines = o.text.split("\n")
    const width = Math.max(px * 0.5, ...lines.map((l) => ctx.measureText(l).width))
    const pad = o.background ? px * TEXT_PADDING * 2 : 0
    return { width: width + pad, height: lines.length * px * LINE_HEIGHT + pad }
  },
  draw(ctx, o, box, outW) {
    const { px, font } = fontFor(o, outW)
    const pad = o.background ? px * TEXT_PADDING : 0
    if (o.background) {
      ctx.fillStyle = o.background
      const r = px * 0.2
      ctx.beginPath()
      ctx.roundRect(box.x, box.y, box.width, box.height, r)
      ctx.fill()
    }
    ctx.font = font
    ctx.fillStyle = o.color
    ctx.textBaseline = "middle"
    ctx.textAlign = o.align
    if (o.shadow) {
      ctx.shadowColor = "rgba(0,0,0,0.55)"
      ctx.shadowBlur = px * 0.15
      ctx.shadowOffsetY = px * 0.05
    }
    const innerX = box.x + pad
    const innerW = box.width - pad * 2
    const x = o.align === "center" ? innerX + innerW / 2 : o.align === "right" ? innerX + innerW : innerX
    o.text.split("\n").forEach((line, i) => {
      ctx.fillText(line, x, box.y + pad + (i + 0.5) * px * LINE_HEIGHT)
    })
  },
}

const imageRenderer: OverlayRenderer<ImageOverlay> = {
  measure(_ctx, o, outW) {
    const width = (o.size / 100) * outW
    return { width, height: (width * o.image.height) / o.image.width }
  },
  draw(ctx, o, box) {
    ctx.imageSmoothingQuality = "high"
    ctx.drawImage(o.image, box.x, box.y, box.width, box.height)
  },
}

const RENDERERS: { [K in OverlayKind]: OverlayRenderer<Extract<Overlay, { kind: K }>> } = {
  text: textRenderer,
  image: imageRenderer,
}

function rendererFor<T extends Overlay>(o: T) {
  return RENDERERS[o.kind] as unknown as OverlayRenderer<T>
}

let measureCtx: CanvasRenderingContext2D | null = null
function getMeasureCtx() {
  measureCtx ??= document.createElement("canvas").getContext("2d")!
  return measureCtx
}

/** Bounding box of an overlay, in pixels, for an output of `outW` × `outH`. */
export function getOverlayBox(o: Overlay, outW: number, outH: number, ctx = getMeasureCtx()): Box {
  ctx.save()
  const { width, height } = rendererFor(o).measure(ctx, o, outW)
  ctx.restore()
  return { x: o.x * outW - width / 2, y: o.y * outH - height / 2, width, height }
}

export function drawOverlays(ctx: CanvasRenderingContext2D, overlays: Overlay[], outW: number, outH: number) {
  for (const o of overlays) {
    const box = getOverlayBox(o, outW, outH, ctx)
    ctx.save()
    ctx.globalAlpha = o.opacity
    rendererFor(o).draw(ctx, o, box, outW)
    ctx.restore()
  }
}
