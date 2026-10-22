/** Moves focus and scroll to a section, as the navigation does, and updates the hash. */
export function goToSection(id: string) {
  const target = document.getElementById(id)
  target?.focus({ preventScroll: true })
  target?.scrollIntoView({
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
  })
  history.replaceState(null, '', `#${id}`)
}
