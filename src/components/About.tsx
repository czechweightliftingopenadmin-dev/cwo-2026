import { useTranslation } from 'react-i18next'
import { event } from '../config/event'

export function About() {
  const { t } = useTranslation()
  return (
    <section
      id="about"
      tabIndex={-1}
      className="content-section about-section"
      aria-labelledby="about-title"
    >
      <div className="section-label">
        <span>01 /</span>
        <h2 id="about-title" className="section-title">
          {t('about.title')}
        </h2>
      </div>
      <div className="about-layout">
        <p className="event-name">
          {event.name}
          <span>{event.year}</span>
        </p>
        <div className="about-copy">
          <p className="lead-copy">{t('about.text', { year: event.year })}</p>
          <p className="muted-copy">{t('about.details')}</p>
        </div>
      </div>
    </section>
  )
}
