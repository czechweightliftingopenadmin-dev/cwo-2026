import { ArrowDownRight } from 'lucide-react'
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
        <span>{t('about.label')}</span>
      </div>
      <div className="about-layout">
        <h2 id="about-title" className="section-title whitespace-pre-line">
          {t('about.title')}
        </h2>
        <div className="about-copy">
          <p className="lead-copy">{t('about.text', { year: event.year })}</p>
          <p className="muted-copy">{t('about.details')}</p>
          <a href="#venue" className="text-link">
            {t('about.next')}
            <ArrowDownRight size={20} aria-hidden="true" />
          </a>
        </div>
      </div>
      <div className="strength-line" aria-hidden="true">
        <span>SNATCH</span>
        <span className="line-plus">+</span>
        <span>CLEAN & JERK</span>
        <span className="line-year">{event.year}</span>
      </div>
    </section>
  )
}
