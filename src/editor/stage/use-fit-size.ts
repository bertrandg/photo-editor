import { useLayoutEffect, useState, type RefObject } from "react"

/** Largest size with the given aspect ratio that fits inside the element. */
export function useFitSize(ref: RefObject<HTMLElement | null>, aspect: number) {
  const [box, setBox] = useState({ width: 0, height: 0 })

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setBox({ width, height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])

  if (!box.width || !box.height) return { width: 0, height: 0 }
  if (box.width / box.height > aspect) {
    return { width: Math.floor(box.height * aspect), height: Math.floor(box.height) }
  }
  return { width: Math.floor(box.width), height: Math.floor(box.width / aspect) }
}
