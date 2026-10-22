import type { EventConfig, EventDates } from '../config/event'

export interface CalendarEvent {
  title: string
  /** All-day dates as YYYYMMDD; the end is exclusive, as calendars expect. */
  start: string
  end: string
  location: string
  description: string
  uid: string
}

/** The calendar day of an instant in the event's time zone, as YYYYMMDD. */
function day(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date(iso)).replaceAll('-', '')
}

export interface EventDay {
  /** YYYYMMDD of the day and of the day after. */
  start: string
  end: string
  /** Noon UTC of the day, safe for formatting it in any time zone. */
  date: Date
}

/** The competition days, from the start to the exclusive end. */
export function eventDays(dates: EventDates): EventDay[] {
  const first = day(dates.startsAt, dates.timeZone)
  const last = day(dates.endsAt, dates.timeZone)
  const stamp = (date: Date) => date.toISOString().slice(0, 10).replaceAll('-', '')
  const days: EventDay[] = []
  let date = new Date(`${first.slice(0, 4)}-${first.slice(4, 6)}-${first.slice(6)}T12:00:00Z`)
  while (stamp(date) < last) {
    const next = new Date(date.getTime() + 24 * 60 * 60 * 1000)
    days.push({ start: stamp(date), end: stamp(next), date })
    date = next
  }
  return days
}

/** The whole competition, or one of its days when `part` is given. */
export function calendarEvent(
  event: EventConfig & { dates: EventDates },
  language: 'cs' | 'en',
  description: string,
  part?: { day: EventDay; index: number; label: string },
): CalendarEvent {
  const title = `${event.name} ${event.year}`
  return {
    title: part ? `${title} · ${part.label}` : title,
    start: part ? part.day.start : day(event.dates.startsAt, event.dates.timeZone),
    end: part ? part.day.end : day(event.dates.endsAt, event.dates.timeZone),
    location: `${event.venue[language]}, ${event.address}`,
    description,
    uid: part
      ? `cwo-${event.year}-day${part.index + 1}@czechweightliftingopen.cz`
      : `cwo-${event.year}@czechweightliftingopen.cz`,
  }
}

export function googleCalendarUrl(calendar: CalendarEvent): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: calendar.title,
    dates: `${calendar.start}/${calendar.end}`,
    location: calendar.location,
    details: calendar.description,
  })
  return `https://calendar.google.com/calendar/render?${params}`
}

// RFC 5545: escape text, end lines with CRLF and fold them at 75 octets.
const escapeText = (text: string) =>
  text.replace(/[\\;,]/g, (char) => `\\${char}`).replace(/\r?\n/g, '\\n')

function fold(line: string): string {
  const bytes = new TextEncoder()
  const parts: string[] = []
  let current = ''
  for (const char of line) {
    const limit = parts.length ? 74 : 75
    if (bytes.encode(current + char).length > limit) {
      parts.push(current)
      current = char
    } else {
      current += char
    }
  }
  parts.push(current)
  return parts.join('\r\n ')
}

export function icsFile(calendar: CalendarEvent, now = new Date()): string {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Czech Weightlifting Open//CWO//CS',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${calendar.uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${calendar.start}`,
    `DTEND;VALUE=DATE:${calendar.end}`,
    `SUMMARY:${escapeText(calendar.title)}`,
    `LOCATION:${escapeText(calendar.location)}`,
    `DESCRIPTION:${escapeText(calendar.description)}`,
    'TRANSP:TRANSPARENT',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .map(fold)
    .join('\r\n')
    .concat('\r\n')
}
