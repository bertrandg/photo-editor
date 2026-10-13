/**
 * Filter registry ("looks" applied in one click, one at a time).
 *
 * A filter is a recipe of simple color operations. Each operation is written
 * once for the GPU (GLSL) and once for the CPU, so the live preview and the
 * export always match. To add a filter, append an entry to `FILTERS` using
 * the operations below; to add an operation, implement both sides.
 *
 * Must stay free of DOM/React imports: it is loaded by the export Web Worker.
 */
import type { GpuSnippet, StageProcess } from "./pipeline"

type Rgb = [number, number, number]

interface Op {
  glsl: string
  /** Mutates `c` (RGB 0–1); `px`, `py` = position in the output frame (0–1). */
  cpu: (c: Float64Array, px: number, py: number) => void
}

const n = (x: number) => x.toFixed(6)
const vec3 = ([r, g, b]: Rgb) => `vec3(${n(r)}, ${n(g)}, ${n(b)})`
const LUMA: Rgb = [0.299, 0.587, 0.114]
const luma = (c: Float64Array) => c[0] * LUMA[0] + c[1] * LUMA[1] + c[2] * LUMA[2]

/* ------------------------------ Operations ------------------------------ */

/** 3×4 color matrix: each row = [r, g, b, offset] for one output channel. */
function matrix(rows: [number, number, number, number][]): Op {
  const [R, G, B] = rows
  const row = (m: number[]) => `dot(c, ${vec3([m[0], m[1], m[2]])}) + ${n(m[3])}`
  return {
    glsl: `c = vec3(${row(R)}, ${row(G)}, ${row(B)});`,
    cpu(c) {
      const r = c[0], g = c[1], b = c[2]
      c[0] = R[0] * r + R[1] * g + R[2] * b + R[3]
      c[1] = G[0] * r + G[1] * g + G[2] * b + G[3]
      c[2] = B[0] * r + B[1] * g + B[2] * b + B[3]
    },
  }
}

const grayscale = (): Op => matrix([[...LUMA, 0], [...LUMA, 0], [...LUMA, 0]])

/** Multiplies the saturation (1 = unchanged). */
function saturation(s: number): Op {
  return {
    glsl: `{ float l = dot(c, ${vec3(LUMA)}); c = l + (c - l) * ${n(s)}; }`,
    cpu(c) {
      const l = luma(c)
      for (let k = 0; k < 3; k++) c[k] = l + (c[k] - l) * s
    },
  }
}

/** Multiplies the contrast around mid-gray (1 = unchanged). */
function contrast(k: number): Op {
  return {
    glsl: `c = (c - 0.5) * ${n(k)} + 0.5;`,
    cpu(c) {
      for (let i = 0; i < 3; i++) c[i] = (c[i] - 0.5) * k + 0.5
    },
  }
}

/** Lifts the blacks (matte / faded film look). */
function fade(f: number): Op {
  return {
    glsl: `c = ${n(f)} + c * ${n(1 - f)};`,
    cpu(c) {
      for (let i = 0; i < 3; i++) c[i] = f + c[i] * (1 - f)
    },
  }
}

/** Split toning: color offsets added to the shadows and to the highlights. */
function tint(shadows: Rgb, highlights: Rgb): Op {
  return {
    glsl: `{ float l = dot(c, ${vec3(LUMA)}); c += ${vec3(shadows)} * (1.0 - l) + ${vec3(highlights)} * l; }`,
    cpu(c) {
      const l = luma(c)
      for (let i = 0; i < 3; i++) c[i] += shadows[i] * (1 - l) + highlights[i] * l
    },
  }
}

/** Darkens the corners of the output frame. */
function vignette(amount: number): Op {
  const smoothstep = (e0: number, e1: number, x: number) => {
    const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)
  }
  return {
    glsl: `c *= 1.0 - ${n(amount)} * smoothstep(0.4, 1.0, length((p - 0.5) * 1.414214));`,
    cpu(c, px, py) {
      const d = Math.hypot(px - 0.5, py - 0.5) * 1.414214
      const f = 1 - amount * smoothstep(0.4, 1.0, d)
      for (let i = 0; i < 3; i++) c[i] *= f
    },
  }
}

/* -------------------------------- Filters ------------------------------- */

interface FilterRecipe {
  id: string
  label: string
  ops: Op[]
}

