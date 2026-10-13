import type { BlurOverlay, ImageOverlay, Overlay, OverlayKind, TextOverlay } from "./types"

/** Rendering contract for an overlay kind. Add a kind = add an entry here. */
interface OverlayRenderer<T extends Overlay> {
  /** Size in pixels of the overlay for an output of `outW` × `outH`. */
  measure: (ctx: CanvasRenderingContext2D, overlay: T, outW: number, outH: number) => { width: number; height: number }
  /**
   * Draws the overlay inside the box (top-left at `x`, `y`). `ctx` already
   * holds the image and the overlays below, which a renderer may read back.
   */
  draw: (ctx: CanvasRenderingContext2D, overlay: T, box: Box, outW: number) => void
  /** "free": the resize handle changes width and height independently. */
  resize?: "uniform" | "free"
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

/** Scratch canvases reused between frames (blur runs on every redraw). */
const scratch: HTMLCanvasElement[] = []
function scratchCtx(i: number, width: number, height: number) {
  const c = (scratch[i] ??= document.createElement("canvas"))
  if (c.width !== width || c.height !== height) {
    c.width = width
    c.height = height
  }
  const ctx = c.getContext("2d")!
  ctx.clearRect(0, 0, width, height)
  return ctx
}

const blurRenderer: OverlayRenderer<BlurOverlay> = {
  resize: "free",
  measure(_ctx, o, outW, outH) {
    return { width: (o.size / 100) * outW, height: (o.heightPct / 100) * outH }
  },
  draw(ctx, o, box, outW) {
    const canvas = ctx.canvas
    const x0 = Math.max(0, Math.floor(box.x))
    const y0 = Math.max(0, Math.floor(box.y))
    const x1 = Math.min(canvas.width, Math.ceil(box.x + box.width))
    const y1 = Math.min(canvas.height, Math.ceil(box.y + box.height))
    if (x1 - x0 < 1 || y1 - y0 < 1) return

    // Strength is relative to the output width: same look in preview & export.
    const radius = Math.max(1.5, (o.strength / 100) * 0.04 * outW)

    // Clip to the shape (in the overlay box, not the clamped area).
    ctx.beginPath()
    if (o.shape === "ellipse") {
      ctx.ellipse(box.x + box.width / 2, box.y + box.height / 2, box.width / 2, box.height / 2, 0, 0, Math.PI * 2)
    } else {
      ctx.rect(box.x, box.y, box.width, box.height)
    }
    ctx.clip()

    if (o.style === "pixelate") {
      // Each block = average of ~radius × radius pixels, nearest-neighbor upscale.
      const w = x1 - x0
      const h = y1 - y0
      const tw = Math.max(1, Math.round(w / radius))
      const th = Math.max(1, Math.round(h / radius))
      const small = scratchCtx(0, tw, th)
      small.imageSmoothingQuality = "high"
      small.drawImage(canvas, x0, y0, w, h, 0, 0, tw, th)
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(small.canvas, 0, 0, tw, th, x0, y0, w, h)
      return
    }

    // Pyramid blur: halve the area repeatedly (last step to exactly 1/radius),
    // then double it back step by step. Each bilinear step smooths the
    // previous one: close to a gaussian, no blocks, and only a few cheap
    // drawImage calls. Neighbors around the box are sampled too, so the edges
    // blend with the surroundings.
    const pad = Math.ceil(radius * 2)
    const sx = Math.max(0, x0 - pad)
    const sy = Math.max(0, y0 - pad)
    const sw = Math.min(canvas.width, x1 + pad) - sx
    const sh = Math.min(canvas.height, y1 + pad) - sy

    const sizes: [number, number][] = []
    for (let f = 2; f < radius; f *= 2) sizes.push([Math.max(1, Math.round(sw / f)), Math.max(1, Math.round(sh / f))])
    sizes.push([Math.max(1, Math.round(sw / radius)), Math.max(1, Math.round(sh / radius))])

    // Down.
    sizes.forEach(([w, h], i) => {
      const c = scratchCtx(i, w, h)
      c.imageSmoothingQuality = "high"
      if (i === 0) c.drawImage(canvas, sx, sy, sw, sh, 0, 0, w, h)
      else c.drawImage(scratch[i - 1], 0, 0, sizes[i - 1][0], sizes[i - 1][1], 0, 0, w, h)
    })
    // Up (back through the same sizes), then onto the image.
    for (let i = sizes.length - 2; i >= 0; i--) {
      const [w, h] = sizes[i]
      const c = scratchCtx(i, w, h)
      c.imageSmoothingQuality = "high"
      c.drawImage(scratch[i + 1], 0, 0, sizes[i + 1][0], sizes[i + 1][1], 0, 0, w, h)
    }
    ctx.imageSmoothingQuality = "high"
    ctx.drawImage(scratch[0], 0, 0, sizes[0][0], sizes[0][1], sx, sy, sw, sh)
  },
}

const RENDERERS: { [K in OverlayKind]: OverlayRenderer<Extract<Overlay, { kind: K }>> } = {
  text: textRenderer,
  image: imageRenderer,
  blur: blurRenderer,
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
  const { width, height } = rendererFor(o).measure(ctx, o, outW, outH)
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

export function overlayResizeMode(o: Overlay) {
  return rendererFor(o).resize ?? "uniform"
}
