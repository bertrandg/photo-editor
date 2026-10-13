import type { LucideIcon } from "lucide-react"
import { CropIcon, PencilIcon, SlidersHorizontalIcon } from "lucide-react"
import type { ComponentType } from "react"
import { DEFAULT_ADJUSTMENTS } from "../adjustments"
import { FULL_CROP } from "../render/geometry"
import { IDENTITY_TRANSFORM } from "../render/transform"
import type { EditorState } from "../types"
import { AdjustPanel } from "./adjust/adjust-panel"
import { AnnotatePanel } from "./annotate/annotate-panel"
import { CropPanel } from "./crop/crop-panel"

/**
 * A tool = one tab of the left sidebar.
 * To add a tool, create its panel component and register it here.
 */
export interface EditorTool {
  id: string
  label: string
  icon: LucideIcon
  Panel: ComponentType
  /** "crop" shows the full image with a crop frame, "result" the final render. */
  stage: "crop" | "result"
  /** Overlays can be selected/moved on the image while this tool is active. */
  interactiveOverlays?: boolean
  /** Restores the part of the state owned by the tool ("Réinitialiser tout"). */
  reset?: (state: EditorState) => EditorState
}

export const TOOLS: EditorTool[] = [
  {
    id: "crop",
    label: "Recadrer",
    icon: CropIcon,
    Panel: CropPanel,
    stage: "crop",
    reset: (s) => ({ ...s, transform: IDENTITY_TRANSFORM, crop: FULL_CROP, cropAspect: undefined, cropPreset: "free" }),
  },
  {
    id: "adjust",
    label: "Ajuster",
    icon: SlidersHorizontalIcon,
    Panel: AdjustPanel,
    stage: "result",
    reset: (s) => ({ ...s, adjustments: DEFAULT_ADJUSTMENTS }),
  },
  {
    id: "annotate",
    label: "Annoter",
    icon: PencilIcon,
    Panel: AnnotatePanel,
    stage: "result",
    interactiveOverlays: true,
    reset: (s) => ({ ...s, overlays: [] }),
  },
]

export const DEFAULT_TOOL = "adjust"

export function getTool(id: string) {
  return TOOLS.find((t) => t.id === id) ?? TOOLS[0]
}
