export interface EventDates {
  startsAt: string
  /** Exclusive end: midnight after the last competition day. */
  endsAt: string
  timeZone: string
}

export interface EventConfig {
  name: string
  year: number
  dates: EventDates | null
  venue: { cs: string; en: string }
  city: string
  address: string
  coordinates: [longitude: number, latitude: number]
  /** Path to a future export in public/, e.g. /artwork/banner.webp. */
  bannerBackground?: string
}

export const event: EventConfig = {
  name: 'Czech Weightlifting Open',
  year: 2026,
  dates: {
    startsAt: '2026-12-21T00:00:00+01:00',
    endsAt: '2026-12-23T00:00:00+01:00',
    timeZone: 'Europe/Prague',
  },
  venue: {
    cs: 'Fakulta sportovních studií MU',
    en: 'MU Faculty of Sports Studies',
  },
  city: 'Brno',
  address: 'Kamenice 753/5, 625 00 Brno',
  coordinates: [16.5687, 49.1785],
  bannerBackground: '/banner.jpg',
}
