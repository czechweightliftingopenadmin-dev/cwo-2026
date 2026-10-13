import { useCallback, useEffect, useReducer, useRef } from 'react'

interface State {
  hovered: boolean
  focused: boolean
  pinned: boolean
  dismissed: boolean
}
type Action = { type: 'enter' | 'leave' | 'focus' | 'blur' | 'toggle' | 'dismiss' }

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'enter':
      return { ...state, hovered: true, dismissed: false }
    case 'leave':
      return { ...state, hovered: false }
    case 'focus':
      return { ...state, focused: true }
    case 'blur':
      return { ...state, focused: false }
    case 'toggle':
      return state.pinned
        ? { ...state, pinned: false, dismissed: true }
        : { ...state, pinned: true, dismissed: false }
    case 'dismiss':
      return { ...state, pinned: false, dismissed: true }
  }
}

export function useNavigation() {
  const [state, dispatch] = useReducer(reducer, {
    hovered: false,
    focused: false,
    pinned: false,
    dismissed: false,
  })
  const panelRef = useRef<HTMLElement>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const open = !state.dismissed && (state.hovered || state.focused || state.pinned)

  const close = useCallback((restoreFocus = true) => {
    if (restoreFocus && panelRef.current?.contains(document.activeElement))
      toggleRef.current?.focus()
    dispatch({ type: 'dismiss' })
  }, [])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        close()
      }
    }
    const onPointerDown = (e: PointerEvent) => {
      if (e.target instanceof Node && !panelRef.current?.contains(e.target)) close()
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [open, close])

  return { open, pinned: state.pinned, panelRef, toggleRef, dispatch, close }
}
