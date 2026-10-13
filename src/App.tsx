import { useState } from "react"
import { Toaster } from "@/components/ui/sonner"
import { Editor } from "@/editor/editor"
import type { LoadedImage } from "@/editor/types"
import { ImportScreen } from "@/import/import-screen"

export default function App() {
  const [image, setImage] = useState<LoadedImage | null>(null)

  const close = () => {
    if (!window.confirm("Quitter l'éditeur ? Les modifications non téléchargées seront perdues.")) return
    image?.full.close()
    setImage(null)
  }

  return (
    <>
      {image ? <Editor image={image} onClose={close} /> : <ImportScreen onLoaded={setImage} />}
      <Toaster position="bottom-right" />
    </>
  )
}
