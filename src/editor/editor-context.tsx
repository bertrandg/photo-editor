import { createContext, useContext, useState, type ReactNode } from "react"
import { DEFAULT_ADJUSTMENTS } from "./adjustments"
import { FULL_CROP } from "./render/geometry"
import type { EditorState, LoadedImage } from "./types"
import { useHistory } from "./use-history"

export const INITIAL_STATE: EditorState = {
  crop: FULL_CROP,
  cropAspect: undefined,
  cropPreset: "free",
  adjustments: DEFAULT_ADJUSTMENTS,
  overlays: [],
}

type History = ReturnType<typeof useHistory<EditorState>>

interface EditorContextValue extends Omit<History, "set"> {
  image: LoadedImage
  setState: History["set"]
  activeTool: string
  setActiveTool: (id: string) => void
  selectedOverlayId: string | null
  setSelectedOverlayId: (id: string | null) => void
  showOriginal: boolean
  setShowOriginal: (v: boolean) => void
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

  const value: EditorContextValue = {
    ...history,
    image,
    setState: set,
    activeTool,
    setActiveTool,
    selectedOverlayId,
    setSelectedOverlayId,
    showOriginal,
    setShowOriginal,
  }

  return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>
}

export function useEditor() {
  const ctx = useContext(EditorContext)
  if (!ctx) throw new Error("useEditor must be used inside <EditorProvider>")
  return ctx
}
