import { Popover, PopoverButton, PopoverPanel } from '@headlessui/react'
import { ArrowDown, CalendarPlus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { event } from '../config/event'
import { isVisible } from '../config/features'
import { calendarEvent, eventDays, googleCalendarUrl, icsFile } from '../lib/calendar'
import type { CalendarEvent } from '../lib/calendar'
import { locale } from '../lib/registration/format'
import { goToSection } from '../lib/scroll'

const siteUrl = 'https://czechweightliftingopen.cz'

export function HeroActions() {
  const { t, i18n } = useTranslation()
  const language = i18n.language === 'en' ? 'en' : 'cs'
  const dates = event.dates
  const description = t('hero.calendarDescription', { url: siteUrl })

  // One row per competition day, then the whole competition.
  const options: { label: string; calendar: CalendarEvent }[] = dates
    ? [
        ...eventDays(dates).map((day, index) => {
          const weekday = new Intl.DateTimeFormat(locale(language), {
            weekday: 'long',
            timeZone: 'UTC',
          }).format(day.date)
          const date = new Intl.DateTimeFormat(locale(language), {
            day: 'numeric',
            month: language === 'cs' ? 'numeric' : 'short',
            timeZone: 'UTC',
          }).format(day.date)
          return {
            label: `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} ${date}`,
            calendar: calendarEvent({ ...event, dates }, language, description, {
              day,
              index,
              label: t('hero.calendarDay', { number: index + 1 }),
            }),
          }
        }),
        {
          label: t('hero.calendarWhole'),
          calendar: calendarEvent({ ...event, dates }, language, description),
        },
      ]
    : []

  return (
    <div className="hero-actions">
      {isVisible('registration') && (
        <a
          href="#registration"
          className="button"
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
            e.preventDefault()
            goToSection('registration')
          }}
        >
          {t('hero.register')}
          <ArrowDown size={18} aria-hidden="true" />
        </a>
      )}
      {options.length > 0 && (
        <Popover className="calendar-popover">
          <PopoverButton className="button button-secondary">
            <CalendarPlus size={18} aria-hidden="true" />
            {t('hero.addToCalendar')}
          </PopoverButton>
          <PopoverPanel
            anchor={{ to: 'bottom end', gap: 6 }}
            className="calendar-panel calendar-choices"
          >
            <ul>
              {options.map(({ label, calendar }) => (
                <li key={calendar.uid}>
                  <span className="calendar-choice-label">{label}</span>
                  <span className="calendar-choice-links">
                    <a
                      href={googleCalendarUrl(calendar)}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${label}: ${t('hero.calendarGoogle')}`}
                    >
                      Google
                    </a>
                    <a
                      href={`data:text/calendar;charset=utf-8,${encodeURIComponent(icsFile(calendar))}`}
                      download={`${calendar.uid.split('@')[0]}.ics`}
                      aria-label={`${label}: ${t('hero.calendarIcs')}`}
                    >
                      Apple / Outlook
                    </a>
                  </span>
                </li>
              ))}
            </ul>
          </PopoverPanel>
        </Popover>
      )}
    </div>
  )
}
