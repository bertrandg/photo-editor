import type { Overlay } from "./overlays/types"

/** Crop rectangle expressed in percent (0–100) of the source image. */
export interface CropRect {
  x: number
  y: number
  width: number
  height: number
}

/** Image loaded in the editor. */
export interface LoadedImage {
  /** Full resolution bitmap, used for export. */
  full: ImageBitmap
  /** Downscaled copy, used for the interactive preview. */
  preview: HTMLCanvasElement
  width: number
  height: number
  /** Base file name (without extension) used for the download. */
  name: string
}

/** Everything that is part of the undo/redo history. */
export interface EditorState {
  crop: CropRect
  /** `undefined` means free cropping. */
  cropAspect: number | undefined
  /** Identifier of the selected ratio preset (for the UI). */
  cropPreset: string
  adjustments: Record<string, number>
  overlays: Overlay[]
}
