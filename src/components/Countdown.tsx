import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import FlipClockCountdown from '@leenguyen/react-flip-clock-countdown'
import '@leenguyen/react-flip-clock-countdown/dist/index.css'
import type { EventDates } from '../config/event'
import { getEventPhase } from '../lib/countdown'

export function Countdown({ dates }: { dates: EventDates }) {
  const { t } = useTranslation()
  const [phase, setPhase] = useState(() => getEventPhase(dates, Date.now()))

  useEffect(() => {
    if (phase === 'ended') return
    const update = () => setPhase(getEventPhase(dates, Date.now()))
    const interval = window.setInterval(update, 60000)
    document.addEventListener('visibilitychange', update)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', update)
    }
  }, [dates, phase])

  if (phase !== 'upcoming')
    return (
      <p className="event-status" role="status">
        {t(`countdown.${phase}`)}
      </p>
    )

  return (
    <div className="countdown">
      <FlipClockCountdown
        className="flip-clock"
        to={Date.parse(dates.startsAt)}
        labels={[
          t('countdown.days'),
          t('countdown.hours'),
          t('countdown.minutes'),
          t('countdown.seconds'),
        ]}
        duration={0.5}
        showSeparators={false}
        digitBlockStyle={{ fontFamily: 'var(--font-display)', fontWeight: 500 }}
        labelStyle={{
          fontFamily: 'var(--font-sans)',
          fontWeight: 500,
          textTransform: 'uppercase',
          letterSpacing: '.04em',
        }}
        stopOnHiddenVisibility
        onComplete={() => setPhase(getEventPhase(dates, Date.now()))}
        role="timer"
        aria-label={t('countdown.label')}
        aria-live="off"
      />
    </div>
  )
}
