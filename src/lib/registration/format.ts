const timeZone = 'Europe/Prague'

export const locale = (language: string) => (language === 'en' ? 'en-GB' : 'cs-CZ')

const toDate = (iso: string) => new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso)

/** "1. listopadu" / "1 November". Window ends are exclusive, so they show the day before. */
export function formatDay(iso: string, language: string, exclusiveEnd = false): string {
  const date = new Date(toDate(iso).getTime() - (exclusiveEnd ? 1 : 0))
  return new Intl.DateTimeFormat(locale(language), {
    day: 'numeric',
    month: 'long',
    timeZone,
  }).format(date)
}

export function formatBirthDate(iso: string, language: string): string {
  return new Intl.DateTimeFormat(locale(language), {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    timeZone,
  }).format(toDate(iso))
}

export function formatDateTime(iso: string, language: string): string {
  return new Intl.DateTimeFormat(locale(language), {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
  }).format(toDate(iso))
}

export function formatPrice(amount: number, language: string): string {
  return new Intl.NumberFormat(locale(language), {
    style: 'currency',
    currency: 'CZK',
    maximumFractionDigits: 0,
  }).format(amount)
}

export const kg = (value: string | number) => `${value} kg`
