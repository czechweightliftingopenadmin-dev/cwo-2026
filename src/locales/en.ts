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
  },
  about: {
    title: 'About the event',
    introTitle: 'Snatch & clean and jerk',
    text: 'Czech Weightlifting Open is a weightlifting competition in Brno for beginners and experienced lifters. Athletes compete in the snatch and clean & jerk.',
    details: 'The event combines women’s and men’s individual categories with CWO Team OPEN.',
    individuals: {
      title: 'Individuals',
      women: 'Women',
      men: 'Men',
      categoriesTitle: 'Bodyweight categories',
      description:
        'Women and men compete separately in bodyweight categories. Category allocation is based on bodyweight at the competition weigh-in.',
      scoring:
        'Placings are determined by the highest valid total: the sum of the best successful snatch and clean & jerk.',
    },
    teams: {
      title: 'CWO Team OPEN',
      members: '4 members',
      description:
        'Teams can be women’s, men’s or mixed. Members may come from different bodyweight and age groups.',
      scoring:
        'Teams are ranked by their team Sinclair points, which allow performances at different bodyweights to be compared.',
      compositionTitle: 'Four-member line-ups',
      womenOnly: '4 women',
      threeWomen: '3 women + 1 man',
      balanced: '2 women + 2 men',
      threeMen: '1 woman + 3 men',
      menOnly: '4 men',
    },
    academic: {
      title: 'AM ČR',
      description:
        'CWO is accompanied by the Czech Academic Weightlifting Championships. Eligibility requirements and the 2026 event regulations will be published separately.',
    },
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
