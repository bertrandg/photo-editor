import { useCallback, useEffect, useState } from "react"

// Older Safari (and iPadOS) only expose the prefixed API.
type WebkitDocument = Document & {
  webkitFullscreenEnabled?: boolean
  webkitFullscreenElement?: Element | null
  webkitExitFullscreen?: () => Promise<void>
}
type WebkitElement = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> }

const doc = document as WebkitDocument

const currentElement = () => doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null

/**
 * Fullscreen state of the page. `supported` is false where the API does not
 * exist (e.g. Safari on iPhone): the caller should then hide its button.
 */
export function useFullscreen() {
  const supported = !!(doc.fullscreenEnabled || doc.webkitFullscreenEnabled)
  const [active, setActive] = useState(() => currentElement() !== null)

  useEffect(() => {
    const onChange = () => setActive(currentElement() !== null)
    document.addEventListener("fullscreenchange", onChange)
    document.addEventListener("webkitfullscreenchange", onChange)
    return () => {
      document.removeEventListener("fullscreenchange", onChange)
      document.removeEventListener("webkitfullscreenchange", onChange)
    }
  }, [])

  const toggle = useCallback(async () => {
    try {
      if (currentElement()) {
        await (doc.exitFullscreen?.() ?? doc.webkitExitFullscreen?.())
      } else {
        const el = document.documentElement as WebkitElement
        await (el.requestFullscreen?.() ?? el.webkitRequestFullscreen?.())
      }
    } catch (err) {
      // Refused by the browser (e.g. not triggered by a user gesture).
      console.warn("Plein écran indisponible", err)
    }
  }, [])

  return { supported, active, toggle }
}
