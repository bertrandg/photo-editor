import { RotateCcwIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { EditorProvider, useEditor } from "./editor-context"
import { Stage } from "./stage/stage"
import { DEFAULT_TOOL, getTool, TOOLS } from "./tools"
import { TopBar } from "./top-bar"
import type { LoadedImage } from "./types"

function Sidebar() {
  const { activeTool, setActiveTool, setState } = useEditor()
  const tool = getTool(activeTool)

  return (
    <aside className="flex w-[22rem] shrink-0 flex-col border-r bg-sidebar">
      <Tabs value={activeTool} onValueChange={(v) => setActiveTool(String(v))} className="min-h-0 flex-1 gap-0">
        <TabsList variant="line" className="h-auto! w-full shrink-0 gap-0 rounded-none border-b p-0">
          {TOOLS.map((t) => (
            <TabsTrigger
              key={t.id}
              value={t.id}
              className="h-auto flex-col gap-1 rounded-none py-3 text-xs font-normal after:bottom-0! data-active:text-primary! group-data-[variant=line]/tabs-list:data-active:after:bg-primary [&_svg:not([class*='size-'])]:size-5"
            >
              <t.icon />
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {TOOLS.map((t) => (
          <TabsContent key={t.id} value={t.id} className="min-h-0 overflow-y-auto">
            <t.Panel />
          </TabsContent>
        ))}
      </Tabs>
      {tool.reset && (
        <div className="flex shrink-0 justify-center border-t p-3">
          <Button variant="ghost" className="text-primary hover:text-primary" onClick={() => setState(tool.reset!)}>
            <RotateCcwIcon />
            Réinitialiser tout
          </Button>
        </div>
      )}
    </aside>
  )
}

export function Editor({ image, onClose }: { image: LoadedImage; onClose: () => void }) {
  return (
    <EditorProvider image={image} initialTool={DEFAULT_TOOL}>
      <div className="flex h-dvh flex-col bg-background text-foreground">
        <TopBar onClose={onClose} />
        <div className="flex min-h-0 flex-1">
          <Sidebar />
          <Stage />
        </div>
      </div>
    </EditorProvider>
  )
}
