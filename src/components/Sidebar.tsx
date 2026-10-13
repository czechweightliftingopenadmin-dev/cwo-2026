import { ArrowUpRight, Menu, X } from 'lucide-react'
import { useRef } from 'react'
import type { MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { event } from '../config/event'
import { useNavigation } from '../hooks/useNavigation'
import { Preferences } from './Preferences'

const sections = [
  { id: 'home', key: 'nav.home' },
  { id: 'about', key: 'nav.about' },
  { id: 'venue', key: 'nav.venue' },
] as const

export function Sidebar() {
  const { t } = useTranslation()
  const { open, pinned, panelRef, toggleRef, dispatch, close } = useNavigation()
  const togglePointer = useRef<number | null>(null)
  const consumePointerClick = useRef(false)

  function navigate(e: MouseEvent<HTMLAnchorElement>, id: string) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    e.preventDefault()
    const target = document.getElementById(id)
    close(false)
    target?.focus({ preventScroll: true })
    target?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'instant'
        : 'smooth',
    })
    history.replaceState(null, '', `#${id}`)
  }

  return (
    <aside
      ref={panelRef}
      className="sidebar"
      data-open={open}
      onPointerEnter={(e) => {
        if (e.pointerType === 'mouse') dispatch({ type: 'enter' })
      }}
      onPointerLeave={() => dispatch({ type: 'leave' })}
      onFocusCapture={() => dispatch({ type: 'focus' })}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) dispatch({ type: 'blur' })
      }}
      onPointerDownCapture={(e) => {
        consumePointerClick.current = false
        if (e.button === 0 && e.target instanceof Node && toggleRef.current?.contains(e.target))
          togglePointer.current = e.pointerId
      }}
      onPointerUpCapture={(e) => {
        // Opening on focus changes the button's geometry between down and up.
        // Complete the gesture at the stable panel ancestor, even if its target changed.
        if (togglePointer.current === e.pointerId) {
          consumePointerClick.current = true
          dispatch({ type: 'toggle' })
        }
        togglePointer.current = null
      }}
      onPointerCancel={() => {
        togglePointer.current = null
      }}
      onClickCapture={(e) => {
        // A touch browser can deliver its compatibility click to a newly revealed
        // navigation link. Consume it so opening the panel cannot select a section.
        if (consumePointerClick.current && e.detail > 0) {
          e.preventDefault()
          e.stopPropagation()
          consumePointerClick.current = false
        }
      }}
    >
      <button
        ref={toggleRef}
        type="button"
        className="rail-toggle"
        aria-label={pinned ? t('nav.close') : open ? t('nav.pin') : t('nav.toggle')}
        aria-expanded={open}
        aria-controls="main-navigation"
        onClick={(e) => {
          if (e.detail === 0) dispatch({ type: 'toggle' })
        }}
      >
        <span className="rail-brand" aria-hidden="true">
          <span className="rail-words">
            <span className="rail-word rail-czech">CZECH</span>
            <span className="rail-word">WEIGHTLIFTING</span>
            <span className="rail-word rail-open">
              OPEN<span className="rail-year">{event.year}</span>
            </span>
          </span>
          <span className="rail-plus">+</span>
        </span>
        <span className="compact-brand" aria-hidden="true">
          CWO <span>{event.year}</span>
        </span>
        <span className="rail-prompt" aria-hidden="true">
          {open ? <X size={22} /> : <Menu size={22} />}
          <span>{t('nav.hint')}</span>
        </span>
      </button>
      <div className="nav-content" id="main-navigation" hidden={!open}>
        <nav aria-label={t('nav.label')}>
          {sections.map(({ id, key }, index) => (
            <a key={id} href={`#${id}`} onClick={(e) => navigate(e, id)} className="nav-link">
              <span className="nav-index">0{index + 1}</span>
              <span>{t(key)}</span>
              <ArrowUpRight size={22} aria-hidden="true" />
            </a>
          ))}
        </nav>
        <div className="nav-bottom">
          <p>{t('nav.note', { year: event.year })}</p>
          <Preferences />
        </div>
      </div>
    </aside>
  )
}
