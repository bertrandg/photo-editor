/**
 * The "look" of the photo: the selected filter followed by the adjustments.
 *
 * Both are turned into an ordered list of stages, consumed by:
 *  - the GPU preview (render/gpu-preview.ts), via the `gpu` GLSL snippets
 *  - the CPU fallback and the export worker, via `process`
 *
 * Must stay free of DOM/React imports: it is loaded by the export Web Worker.
 */
import { ADJUSTMENTS } from "./adjustments"
import { getFilter } from "./filters"

export interface FilterState {
  /** `null` = no filter. */
  id: string | null
  /** 0–100 */
  intensity: number
}

export interface Look {
  adjustments: Record<string, number>
  filter: FilterState
}

/**
 * Maps the processed buffer to the output frame (the cropped image), so that
 * position-dependent effects (vignette) land at the same place in the preview
 * (uncropped image) and in the export (processed in horizontal strips).
 * Buffer pixel (x, y) is at frame position ((x + offsetX) / frameW, (y + offsetY) / frameH).
 */
export interface PixelRegion {
  offsetX: number
  offsetY: number
  frameW: number
  frameH: number
}

export type StageProcess = (
  data: Uint8ClampedArray,
  width: number,
  height: number,
  value: number,
  scale: number,
  region: PixelRegion,
) => void

export interface GpuSnippet {
  kind: "pixel" | "kernel"
  /**
   * Updates `vec3 c` (RGB 0–1). Can read `float v` (the stage value),
   * `float scale`, `vec2 p` (position in the output frame, 0–1) and, for
   * kernels, `src(vec2 offsetInPixels)`.
   */
  glsl: string
}

export interface Stage {
  /** Unique, used for the GLSL uniform name and the shader cache. */
  key: string
  value: number
  gpu?: GpuSnippet
  process: StageProcess
}

export function activeStages(look: Look): Stage[] {
  const stages: Stage[] = []
  const filter = look.filter.id && look.filter.intensity > 0 ? getFilter(look.filter.id) : undefined
  if (filter) {
    stages.push({ key: `filter_${filter.id}`, value: look.filter.intensity / 100, gpu: filter.gpu, process: filter.process })
  }
  for (const adj of ADJUSTMENTS) {
    const value = look.adjustments[adj.id] ?? adj.default
    if (value !== adj.default) stages.push({ key: adj.id, value, gpu: adj.gpu, process: adj.process })
  }
  return stages
}

export function hasActiveLook(look: Look) {
  return activeStages(look).length > 0
}

/** CPU implementation of the whole look (export, fallback, thumbnails). */
export function applyLook(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  look: Look,
  scale = 1,
  region: PixelRegion = { offsetX: 0, offsetY: 0, frameW: width, frameH: height },
) {
  for (const stage of activeStages(look)) stage.process(data, width, height, stage.value, scale, region)
}
