import { ArrowUpRight, Menu, X } from 'lucide-react'
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
      onFocusCapture={(e) => {
        if (e.target === toggleRef.current || open) dispatch({ type: 'focus' })
      }}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) dispatch({ type: 'blur' })
      }}
    >
      <button
        ref={toggleRef}
        type="button"
        className="rail-toggle"
        aria-label={pinned ? t('nav.close') : open ? t('nav.pin') : t('nav.toggle')}
        aria-expanded={open}
        aria-controls="main-navigation"
        onClick={() => dispatch({ type: 'toggle' })}
      >
        <span className="rail-menu-label" aria-hidden="true">
          {t('nav.hint')}
        </span>
        <span className="compact-brand" aria-hidden="true">
          CWO <span>{event.year}</span>
        </span>
        <span className="rail-prompt" aria-hidden="true">
          {open ? <X size={22} /> : <Menu size={22} />}
          <span>{t('nav.hint')}</span>
        </span>
      </button>
      <button
        type="button"
        className="rail-brand"
        tabIndex={-1}
        inert={open}
        aria-label={`${event.name} ${event.year}: ${t('nav.toggle')}`}
        onClick={() => dispatch({ type: 'toggle' })}
      >
        <span className="rail-words" aria-hidden="true">
          {['CZECH', 'WEIGHTLIFTING', 'OPEN'].map((word) => (
            <span key={word} className="rail-word">
              {[...word].map((letter, index) => (
                <span key={index} className={index === 0 ? 'rail-initial' : undefined}>
                  {letter}
                </span>
              ))}
              {word === 'OPEN' && (
                <span className="rail-year">
                  {[...String(event.year)].map((digit, index) => (
                    <span key={index}>{digit}</span>
                  ))}
                </span>
              )}
            </span>
          ))}
        </span>
      </button>
      <div className="nav-content" id="main-navigation" inert={!open} aria-hidden={!open}>
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
          <Preferences />
        </div>
      </div>
    </aside>
  )
}
