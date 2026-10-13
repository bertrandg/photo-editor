import type { ReactNode } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"

/** Titled block of a tool panel (e.g. "LUMIÈRE"). */
export function PanelSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 border-b px-4 py-4 last:border-b-0 md:gap-5 md:px-5 md:py-5">
      <h3 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">{title}</h3>
      {children}
    </section>
  )
}

interface SliderFieldProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  /** Formats the value shown in the numeric box. */
  unit?: string
  trackGradient?: string
  /** Called continuously while dragging / typing. */
  onChange: (value: number) => void
  /** Called once the interaction ends (one undo step). */
  onCommit: () => void
}

/** Label + numeric input + slider, as in the "Ajuster" panel. */
export function SliderField({ label, value, min, max, step = 1, unit, trackGradient, onChange, onCommit }: SliderFieldProps) {
  const clamp = (v: number) => Math.min(max, Math.max(min, v))
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-sm font-normal">{label}</Label>
        <div className="relative">
          <Input
            type="number"
            inputMode="numeric"
            className="h-8 w-16 px-2 text-center tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
            value={step >= 1 ? Math.round(value) : Math.round(value * 10) / 10}
            min={min}
            max={max}
            step={step}
            onChange={(e) => {
              const v = Number(e.target.value)
              if (!Number.isNaN(v)) onChange(clamp(v))
            }}
            onBlur={onCommit}
            onKeyDown={(e) => e.key === "Enter" && onCommit()}
          />
          {unit && (
            <span className="pointer-events-none absolute top-1/2 right-1.5 -translate-y-1/2 text-xs text-muted-foreground">
              {unit}
            </span>
          )}
        </div>
      </div>
      <Slider
        value={value}
        min={min}
        max={max}
        step={step}
        trackStyle={trackGradient ? { background: trackGradient } : undefined}
        hideRange={!!trackGradient || min < 0}
        onValueChange={(v) => onChange(Array.isArray(v) ? v[0] : v)}
        onValueCommitted={onCommit}
        aria-label={label}
      />
    </div>
  )
}
