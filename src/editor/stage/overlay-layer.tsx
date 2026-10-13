import { useRef, type PointerEvent as ReactPointerEvent } from "react"
import { cn } from "@/lib/utils"
import { useEditor } from "../editor-context"
import { getOverlayBox, overlayResizeMode } from "../overlays/kinds"
import type { Overlay } from "../overlays/types"

interface Props {
  width: number
  height: number
}

type Gesture =
  | { kind: "move"; id: string; startX: number; startY: number; ox: number; oy: number }
  | { kind: "resize"; id: string; cx: number; cy: number; startDist: number; startSize: number }
  /** Independent width / height (blur areas): the handle follows the pointer. */
  | { kind: "resize-free"; id: string; cx: number; cy: number }

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

/** Transparent hit boxes above the canvas to select, move and resize overlays. */
export function OverlayLayer({ width, height }: Props) {
  const { state, setState, commit, selectedOverlayId, setSelectedOverlayId } = useEditor()
  const gesture = useRef<Gesture | null>(null)
  const layerRef = useRef<HTMLDivElement>(null)

  const update = (id: string, patch: Partial<Overlay>) =>
    setState(
      (s) => ({ ...s, overlays: s.overlays.map((o) => (o.id === id ? ({ ...o, ...patch } as Overlay) : o)) }),
      { transient: true },
    )

  const startMove = (e: ReactPointerEvent, o: Overlay) => {
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    setSelectedOverlayId(o.id)
    gesture.current = { kind: "move", id: o.id, startX: e.clientX, startY: e.clientY, ox: o.x, oy: o.y }
  }

  const startResize = (e: ReactPointerEvent, o: Overlay) => {
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    const rect = layerRef.current!.getBoundingClientRect()
    const cx = rect.left + o.x * width
    const cy = rect.top + o.y * height
    if (overlayResizeMode(o) === "free") {
      gesture.current = { kind: "resize-free", id: o.id, cx, cy }
      return
    }
    gesture.current = {
      kind: "resize",
      id: o.id,
      cx,
      cy,
      startDist: Math.max(1, Math.hypot(e.clientX - cx, e.clientY - cy)),
      startSize: o.size,
    }
  }

  const onPointerMove = (e: ReactPointerEvent) => {
    const g = gesture.current
    if (!g) return
    if (g.kind === "move") {
      update(g.id, {
        x: clamp(g.ox + (e.clientX - g.startX) / width, 0, 1),
        y: clamp(g.oy + (e.clientY - g.startY) / height, 0, 1),
      })
    } else if (g.kind === "resize-free") {
      // Center stays put: the box is twice the distance to the pointer.
      update(g.id, {
        size: clamp((200 * Math.abs(e.clientX - g.cx)) / width, 1, 200),
        heightPct: clamp((200 * Math.abs(e.clientY - g.cy)) / height, 1, 200),
      } as Partial<Overlay>)
    } else {
      const dist = Math.hypot(e.clientX - g.cx, e.clientY - g.cy)
      update(g.id, { size: clamp((g.startSize * dist) / g.startDist, 0.5, 300) })
    }
  }

  const endGesture = () => {
    if (!gesture.current) return
    gesture.current = null
    commit()
  }

  return (
    <div
      ref={layerRef}
      className="absolute inset-0 touch-none"
      onPointerDown={() => setSelectedOverlayId(null)}
      onPointerMove={onPointerMove}
      onPointerUp={endGesture}
      onPointerCancel={endGesture}
    >
      {state.overlays.map((o) => {
        const box = getOverlayBox(o, width, height)
        const selected = o.id === selectedOverlayId
        return (
          <div
            key={o.id}
            className={cn(
              "absolute cursor-move rounded-sm outline-offset-2",
              selected ? "outline-2 outline-primary" : "hover:outline-1 hover:outline-white/60 hover:outline-dashed",
            )}
            style={{ left: box.x, top: box.y, width: box.width, height: box.height }}
            onPointerDown={(e) => startMove(e, o)}
          >
            {selected && (
              <div
                className="absolute -right-2.5 -bottom-2.5 size-4 cursor-nwse-resize rounded-full border-2 border-primary bg-white after:absolute after:-inset-3 after:content-['']"
                onPointerDown={(e) => startResize(e, o)}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
