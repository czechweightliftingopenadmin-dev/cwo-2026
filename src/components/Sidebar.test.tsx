import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '../i18n'
import { Sidebar } from './Sidebar'
import { preferenceKeys } from '../lib/preferences'

beforeEach(async () => {
  localStorage.clear()
  await i18n.changeLanguage('cs')
  document.documentElement.dataset.theme = 'dark'
})

function setup() {
  const user = userEvent.setup()
  const view = render(
    <>
      <Sidebar />
      <main id="outside" tabIndex={-1}>
        <button>Outside</button>
        <section id="about" tabIndex={-1}>
          About target
        </section>
      </main>
    </>,
  )
  const toggle = screen.getByRole('button', { name: 'Otevřít nebo připnout navigaci' })
  const rail = view.container.querySelector('aside')!
  return { user, toggle, rail, ...view }
}

describe('navigation rail', () => {
  it('opens on mouse hover and closes on leaving, while touch hover does not open it', () => {
    const { rail, toggle } = setup()
    fireEvent.pointerEnter(rail, { pointerType: 'touch' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    fireEvent.pointerEnter(rail, { pointerType: 'mouse' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    fireEvent.pointerMove(rail, { pointerType: 'mouse' })
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    fireEvent.pointerLeave(rail, { pointerType: 'mouse' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
  })

  it('pins on click, stays open after leaving, and closes on a second click', async () => {
    const { user, rail, toggle } = setup()
    await user.click(toggle)
    fireEvent.pointerLeave(rail)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })

  it('supports keyboard focus, Escape, reopening, and closing on outside click', async () => {
    const { user, toggle } = setup()
    await user.tab()
    expect(toggle).toHaveFocus()
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    await user.keyboard('{Enter}')
    await user.tab()
    expect(screen.getByRole('link', { name: /Úvod/ })).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(toggle).toHaveFocus()
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await user.keyboard('{Enter}')
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    await user.click(screen.getByRole('button', { name: 'Outside' }))
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
  })

  it('closes after navigation and moves focus to the selected section', async () => {
    const { user, toggle } = setup()
    await user.click(toggle)
    await user.click(screen.getByRole('link', { name: /O soutěži/ }))
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(document.getElementById('about')).toHaveFocus()
    expect(window.location.hash).toBe('#about')
  })

  it('translates controls and remembers the language and appearance on remount', async () => {
    const { user, toggle, unmount } = setup()
    await user.click(toggle)
    await user.click(screen.getByRole('button', { name: 'English' }))
    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument()
    expect(document.documentElement).toHaveAttribute('lang', 'en')
    expect(localStorage.getItem(preferenceKeys.language)).toBe('en')
    await user.click(screen.getByRole('button', { name: 'Light' }))
    expect(document.documentElement).toHaveAttribute('data-theme', 'light')
    expect(localStorage.getItem(preferenceKeys.theme)).toBe('light')
    unmount()
    render(<Sidebar />)
    await user.click(screen.getByRole('button', { name: 'Open or pin navigation' }))
    expect(screen.getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Light' })).toHaveAttribute('aria-pressed', 'true')
  })
})
