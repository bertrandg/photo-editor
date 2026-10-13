import { ChevronDownIcon, Loader2Icon, Redo2Icon, Undo2Icon, XIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"
import { useEditor } from "./editor-context"
import { downloadBlob, EXPORT_FORMATS, exportImage, type ExportFormat } from "./render/export"

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

  const download = async (type: ExportFormat) => {
    const format = EXPORT_FORMATS.find((f) => f.type === type)!
    setExporting(true)
    const id = toast.loading("Génération de l'image en pleine résolution…")
    try {
      const { blob, width, height, downscaled } = await exportImage(image, state, type)
      downloadBlob(blob, `${image.name}-edit.${format.ext}`)
      toast.success(`Image téléchargée (${width} × ${height} px)`, {
        id,
        description: downscaled ? "L'image a été réduite pour respecter les limites du navigateur." : undefined,
      })
    } catch (e) {
      console.error(e)
      toast.error("L'export a échoué", { id, description: (e as Error).message })
    } finally {
      setExporting(false)
    }
  }

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
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
      <Separator orientation="vertical" className="mx-3 h-8!" />
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button size="lg" className="h-10 px-4" disabled={exporting}>
              {exporting && <Loader2Icon className="animate-spin" />}
              Enregistrer
              <ChevronDownIcon />
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Télécharger en</DropdownMenuLabel>
            {EXPORT_FORMATS.map((f) => (
              <DropdownMenuItem key={f.type} onClick={() => download(f.type)}>
                {f.label}
                <span className="ml-auto text-xs text-muted-foreground">.{f.ext}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
