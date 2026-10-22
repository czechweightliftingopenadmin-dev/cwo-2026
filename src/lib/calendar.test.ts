import { describe, expect, it } from 'vitest'
import { event } from '../config/event'
import { calendarEvent, eventDays, googleCalendarUrl, icsFile } from './calendar'

const calendar = calendarEvent(
  { ...event, dates: event.dates! },
  'cs',
  'Vzpěračská soutěž v Brně, více na https://czechweightliftingopen.cz',
)

describe('calendar event', () => {
  it('spans 21 and 22 December as an all-day event', () => {
    expect(calendar).toMatchObject({
      title: 'Czech Weightlifting Open 2026',
      start: '20261221',
      end: '20261223',
    })
  })

  it('splits the competition into days, each its own event', () => {
    const days = eventDays(event.dates!)
    expect(days.map((day) => [day.start, day.end])).toEqual([
      ['20261221', '20261222'],
      ['20261222', '20261223'],
    ])
    expect(days.map((day) => day.date.getUTCDay())).toEqual([1, 2])
    const second = calendarEvent({ ...event, dates: event.dates! }, 'cs', '', {
      day: days[1]!,
      index: 1,
      label: 'den 2',
    })
    expect(second).toMatchObject({
      title: 'Czech Weightlifting Open 2026 · den 2',
      start: '20261222',
      end: '20261223',
      uid: 'cwo-2026-day2@czechweightliftingopen.cz',
    })
  })

  it('builds a Google Calendar link', () => {
    const url = new URL(googleCalendarUrl(calendar))
    expect(url.searchParams.get('dates')).toBe('20261221/20261223')
    expect(url.searchParams.get('location')).toContain('Kamenice 753/5')
  })

  it('writes a valid iCalendar file', () => {
    const ics = icsFile(calendar, new Date('2026-10-22T10:00:00Z'))
    expect(ics).toContain('DTSTART;VALUE=DATE:20261221\r\nDTEND;VALUE=DATE:20261223\r\n')
    expect(ics).toContain('DTSTAMP:20261022T100000Z')
    // Commas are escaped, and no line exceeds 75 octets.
    expect(ics).toContain('LOCATION:Fakulta sportovních studií MU\\, Kamenice')
    for (const line of ics.split('\r\n'))
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75)
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
  })
})
