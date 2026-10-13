import { ADJUSTMENT_GROUPS, ADJUSTMENTS } from "../../adjustments"
import { useEditor } from "../../editor-context"
import { PanelSection, SliderField } from "../panel-section"

/** Generated from the adjustment registry: nothing to change here to add one. */
export function AdjustPanel() {
  const { state, setState, commit } = useEditor()

  return (
    <div>
      {ADJUSTMENT_GROUPS.map((group) => {
        const items = ADJUSTMENTS.filter((a) => a.group === group.id)
        if (!items.length) return null
        return (
          <PanelSection key={group.id} title={group.label}>
            {items.map((adj) => (
              <SliderField
                key={adj.id}
                label={adj.label}
                value={state.adjustments[adj.id] ?? adj.default}
                min={adj.min}
                max={adj.max}
                trackGradient={adj.trackGradient}
                onChange={(value) =>
                  setState((s) => ({ ...s, adjustments: { ...s.adjustments, [adj.id]: value } }), { transient: true })
                }
                onCommit={commit}
              />
            ))}
          </PanelSection>
        )
      })}
    </div>
  )
}
