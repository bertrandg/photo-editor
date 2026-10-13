import { createContext, useContext, useMemo, useState, type ReactNode } from "react"
import { DEFAULT_ADJUSTMENTS } from "./adjustments"
import { FULL_CROP } from "./render/geometry"
import type { FilterState } from "./pipeline"
import { IDENTITY_TRANSFORM, renderTransformed } from "./render/transform"
import type { EditorState, LoadedImage } from "./types"
import { useHistory } from "./use-history"

export const NO_FILTER: FilterState = { id: null, intensity: 100 }

export const INITIAL_STATE: EditorState = {
  transform: IDENTITY_TRANSFORM,
  crop: FULL_CROP,
  cropAspect: undefined,
  cropPreset: "free",
  adjustments: DEFAULT_ADJUSTMENTS,
  filter: NO_FILTER,
  overlays: [],
}

type History = ReturnType<typeof useHistory<EditorState>>

interface EditorContextValue extends Omit<History, "set"> {
  image: LoadedImage
  /** Downscaled preview with the geometry (rotation, mirror…) applied. */
  orientedPreview: HTMLCanvasElement
  setState: History["set"]
  activeTool: string
  setActiveTool: (id: string) => void
  selectedOverlayId: string | null
  setSelectedOverlayId: (id: string | null) => void
  showOriginal: boolean
  setShowOriginal: (v: boolean) => void
  /** Displays a dense alignment grid over the image (while straightening). */
  showGrid: boolean
  setShowGrid: (v: boolean) => void
}

const EditorContext = createContext<EditorContextValue | null>(null)

export function EditorProvider({
  image,
  initialTool,
  children,
}: {
  image: LoadedImage
  initialTool: string
  children: ReactNode
}) {
  const { set, ...history } = useHistory<EditorState>(INITIAL_STATE)
  const [activeTool, setActiveTool] = useState(initialTool)
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(null)
  const [showOriginal, setShowOriginal] = useState(false)
  const [showGrid, setShowGrid] = useState(false)
  const { transform } = history.state
  const orientedPreview = useMemo(
    () => renderTransformed(image.preview, image.preview.width, image.preview.height, transform),
    [image.preview, transform],
  )

  const value: EditorContextValue = {
    ...history,
    image,
    orientedPreview,
    setState: set,
    activeTool,
    setActiveTool,
    selectedOverlayId,
    setSelectedOverlayId,
    showOriginal,
    setShowOriginal,
    showGrid,
    setShowGrid,
  }

  return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>
}

export function useEditor() {
  const ctx = useContext(EditorContext)
  if (!ctx) throw new Error("useEditor must be used inside <EditorProvider>")
  return ctx
}
