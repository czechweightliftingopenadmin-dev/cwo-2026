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
    introTitle: 'What is CWO?',
    text: 'Czech Weightlifting Open is a weightlifting competition of national to international calibre, traditionally held in Brno. It is a classic contest for individual competitors, both women and men, divided into standard bodyweight categories according to IWF and ČSV rules.',
    details:
      'A special feature of CWO is the TEAM category, where each team consists of 4 members — men, women or a mixed line-up. Individuals and teams are welcome, including beginners, advanced and experienced competitors, as well as strength sports enthusiasts of all age groups.',
    individuals: {
      title: 'Individuals',
      women: 'Women',
      men: 'Men',
      categoriesTitle: 'Bodyweight categories',
      womenDescription:
        'The individual women’s category is open to female athletes of all age groups.',
      menDescription:
        'The individual men’s category is open to male athletes who turn at least 15 in the calendar year of the competition.',
      description:
        'Women and men compete separately in bodyweight groups according to IWF and ČSV rules. Category allocation is based on the athlete’s bodyweight at the weigh-in on the day of the competition.',
      minimumParticipants:
        'At least 5 athletes are required to open a bodyweight group. If fewer athletes register, the organiser reserves the right to merge adjacent groups based on participant numbers, typically into the next higher category.',
      scoring:
        'The final ranking in each bodyweight group is determined by the highest valid total achieved — the sum of the best successful snatch and clean & jerk.',
      weighInRules:
        'Weigh-in rules for female and male athletes can be found in the ČSV competition rules and regulations.',
    },
    teams: {
      title: 'CWO Team OPEN',
      members: '4 members',
      description:
        'The CWO Team OPEN category is intended for four-member teams with a variable line-up:',
      scoring:
        'These combinations may span all bodyweight and age groups. The final ranking of all teams is determined by their team Sinclair points.',
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
        'The individual competition rules apply to both CWO and the Czech Academic Weightlifting Championships. ČSV membership is not required to compete in CWO, but it is required for the academic championships.',
    },
    rules: {
      title: 'ČSV competition rules and regulations',
      csvDocument: 'ČSV Technical and Competition Rules & Regulations',
      csvEdition: 'PDF · Czech · 2019 edition',
      iwfDocument: 'Current IWF Technical and Competition Rules & Regulations',
      iwfEdition: 'IWF website · English',
      newTab: 'Opens in a new tab',
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
