import piexif from "piexifjs"

/**
 * EXIF metadata carried from the source photo to the exported JPEG.
 *
 * Only JPEG sources are supported (EXIF lives in an APP1 segment near the
 * start of the file). Pixels are re-encoded by the browser, so the metadata
 * is re-injected afterwards with a few corrections:
 *  - Orientation is reset to 1: rotation is already baked into the pixels
 *  - pixel dimensions are updated to the exported size
 *  - the embedded thumbnail is dropped (it would show the unedited photo)
 */
export type ExifData = piexif.ExifDict

const SOI = 0xffd8
const APP1 = 0xffe1
const SOS = 0xffda
/** EXIF must fit in a single APP1 segment (length field is 16 bits). */
const MAX_SEGMENT = 0xffff - 2

/** Bytes → binary string, the format piexifjs works with. */
function toBinaryString(bytes: Uint8Array) {
  let out = ""
  for (let i = 0; i < bytes.length; i += 0x8000) {
    out += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return out
}

function fromBinaryString(str: string) {
  const bytes = new Uint8Array(str.length)
  for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i)
  return bytes
}

/** Reads the EXIF block of a JPEG file, or `null` if there is none. */
export async function readExif(blob: Blob): Promise<ExifData | null> {
  // Metadata segments come first; 256 KB is plenty to reach them.
  const bytes = new Uint8Array(await blob.slice(0, 256 * 1024).arrayBuffer())
  const view = new DataView(bytes.buffer)
  if (bytes.length < 4 || view.getUint16(0) !== SOI) return null

  let offset = 2
  while (offset + 4 <= bytes.length) {
    const marker = view.getUint16(offset)
    if ((marker & 0xff00) !== 0xff00 || marker === SOS) break
    const length = view.getUint16(offset + 2)
    const start = offset + 4
    if (marker === APP1 && toBinaryString(bytes.subarray(start, start + 6)) === "Exif\0\0") {
      try {
        return piexif.load(toBinaryString(bytes.subarray(start, offset + 2 + length)))
      } catch {
        return null
      }
    }
    offset += 2 + length
  }
  return null
}

function prepare(exif: ExifData, width: number, height: number): ExifData {
  const out: ExifData = {
    "0th": { ...exif["0th"] },
    Exif: { ...exif.Exif },
    GPS: { ...exif.GPS },
    Interop: { ...exif.Interop },
  }
  out["0th"]![piexif.ImageIFD.Orientation] = 1
  delete out["0th"]![piexif.ImageIFD.ImageWidth]
  delete out["0th"]![piexif.ImageIFD.ImageLength]
  out.Exif![piexif.ExifIFD.PixelXDimension] = width
  out.Exif![piexif.ExifIFD.PixelYDimension] = height
  return out
}

function dumpSegment(exif: ExifData) {
  let data = piexif.dump(exif)
  if (data.length > MAX_SEGMENT && exif.Exif) {
    // Some phones write huge maker notes; drop them rather than everything.
    delete exif.Exif[piexif.ExifIFD.MakerNote]
    data = piexif.dump(exif)
  }
  return data.length > MAX_SEGMENT ? null : data
}

/**
 * Returns a copy of `jpeg` with the EXIF metadata inserted right after the
 * SOI marker. Throws if the metadata cannot be written.
 */
export async function insertExif(jpeg: Blob, exif: ExifData, width: number, height: number): Promise<Blob> {
  const data = dumpSegment(prepare(exif, width, height))
  if (!data) throw new Error("Métadonnées EXIF trop volumineuses")

  const segment = new Uint8Array(4 + data.length)
  new DataView(segment.buffer).setUint16(0, APP1)
  new DataView(segment.buffer).setUint16(2, data.length + 2)
  segment.set(fromBinaryString(data), 4)

  const head = new Uint8Array(await jpeg.slice(0, 2).arrayBuffer())
  if (head[0] !== 0xff || head[1] !== 0xd8) throw new Error("JPEG invalide")
  return new Blob([head, segment, jpeg.slice(2)], { type: "image/jpeg" })
}
