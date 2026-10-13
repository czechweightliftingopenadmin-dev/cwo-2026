import type { cs } from './cs'

type TranslationShape<T> = { [K in keyof T]: T[K] extends string ? string : TranslationShape<T[K]> }

export const en: TranslationShape<typeof cs> = {
  skip: 'Skip to content',
  nav: {
    label: 'Main navigation',
    toggle: 'Open or pin navigation',
    close: 'Close navigation',
    pin: 'Pin navigation',
    hint: 'Explore',
    home: 'Home',
    about: 'About the event',
    venue: 'The venue',
    note: 'Weightlifting. Brno. {{year}}.',
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
    eyebrow: 'Strength has a home.',
    location: 'Brno · Czech Republic',
    edition: '{{year}} edition',
    date: 'Dates coming soon',
    caption: 'Together again. Under the bar again.',
    cta: 'Discover the event',
    scroll: 'More below',
  },
  about: {
    label: 'About the event',
    title: 'One place.\nSo much strength.',
    text: 'Czech Weightlifting Open returns to Brno in {{year}}. A place for weightlifting, meeting people and sharing moments by the competition platform.',
    details:
      'We are preparing this year’s event. Dates and more details will be announced right here.',
    next: 'See you in Brno',
  },
  venue: {
    label: 'The venue',
    title: 'Where strength\ncomes together.',
    university: 'Masaryk University',
    country: 'Czech Republic',
    details: 'Travel and organisational details will be added alongside the event information.',
  },
  footer: {
    note: 'More information soon.',
    back: 'Back to top',
  },
  meta: {
    description:
      'Czech Weightlifting Open {{year}}. Weightlifting in Brno. Dates and more information coming soon.',
  },
}
