import type { cs } from './cs'

type TranslationShape<T> = { [K in keyof T]: T[K] extends string ? string : TranslationShape<T[K]> }

export const en: TranslationShape<typeof cs> = {
  skip: 'Skip to content',
  nav: {
    label: 'Main navigation',
    toggle: 'Open or pin navigation',
    close: 'Close navigation',
    pin: 'Pin navigation',
    hint: 'Menu',
    home: 'Home',
    about: 'About the event',
    venue: 'The venue',
  },
  controls: {
    language: 'Page language',
    czech: 'Čeština',
    english: 'English',
    theme: 'Page appearance',
    dark: 'Dark',
    light: 'Light',
  },
  hero: {
    location: 'Brno · Czech Republic',
    edition: '{{year}} edition',
    date: 'Dates coming soon',
    cta: 'Event information',
  },
  about: {
    title: 'About the event',
    text: 'Weightlifting competition in Brno, {{year}} edition.',
    details: 'Event regulations and schedule are being prepared.',
  },
  countdown: {
    label: 'Until 21 December',
    days: 'Days',
    hours: 'Hours',
    minutes: 'Minutes',
    seconds: 'Seconds',
    ongoing: 'The competition is underway',
    ended: 'The competition has ended',
  },
  venue: {
    title: 'The venue',
    university: 'Masaryk University',
    country: 'Czech Republic',
    mapLabel: 'Venue map — MU Faculty of Sports Studies',
    zoomLabel: 'Map zoom',
    zoomIn: 'Zoom in',
    zoomOut: 'Zoom out',
    openMap: 'Open map',
    mapLoading: 'Loading map…',
    mapError: 'The map could not be loaded. Use the link to open it.',
  },
  footer: {
    back: 'Back to top',
  },
  meta: {
    description:
      'Czech Weightlifting Open {{year}}. Weightlifting competition on 21–22 December in Brno, MU Faculty of Sports Studies.',
  },
}
