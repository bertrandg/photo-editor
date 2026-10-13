/**
 * Adjustment registry.
 *
 * Each adjustment is a self-contained module: UI metadata + a pixel processor.
 * To add a new adjustment, append an entry to `ADJUSTMENTS` — the panel, the
 * preview and the export pick it up automatically. `process` (CPU) is used for
 * the export; `gpu` (GLSL) makes the live preview fast and must match it.
 *
 * This file must stay free of DOM/React imports: it is also loaded by the
 * export Web Worker.
 */

export interface AdjustmentGroup {
  id: string
  label: string
}

export interface AdjustmentDef {
  id: string
  label: string
  group: string
  min: number
  max: number
  default: number
  /** Optional CSS background for the slider track. */
  trackGradient?: string
  /**
   * Mutates RGBA pixels in place. `width`/`height` are the buffer dimensions,
   * `scale` is the ratio between the processed image and the full resolution
   * (lets kernel-based effects stay consistent between preview and export).
   */
  process: (data: Uint8ClampedArray, width: number, height: number, value: number, scale: number) => void
  /**
   * GLSL equivalent of `process` for the live preview (render/gpu-preview.ts).
   * The snippet updates `vec3 c` (RGB, 0–1) and can read `float v` (the
   * value) and `float scale`. A `kernel` snippet can also call `src(vec2 o)`:
   * the color of the pixel at offset `o` (in pixels) with all the previous
   * adjustments applied. Without `gpu`, the preview falls back to the CPU.
   */
  gpu?: { kind: "pixel" | "kernel"; glsl: string }
}

export const ADJUSTMENT_GROUPS: AdjustmentGroup[] = [
  { id: "light", label: "Lumière" },
  { id: "color", label: "Couleur" },
  { id: "detail", label: "Détail" },
]

function applyLut(data: Uint8ClampedArray, r: Uint8ClampedArray, g: Uint8ClampedArray, b: Uint8ClampedArray) {
  for (let i = 0; i < data.length; i += 4) {
    data[i] = r[data[i]]
    data[i + 1] = g[data[i + 1]]
    data[i + 2] = b[data[i + 2]]
  }
}

function buildLut(fn: (v: number) => number) {
  const lut = new Uint8ClampedArray(256)
  for (let v = 0; v < 256; v++) lut[v] = fn(v)
  return lut
}

export const ADJUSTMENTS: AdjustmentDef[] = [
  {
    id: "contrast",
    label: "Contraste",
    group: "light",
    min: -100,
    max: 100,
    default: 0,
    process(data, _w, _h, value) {
      const c = value * 1.28
      const f = (259 * (c + 255)) / (255 * (259 - c))
      const lut = buildLut((v) => f * (v - 128) + 128)
      applyLut(data, lut, lut, lut)
    },
    gpu: {
      kind: "pixel",
      glsl: `float k = v * 1.28;
        float f = (259.0 * (k + 255.0)) / (255.0 * (259.0 - k));
        c = f * (c - 128.0 / 255.0) + 128.0 / 255.0;`,
    },
  },
  {
    id: "brightness",
    label: "Luminosité",
    group: "light",
    min: -100,
    max: 100,
    default: 0,
    process(data, _w, _h, value) {
      // Gamma-like curve: keeps blacks/whites instead of washing them out.
      const gamma = Math.pow(2, -value / 70)
      const lut = buildLut((v) => 255 * Math.pow(v / 255, gamma))
      applyLut(data, lut, lut, lut)
    },
    gpu: { kind: "pixel", glsl: `c = pow(max(c, vec3(1e-6)), vec3(pow(2.0, -v / 70.0)));` },
  },
  {
    id: "saturation",
    label: "Saturation",
    group: "color",
    min: -100,
    max: 100,
    default: 0,
    trackGradient: "linear-gradient(to right, #6b7280, #9ca3af 50%, #ef4444)",
    process(data, _w, _h, value) {
      const k = 1 + value / 100
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2]
        const gray = 0.299 * r + 0.587 * g + 0.114 * b
        data[i] = gray + (r - gray) * k
        data[i + 1] = gray + (g - gray) * k
        data[i + 2] = gray + (b - gray) * k
      }
    },
    gpu: {
      kind: "pixel",
      glsl: `float gray = dot(c, vec3(0.299, 0.587, 0.114));
        c = gray + (c - gray) * (1.0 + v / 100.0);`,
    },
  },
  {
    id: "warmth",
    label: "Chaleur",
    group: "color",
    min: -100,
    max: 100,
    default: 0,
    trackGradient: "linear-gradient(to right, #3b82f6, #6b7280 50%, #eab308)",
    process(data, _w, _h, value) {
      const t = value * 0.35
      const r = buildLut((v) => v + t)
      const g = buildLut((v) => v + t * 0.15)
      const b = buildLut((v) => v - t)
      applyLut(data, r, g, b)
    },
    gpu: {
      kind: "pixel",
      glsl: `float t = v * 0.35 / 255.0;
        c += vec3(t, t * 0.15, -t);`,
    },
  },
  {
    id: "sharpness",
    label: "Netteté",
    group: "detail",
    min: 0,
    max: 100,
    default: 0,
    process(data, width, height, value, scale) {
      // 3x3 unsharp mask. On a downscaled preview the effect is attenuated a
      // little less, so it stays visible.
      const amount = (value / 100) * 1.2 * Math.min(1, 0.5 + scale / 2)
      const src = new Uint8ClampedArray(data)
      const row = width * 4
      for (let y = 0; y < height; y++) {
        const up = y > 0 ? -row : 0
        const down = y < height - 1 ? row : 0
        for (let x = 0; x < width; x++) {
          const i = y * row + x * 4
          const left = x > 0 ? -4 : 0
          const right = x < width - 1 ? 4 : 0
          for (let c = 0; c < 3; c++) {
            const p = i + c
            const center = src[p]
            const neighbors = src[p + up] + src[p + down] + src[p + left] + src[p + right]
            data[p] = center + amount * (4 * center - neighbors)
          }
        }
      }
    },
    gpu: {
      kind: "kernel",
      glsl: `float a = v / 100.0 * 1.2 * min(1.0, 0.5 + scale / 2.0);
        c += a * (4.0 * c - src(vec2(1.0, 0.0)) - src(vec2(-1.0, 0.0)) - src(vec2(0.0, 1.0)) - src(vec2(0.0, -1.0)));`,
    },
  },
]

export const DEFAULT_ADJUSTMENTS: Record<string, number> = Object.fromEntries(
  ADJUSTMENTS.map((a) => [a.id, a.default]),
)

export function hasActiveAdjustments(values: Record<string, number>) {
  return ADJUSTMENTS.some((a) => (values[a.id] ?? a.default) !== a.default)
}

/** Runs every non-neutral adjustment, in registry order. */
export function applyAdjustments(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  values: Record<string, number>,
  scale = 1,
) {
  for (const adj of ADJUSTMENTS) {
    const value = values[adj.id] ?? adj.default
    if (value !== adj.default) adj.process(data, width, height, value, scale)
  }
}
