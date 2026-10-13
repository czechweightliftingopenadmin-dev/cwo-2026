import { MapPin } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { event } from '../config/event'

export function Venue() {
  const { t, i18n } = useTranslation()
  const language = i18n.language === 'en' ? 'en' : 'cs'
  return (
    <section
      id="venue"
      tabIndex={-1}
      className="content-section venue-section"
      aria-labelledby="venue-title"
    >
      <div className="section-label">
        <span>02 /</span>
        <span>{t('venue.label')}</span>
      </div>
      <div className="venue-layout">
        <div className="venue-copy">
          <h2 id="venue-title" className="section-title whitespace-pre-line">
            {t('venue.title')}
          </h2>
          <div className="venue-address">
            <MapPin size={22} aria-hidden="true" />
            <div>
              <p>{event.venue[language]}</p>
              <p className="muted-copy">{t('venue.university')}</p>
            </div>
          </div>
          <p className="muted-copy venue-details">{t('venue.details')}</p>
        </div>
        <div className="venue-graphic">
          <div className="venue-rings" aria-hidden="true">
            <i />
            <i />
            <i />
            <span>+</span>
          </div>
          <span className="venue-city">{event.city.toUpperCase()}</span>
          <div className="venue-graphic-bottom">
            <span>{t('venue.country')}</span>
            <span>{event.year}</span>
          </div>
        </div>
      </div>
    </section>
  )
}
