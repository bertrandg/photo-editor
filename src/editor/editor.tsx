import { RotateCcwIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { EditorProvider, useEditor } from "./editor-context"
import { Stage } from "./stage/stage"
import { DEFAULT_TOOL, getTool, TOOLS } from "./tools"
import { TopBar } from "./top-bar"
import type { LoadedImage } from "./types"

/**
 * Tool panel. Desktop: left column (tabs on top). Mobile: bottom sheet under
 * the image, with the tab bar at the very bottom (thumb reach).
 */
function Sidebar() {
  const { activeTool, setActiveTool, setState } = useEditor()
  const tool = getTool(activeTool)

  return (
    <aside className="order-last flex h-[45dvh] w-full shrink-0 flex-col border-t bg-sidebar md:order-none md:h-auto md:w-[22rem] md:border-t-0 md:border-r">
      <Tabs value={activeTool} onValueChange={(v) => setActiveTool(String(v))} className="min-h-0 flex-1 gap-0">
        <TabsList
          variant="line"
          className="order-3 h-auto! w-full shrink-0 gap-0 rounded-none border-t p-0 pb-[env(safe-area-inset-bottom)] md:order-1 md:border-t-0 md:border-b md:pb-0"
        >
          {TOOLS.map((t) => (
            <TabsTrigger
              key={t.id}
              value={t.id}
              className="h-auto flex-col gap-1 rounded-none py-2.5 text-xs font-normal data-active:text-primary! group-data-[variant=line]/tabs-list:data-active:after:bg-primary max-md:after:top-0! max-md:after:bottom-auto! md:py-3 md:after:bottom-0! [&_svg:not([class*='size-'])]:size-5"
            >
              <t.icon />
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {TOOLS.map((t) => (
          <TabsContent key={t.id} value={t.id} className="order-1 min-h-0 overflow-y-auto overscroll-contain md:order-2">
            <t.Panel />
          </TabsContent>
        ))}
        {tool.reset && (
          <div className="order-2 flex shrink-0 justify-center border-t p-1 md:order-3 md:p-3">
            <Button variant="ghost" className="text-primary hover:text-primary" onClick={() => setState(tool.reset!)}>
              <RotateCcwIcon />
              Réinitialiser tout
            </Button>
          </div>
        )}
      </Tabs>
    </aside>
  )
}

export function Editor({ image, onClose }: { image: LoadedImage; onClose: () => void }) {
  return (
    <EditorProvider image={image} initialTool={DEFAULT_TOOL}>
      <div className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
        <TopBar onClose={onClose} />
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <Sidebar />
          <Stage />
        </div>
      </div>
    </EditorProvider>
  )
}
