import { ArrowUpRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { event } from '../config/event'
import { formatEventDates } from '../lib/countdown'
import { Countdown } from './Countdown'

export function Hero() {
  const { t, i18n } = useTranslation()
  const language = i18n.language === 'en' ? 'en' : 'cs'

  return (
    <section
      id="home"
      tabIndex={-1}
      className="hero"
      data-has-background={Boolean(event.bannerBackground)}
      aria-labelledby="event-title"
    >
      {event.bannerBackground && (
        <div
          className="hero-export"
          style={{ backgroundImage: `url(${JSON.stringify(event.bannerBackground)})` }}
          aria-hidden="true"
        />
      )}
      <div className="hero-art" aria-hidden="true">
        <div className="weight-disc">
          <span>{String(event.year).slice(-2)}</span>
          <i />
          <i />
          <i />
        </div>
        <div className="barbell-line" />
        <div className="art-dots" />
      </div>
      <div className="hero-top">
        <span className="eyebrow">CWO {event.year}</span>
      </div>
      <div className="hero-body">
        <p className="edition-label">[ {t('hero.edition', { year: event.year })} ]</p>
        <h1 id="event-title" className="hero-title">
          {event.name.toUpperCase()}
          <span className="sr-only">{event.year}</span>
        </h1>
        <div className="hero-event-details">
          <div className="date-announcement">
            <p>{event.dates ? formatEventDates(event.dates, language) : t('hero.date')}</p>
          </div>
          <p className="hero-venue">
            {event.venue[language]} · {event.city}
          </p>
        </div>
        {event.dates && <Countdown dates={event.dates} />}
      </div>
      <div className="hero-bottom">
        <a href="#about" className="hero-cta">
          <span>{t('hero.cta')}</span>
          <span className="cta-icon">
            <ArrowUpRight size={24} aria-hidden="true" />
          </span>
        </a>
      </div>
    </section>
  )
}
