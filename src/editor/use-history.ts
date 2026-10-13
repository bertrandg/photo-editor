import { useCallback, useReducer } from "react"

const MAX_HISTORY = 100

interface History<T> {
  past: T[]
  present: T
  future: T[]
  /** Snapshot taken at the start of a transient change (slider drag…). */
  pending: T | null
}

type Action<T> =
  | { type: "set"; updater: (s: T) => T; transient: boolean }
  | { type: "commit" }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "reset"; state: T }

function reducer<T>(h: History<T>, action: Action<T>): History<T> {
  switch (action.type) {
    case "set": {
      const next = action.updater(h.present)
      if (next === h.present) return h
      if (action.transient) return { ...h, present: next, pending: h.pending ?? h.present }
      return {
        past: [...h.past, h.pending ?? h.present].slice(-MAX_HISTORY),
        present: next,
        future: [],
        pending: null,
      }
    }
    case "commit":
      if (!h.pending) return h
      return { past: [...h.past, h.pending].slice(-MAX_HISTORY), present: h.present, future: [], pending: null }
    case "undo": {
      const base = h.pending ?? h.present
      if (h.pending) return { ...h, present: base, pending: null }
      const prev = h.past.at(-1)
      if (prev === undefined) return h
      return { past: h.past.slice(0, -1), present: prev, future: [h.present, ...h.future], pending: null }
    }
    case "redo": {
      const next = h.future[0]
      if (next === undefined) return h
      return { past: [...h.past, h.present], present: next, future: h.future.slice(1), pending: null }
    }
    case "reset":
      return { past: [], present: action.state, future: [], pending: null }
  }
}

/**
 * Undo/redo state. Use `{ transient: true }` for continuous interactions
 * (dragging) and call `commit()` when the interaction ends: the whole gesture
 * then becomes a single history entry.
 */
export function useHistory<T>(initial: T) {
  const [h, dispatch] = useReducer(reducer<T>, { past: [], present: initial, future: [], pending: null })

  const set = useCallback(
    (updater: T | ((s: T) => T), opts?: { transient?: boolean }) =>
      dispatch({
        type: "set",
        updater: typeof updater === "function" ? (updater as (s: T) => T) : () => updater,
        transient: !!opts?.transient,
      }),
    [],
  )
  const commit = useCallback(() => dispatch({ type: "commit" }), [])
  const undo = useCallback(() => dispatch({ type: "undo" }), [])
  const redo = useCallback(() => dispatch({ type: "redo" }), [])
  const reset = useCallback((state: T) => dispatch({ type: "reset", state }), [])

  return {
    state: h.present,
    set,
    commit,
    undo,
    redo,
    reset,
    canUndo: h.past.length > 0 || h.pending !== null,
    canRedo: h.future.length > 0,
  }
}
