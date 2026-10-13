import { ImageUpIcon, Link2Icon, Loader2Icon, XIcon } from "lucide-react"
import { useEffect, useMemo, useRef, useState, type DragEvent, type FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { loadImageFromFile, loadImageFromUrl } from "@/editor/render/load-image"
import type { LoadedImage } from "@/editor/types"

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`
}

export function ImportScreen({ onLoaded }: { onLoaded: (image: LoadedImage) => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [url, setUrl] = useState("")
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const thumbUrl = useThumbUrl(file)

  const pickFile = (f: File | undefined) => {
    if (!f) return
    setError(null)
    setFile(f)
    setUrl("")
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    pickFile(e.dataTransfer.files[0])
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!file && !url.trim()) return
    setLoading(true)
    setError(null)
    try {
      onLoaded(file ? await loadImageFromFile(file) : await loadImageFromUrl(url.trim()))
    } catch (err) {
      setError((err as Error).message)
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-3 text-foreground sm:p-6">
      <form onSubmit={submit} className="flex w-full max-w-lg flex-col gap-6 rounded-2xl border bg-card p-5 shadow-2xl sm:p-8">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold">Éditer une image</h1>
          <p className="text-sm text-muted-foreground">Choisissez une image sur votre ordinateur ou collez son adresse web.</p>
        </div>

        {file ? (
          <div className="flex items-center gap-4 rounded-xl border bg-muted/30 p-3">
            {thumbUrl && <img src={thumbUrl} alt="" className="size-16 rounded-lg object-cover" />}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">{formatSize(file.size)}</p>
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={() => setFile(null)} aria-label="Retirer">
              <XIcon />
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={cn(
              "flex flex-col items-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors hover:border-primary/60 hover:bg-primary/5",
              dragging && "border-primary bg-primary/10",
            )}
          >
            <div className="flex size-12 items-center justify-center rounded-full bg-primary/15 text-primary">
              <ImageUpIcon className="size-6" />
            </div>
            <div>
              <p className="text-sm font-medium">Glissez une image ici ou cliquez pour parcourir</p>
              <p className="mt-1 text-xs text-muted-foreground">JPEG, PNG, WebP, AVIF… même en très haute résolution</p>
            </div>
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            pickFile(e.target.files?.[0])
            e.target.value = ""
          }}
        />

        <div className="flex items-center gap-3 text-xs text-muted-foreground uppercase">
          <div className="h-px flex-1 bg-border" />
          ou
          <div className="h-px flex-1 bg-border" />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="image-url">Adresse web de l'image</Label>
          <div className="relative">
            <Link2Icon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="image-url"
              type="url"
              placeholder="https://exemple.com/photo.jpg"
              className="h-10 pl-9"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value)
                setError(null)
                if (e.target.value) setFile(null)
              }}
            />
          </div>
        </div>

        {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

        <Button type="submit" size="lg" className="h-11" disabled={loading || (!file && !url.trim())}>
          {loading && <Loader2Icon className="animate-spin" />}
          {loading ? "Chargement…" : "Ouvrir l'éditeur"}
        </Button>
      </form>
    </div>
  )
}

function useThumbUrl(file: File | null) {
  const thumb = useMemo(() => (file ? URL.createObjectURL(file) : null), [file])
  useEffect(() => () => {
    if (thumb) URL.revokeObjectURL(thumb)
  }, [thumb])
  return thumb
}
