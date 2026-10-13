import { CopyIcon, Trash2Icon } from "lucide-react"
import { useEffect, useRef, type ComponentType } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useEditor } from "../../editor-context"
import type { BlurOverlay, ImageOverlay, Overlay, TextOverlay } from "../../overlays/types"
import { cropToPixels } from "../../render/geometry"
import { transformedSize } from "../../render/transform"
import { decodeBlob } from "../../render/load-image"
import type { EditorState, LoadedImage } from "../../types"
import { PanelSection, SliderField } from "../panel-section"
import { OVERLAY_FORMS, OVERLAY_LABELS, OVERLAY_META, type OverlayFormProps } from "./overlay-forms"
import { PositionGrid } from "./position-grid"

const uid = () => Math.random().toString(36).slice(2, 10)

function newText(): TextOverlay {
  return {
    id: uid(),
    kind: "text",
    text: "Votre texte",
    x: 0.5,
    y: 0.5,
    size: 8,
    opacity: 1,
    color: "#ffffff",
    fontFamily: "sans",
    bold: true,
    italic: false,
    align: "center",
    background: null,
    shadow: true,
  }
}

/** Face-shaped ellipse (a bit taller than wide), centered. */
function newBlur(image: LoadedImage, state: EditorState): BlurOverlay {
  const size = transformedSize(state.transform, image.width, image.height)
  const crop = cropToPixels(state.crop, size.width, size.height, state.cropAspect)
  const width = 20 // % of the output width
  return {
    id: uid(),
    kind: "blur",
    x: 0.5,
    y: 0.5,
    size: width,
    heightPct: Math.min(100, ((width * crop.width) / crop.height) * 1.25),
    opacity: 1,
    style: "blur",
    shape: "ellipse",
    strength: 60,
  }
}

export function AnnotatePanel() {
  const { image, state, setState, commit, selectedOverlayId, setSelectedOverlayId } = useEditor()
  const fileRef = useRef<HTMLInputElement>(null)
  const selected = state.overlays.find((o) => o.id === selectedOverlayId) ?? null

  const add = (o: Overlay) => {
    setState((s) => ({ ...s, overlays: [...s.overlays, o] }))
    setSelectedOverlayId(o.id)
  }

  const update = (id: string, patch: Partial<Overlay>, opts?: { transient?: boolean }) =>
    setState((s) => ({ ...s, overlays: s.overlays.map((o) => (o.id === id ? ({ ...o, ...patch } as Overlay) : o)) }), opts)

  const remove = (id: string) => {
    setState((s) => ({ ...s, overlays: s.overlays.filter((o) => o.id !== id) }))
    setSelectedOverlayId(null)
  }

  const duplicate = (o: Overlay) =>
    add({ ...o, id: uid(), x: Math.min(1, o.x + 0.03), y: Math.min(1, o.y + 0.03) })

  const onPickImage = async (file: File | undefined) => {
    if (!file) return
    try {
      const image = await decodeBlob(file)
      const overlay: ImageOverlay = {
        id: uid(),
        kind: "image",
        image,
        name: file.name,
        x: 0.5,
        y: 0.5,
        size: 30,
        opacity: 1,
      }
      add(overlay)
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  // Delete / Backspace removes the selected overlay (unless typing).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!selectedOverlayId) return
      const t = e.target as HTMLElement
      if (t.closest("input, textarea, [contenteditable]")) return
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault()
        remove(selectedOverlayId)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  const Form = selected ? (OVERLAY_FORMS[selected.kind] as ComponentType<OverlayFormProps<Overlay>>) : null

  return (
    <div>
      <PanelSection title="Ajouter">
        <div className="grid grid-cols-3 gap-2">
          <Button variant="outline" className="h-16 flex-col gap-1.5" onClick={() => add(newText())}>
            <OVERLAY_META.text.icon className="size-5!" />
            Texte
          </Button>
          <Button variant="outline" className="h-16 flex-col gap-1.5" onClick={() => fileRef.current?.click()}>
            <OVERLAY_META.image.icon className="size-5!" />
            Image
          </Button>
          <Button variant="outline" className="h-16 flex-col gap-1.5" onClick={() => add(newBlur(image, state))}>
            <OVERLAY_META.blur.icon className="size-5!" />
            Flou
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              onPickImage(e.target.files?.[0])
              e.target.value = ""
            }}
          />
        </div>
      </PanelSection>

      {state.overlays.length > 0 && (
        <PanelSection title="Calques">
          <ul className="-mx-2 flex flex-col gap-0.5">
            {[...state.overlays].reverse().map((o) => {
              const Icon = OVERLAY_META[o.kind].icon
              const label = (OVERLAY_LABELS[o.kind] as (o: Overlay) => string)(o)
              return (
                <li key={o.id}>
                  <button
                    type="button"
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent",
                      o.id === selectedOverlayId && "bg-primary/15 text-primary",
                    )}
                    onClick={() => setSelectedOverlayId(o.id)}
                  >
                    <Icon className="size-4 shrink-0" />
                    <span className="truncate">{label}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </PanelSection>
      )}

      {selected && Form && (
        <PanelSection title={OVERLAY_META[selected.kind].title}>
          <Form
            key={selected.id}
            overlay={selected}
            onChange={(patch, opts) => update(selected.id, patch, opts)}
            onCommit={commit}
          />
          <SliderField
            label="Opacité"
            unit="%"
            value={Math.round(selected.opacity * 100)}
            min={0}
            max={100}
            onChange={(v) => update(selected.id, { opacity: v / 100 }, { transient: true })}
            onCommit={commit}
          />
          <div className="flex items-end justify-between gap-3">
            <div className="flex flex-col gap-2">
              <span className="text-sm">Placement</span>
              <PositionGrid overlay={selected} onChange={(pos) => update(selected.id, pos)} />
            </div>
            <div className="flex gap-1">
              <Button variant="outline" size="icon" onClick={() => duplicate(selected)} title="Dupliquer">
                <CopyIcon />
              </Button>
              <Button variant="destructive" size="icon" onClick={() => remove(selected.id)} title="Supprimer">
                <Trash2Icon />
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Astuce : déplacez l'élément directement sur l'image, et redimensionnez-le avec la poignée.
          </p>
        </PanelSection>
      )}

      {state.overlays.length === 0 && (
        <p className="px-5 py-2 text-sm text-muted-foreground">
          Ajoutez un texte, une image (logo, filigrane…) ou une zone floue (visage, plaque…) par-dessus votre photo.
        </p>
      )}
    </div>
  )
}
