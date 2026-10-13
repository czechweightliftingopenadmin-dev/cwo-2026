import { describe, expect, it } from 'vitest'
import { event } from '../config/event'
import { formatEventDates, getEventPhase } from './countdown'

const dates = event.dates!

describe('event dates', () => {
  it('starts at midnight in Prague, independently of the visitor time zone', () => {
    expect(Date.parse(dates.startsAt)).toBe(Date.UTC(2026, 11, 20, 23))
    expect(getEventPhase(dates, Date.UTC(2026, 11, 20, 22, 59, 59))).toBe('upcoming')
    expect(getEventPhase(dates, Date.UTC(2026, 11, 20, 23))).toBe('ongoing')
  })

  it('stays ongoing through 22 December and ends at the following midnight', () => {
    expect(getEventPhase(dates, Date.UTC(2026, 11, 22, 22, 59, 59))).toBe('ongoing')
    expect(getEventPhase(dates, Date.UTC(2026, 11, 22, 23))).toBe('ended')
  })

  it('formats the same two competition days in both languages', () => {
    for (const language of ['cs', 'en'] as const) {
      const label = formatEventDates(dates, language)
      expect(label).toMatch(/21/)
      expect(label).toMatch(/22/)
      expect(label).toMatch(language === 'cs' ? /12/ : /December/)
      expect(label).toMatch(/2026/)
      expect(label).not.toMatch(/23/)
    }
  })
})