export interface FilterDef extends FilterRecipe {
  gpu: GpuSnippet
  process: StageProcess
}

const RECIPES: FilterRecipe[] = [
  { id: "bw", label: "N&B", ops: [grayscale(), contrast(1.1)] },
  {
    id: "sepia",
    label: "Sépia",
    ops: [matrix([[0.393, 0.769, 0.189, 0], [0.349, 0.686, 0.168, 0], [0.272, 0.534, 0.131, 0]])],
  },
  {
    id: "vintage",
    label: "Vintage",
    ops: [
      saturation(0.75),
      matrix([[1.05, 0, 0, 0.02], [0, 1, 0, 0.01], [0, 0, 0.88, 0.02]]),
      tint([0.05, 0.02, -0.02], [0.03, 0.02, -0.04]),
      fade(0.08),
      vignette(0.35),
    ],
  },
  { id: "lomo", label: "Lomo", ops: [contrast(1.35), saturation(1.3), vignette(0.65)] },
  {
    id: "cool",
    label: "Froid",
    ops: [matrix([[0.92, 0, 0, 0], [0, 1, 0, 0.01], [0, 0, 1.08, 0.03]]), tint([-0.02, 0.01, 0.05], [0, 0, 0.02]), saturation(0.9)],
  },
  {
    id: "golden",
    label: "Doré",
    ops: [matrix([[1.08, 0, 0, 0.02], [0, 1.02, 0, 0.01], [0, 0, 0.85, 0]]), tint([0.02, 0.01, -0.02], [0.05, 0.03, -0.03]), contrast(1.05)],
  },
  { id: "faded", label: "Délavé", ops: [contrast(0.85), saturation(0.8), fade(0.15)] },
  {
    id: "cinema",
    label: "Cinéma",
    ops: [tint([-0.06, 0.02, 0.07], [0.08, 0.03, -0.06]), contrast(1.15), saturation(1.05), vignette(0.25)],
  },
  { id: "noir", label: "Noir", ops: [grayscale(), contrast(1.5), vignette(0.5)] },
  {
    id: "polaroid",
    label: "Polaroid",
    ops: [
      matrix([[1.438, -0.062, -0.062, -0.03], [-0.122, 1.378, -0.122, 0.05], [-0.016, -0.016, 1.483, -0.02]]),
      fade(0.05),
    ],
  },
  {
    id: "kodachrome",
    label: "Kodachrome",
    ops: [
      matrix([
        [1.12856, -0.39674, -0.03993, 0.24992],
        [-0.16404, 1.08353, -0.05499, 0.09699],
        [-0.16786, -0.56034, 1.60149, 0.13972],
      ]),
    ],
  },
]

/** Compiles a recipe for both backends. The result is blended with the
 * original by the stage value (intensity, 0–1). */
function compile(recipe: FilterRecipe): FilterDef {
  const clamp = "c = clamp(c, 0.0, 1.0);"
  const glsl = `vec3 o = c;\n${recipe.ops.map((op) => `${op.glsl} ${clamp}`).join("\n")}\nc = mix(o, c, v);`

  const process: StageProcess = (data, width, height, value, _scale, region) => {
    const c = new Float64Array(3)
    const ops = recipe.ops
    for (let y = 0; y < height; y++) {
      const py = (y + region.offsetY + 0.5) / region.frameH
      for (let x = 0; x < width; x++) {
        const px = (x + region.offsetX + 0.5) / region.frameW
        const i = (y * width + x) * 4
        const r = data[i] / 255, g = data[i + 1] / 255, b = data[i + 2] / 255
        c[0] = r
        c[1] = g
        c[2] = b
        for (const op of ops) {
          op.cpu(c, px, py)
          c[0] = Math.min(1, Math.max(0, c[0]))
          c[1] = Math.min(1, Math.max(0, c[1]))
          c[2] = Math.min(1, Math.max(0, c[2]))
        }
        data[i] = (r + (c[0] - r) * value) * 255
        data[i + 1] = (g + (c[1] - g) * value) * 255
        data[i + 2] = (b + (c[2] - b) * value) * 255
      }
    }
  }

  return { ...recipe, gpu: { kind: "pixel", glsl }, process }
}

export const FILTERS: FilterDef[] = RECIPES.map(compile)

export function getFilter(id: string) {
  return FILTERS.find((f) => f.id === id)
}
