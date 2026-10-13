import type { EventDates } from '../config/event'
import type { Language } from './preferences'

export function getEventPhase(dates: EventDates, now: number) {
  if (now < Date.parse(dates.startsAt)) return 'upcoming'
  return now < Date.parse(dates.endsAt) ? 'ongoing' : 'ended'
}

export function formatEventDates(dates: EventDates, language: Language) {
  const start = new Date(dates.startsAt)
  const end = new Date(Date.parse(dates.endsAt) - 1)
  const formatter = new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : 'cs-CZ', {
    day: 'numeric',
    month: language === 'en' ? 'long' : 'numeric',
    year: 'numeric',
    timeZone: dates.timeZone,
  })
  if (language === 'cs') {
    const startParts = formatter.formatToParts(start)
    const endParts = formatter.formatToParts(end)
    const part = (parts: Intl.DateTimeFormatPart[], type: string) =>
      parts.find((value) => value.type === type)?.value
    if (
      part(startParts, 'month') === part(endParts, 'month') &&
      part(startParts, 'year') === part(endParts, 'year')
    ) {
      return `${part(startParts, 'day')}.–${part(endParts, 'day')}. ${part(endParts, 'month')}. ${part(endParts, 'year')}`
    }
  }
  return formatter.formatRange(start, end)
}
