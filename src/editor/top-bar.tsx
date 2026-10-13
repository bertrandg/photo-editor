import { DownloadIcon, Loader2Icon, Redo2Icon, Undo2Icon, XIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { useEditor } from "./editor-context"
import { downloadBlob, EXPORT_EXTENSION, exportImage } from "./render/export"

export function TopBar({ onClose }: { onClose: () => void }) {
  const { image, state, undo, redo, canUndo, canRedo } = useEditor()
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "z") return
      if ((e.target as HTMLElement).closest("input, textarea")) return
      e.preventDefault()
      if (e.shiftKey) redo()
      else undo()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [undo, redo])

  const download = async () => {
    setExporting(true)
    const id = toast.loading("Génération de l'image en pleine résolution…")
    try {
      const { blob, width, height, downscaled, exif } = await exportImage(image, state)
      downloadBlob(blob, `${image.name}-edit.${EXPORT_EXTENSION}`)
      const notes = [
        exif === "kept" && "Métadonnées EXIF conservées.",
        exif === "failed" && "Les métadonnées EXIF n'ont pas pu être conservées.",
        downscaled && "L'image a été réduite pour respecter les limites du navigateur.",
      ].filter(Boolean)
      toast.success(`Image téléchargée (${width} × ${height} px)`, {
        id,
        description: notes.length ? notes.join(" ") : undefined,
      })
    } catch (e) {
      console.error(e)
      toast.error("L'export a échoué", { id, description: (e as Error).message })
    } finally {
      setExporting(false)
    }
  }

  return (
    <header className="flex h-14 shrink-0 items-center gap-1 border-b px-2 pt-[env(safe-area-inset-top)] md:h-16 md:gap-2 md:px-4 md:pt-0">
      <Button variant="ghost" size="icon-lg" onClick={onClose} aria-label="Fermer">
        <XIcon className="size-5" />
      </Button>
      <div className="ml-auto flex items-center gap-1">
        <Button variant="ghost" size="icon-lg" onClick={undo} disabled={!canUndo} aria-label="Annuler" title="Annuler (⌘Z)">
          <Undo2Icon className="size-5" />
        </Button>
        <Button variant="ghost" size="icon-lg" onClick={redo} disabled={!canRedo} aria-label="Rétablir" title="Rétablir (⇧⌘Z)">
          <Redo2Icon className="size-5" />
        </Button>
      </div>
      <Separator orientation="vertical" className="mx-1 h-8! md:mx-3" />
      <Button size="lg" className="h-10 px-3 md:px-4" disabled={exporting} onClick={download} title="Télécharger en JPEG">
        {exporting ? <Loader2Icon className="animate-spin" /> : <DownloadIcon />}
        Enregistrer
      </Button>
    </header>
  )
}
