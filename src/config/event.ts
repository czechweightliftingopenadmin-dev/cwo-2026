export interface EventConfig {
  name: string
  year: number
  date: string | null
  venue: { cs: string; en: string }
  city: string
  /** Path to a future export in public/, e.g. /artwork/banner.webp. */
  bannerBackground?: string
}

export const event: EventConfig = {
  name: 'Czech Weightlifting Open',
  year: 2026,
  date: null,
  venue: {
    cs: 'Fakulta sportovních studií MU',
    en: 'MU Faculty of Sports Studies',
  },
  city: 'Brno',
}
