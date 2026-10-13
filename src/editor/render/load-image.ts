import type { LoadedImage } from "../types"
import { readExif } from "./exif"

/** Longest edge of the interactive preview. Export always uses full resolution. */
export const PREVIEW_MAX_EDGE = 2048

function baseName(name: string) {
  const clean = name.split(/[?#]/)[0].split("/").pop() || "image"
  return decodeURIComponent(clean).replace(/\.[^.]+$/, "") || "image"
}

/** Downscale with successive halvings to avoid aliasing on huge images. */
function makePreview(bitmap: ImageBitmap): HTMLCanvasElement {
  const ratio = Math.min(1, PREVIEW_MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const targetW = Math.max(1, Math.round(bitmap.width * ratio))
  const targetH = Math.max(1, Math.round(bitmap.height * ratio))

  let src: CanvasImageSource = bitmap
  let w = bitmap.width
  let h = bitmap.height
  while (w / 2 > targetW) {
    w = Math.round(w / 2)
    h = Math.round(h / 2)
    const step = document.createElement("canvas")
    step.width = w
    step.height = h
    const ctx = step.getContext("2d")!
    ctx.imageSmoothingQuality = "high"
    ctx.drawImage(src, 0, 0, w, h)
    src = step
  }

  const canvas = document.createElement("canvas")
  canvas.width = targetW
  canvas.height = targetH
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!
  ctx.imageSmoothingQuality = "high"
  ctx.drawImage(src, 0, 0, targetW, targetH)
  return canvas
}

export async function decodeBlob(blob: Blob): Promise<ImageBitmap> {
  if (blob.type && !blob.type.startsWith("image/")) {
    throw new Error("Le fichier n'est pas une image.")
  }
  try {
    return await createImageBitmap(blob, { imageOrientation: "from-image" })
  } catch {
    throw new Error("Impossible de décoder cette image (format non supporté ou image trop grande).")
  }
}

async function fromBlob(blob: Blob, name: string): Promise<LoadedImage> {
  const [full, exif] = await Promise.all([decodeBlob(blob), readExif(blob).catch(() => null)])
  return { full, preview: makePreview(full), width: full.width, height: full.height, name: baseName(name), exif }
}

export function loadImageFromFile(file: File) {
  return fromBlob(file, file.name)
}

export async function loadImageFromUrl(url: string) {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error("URL invalide.")
  }
  let res: Response
  try {
    res = await fetch(parsed, { mode: "cors" })
  } catch {
    throw new Error(
      "Impossible de télécharger l'image. Le serveur n'autorise probablement pas l'accès depuis un autre site (CORS).",
    )
  }
  if (!res.ok) throw new Error(`Le serveur a répondu ${res.status}.`)
  return fromBlob(await res.blob(), parsed.pathname)
}
