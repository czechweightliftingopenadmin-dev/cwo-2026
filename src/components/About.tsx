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
          <p className="lead-copy">{t('about.text')}</p>
          <p className="muted-copy">{t('about.details')}</p>
        </div>
      </div>
      <div className="competition-formats">
        <article className="competition-format" aria-labelledby="individuals-title">
          <div>
            <h3 id="individuals-title">{t('about.individuals.title')}</h3>
            <div className="competition-tags">
              <span>{t('about.individuals.women')}</span>
              <span>{t('about.individuals.men')}</span>
            </div>
          </div>
          <div className="competition-copy">
            <p>{t('about.individuals.description')}</p>
            <p>{t('about.individuals.scoring')}</p>
          </div>
        </article>
        <article className="competition-format" aria-labelledby="teams-title">
          <div>
            <h3 id="teams-title">{t('about.teams.title')}</h3>
            <div className="competition-tags">
              <span>{t('about.teams.members')}</span>
            </div>
          </div>
          <div className="competition-copy">
            <p>{t('about.teams.description')}</p>
            <p>{t('about.teams.scoring')}</p>
            <h4>{t('about.teams.compositionTitle')}</h4>
            <ul className="team-compositions">
              {(['womenOnly', 'threeWomen', 'balanced', 'threeMen', 'menOnly'] as const).map(
                (composition) => (
                  <li key={composition}>{t(`about.teams.${composition}`)}</li>
                ),
              )}
            </ul>
          </div>
        </article>
        <article className="competition-format" aria-labelledby="academic-title">
          <h3 id="academic-title">{t('about.academic.title')}</h3>
          <div className="competition-copy">
            <p>{t('about.academic.description')}</p>
          </div>
        </article>
      </div>
      <p className="competition-note">{t('about.sourceNote')}</p>
    </section>
  )
}
