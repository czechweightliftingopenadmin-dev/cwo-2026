import { useTranslation } from 'react-i18next'
import { ArrowUpRight, FileText } from 'lucide-react'
import { bodyweightCategories, rulesDocuments } from '../config/competition'

export function About() {
  const { t } = useTranslation()
  return (
    <section
      id="about"
      tabIndex={-1}
      className="content-section about-section"
      aria-labelledby="about-title"
    >
      <div className="about-content">
        <div className="section-label">
          <span>01 /</span>
          <h2 id="about-title" className="section-title">
            {t('about.title')}
          </h2>
        </div>
        <div className="competition-format competition-intro">
          <h3>{t('about.introTitle')}</h3>
          <div className="competition-copy">
            <p>{t('about.text')}</p>
            <p>{t('about.details')}</p>
          </div>
        </div>
        <div className="competition-formats">
          <article className="competition-format" aria-labelledby="individuals-title">
            <div>
              <h3 id="individuals-title">{t('about.individuals.title')}</h3>
            </div>
            <div className="competition-copy">
              <p>{t('about.individuals.description')}</p>
              <h4>{t('about.individuals.categoriesTitle')}</h4>
              <dl className="bodyweight-categories">
                {(['women', 'men'] as const).map((group) => (
                  <div className="bodyweight-group" key={group}>
                    <dt>{t(`about.individuals.${group}`)}</dt>
                    <dd>
                      <p>{t(`about.individuals.${group}Description`)}</p>
                      <ul className="category-list">
                        {bodyweightCategories[group].map((weight) => (
                          <li key={weight}>{weight}&nbsp;kg</li>
                        ))}
                      </ul>
                    </dd>
                  </div>
                ))}
              </dl>
              <p>{t('about.individuals.minimumParticipants')}</p>
              <p>{t('about.individuals.scoring')}</p>
              <a className="rules-reference" href="#rules">
                {t('about.individuals.weighInRules')}
              </a>
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
              <h4>{t('about.teams.compositionTitle')}</h4>
              <ul className="team-compositions">
                {(['womenOnly', 'threeWomen', 'balanced', 'threeMen', 'menOnly'] as const).map(
                  (composition) => (
                    <li key={composition}>{t(`about.teams.${composition}`)}</li>
                  ),
                )}
              </ul>
              <p>{t('about.teams.scoring')}</p>
            </div>
          </article>
          <article className="competition-format" aria-labelledby="academic-title">
            <h3 id="academic-title">{t('about.academic.title')}</h3>
            <div className="competition-copy">
              <p>{t('about.academic.description')}</p>
            </div>
          </article>
          <article
            id="rules"
            tabIndex={-1}
            className="competition-format"
            aria-labelledby="rules-title"
          >
            <h3 id="rules-title">{t('about.rules.title')}</h3>
            <div className="competition-copy rules-documents">
              {(['csv', 'iwf'] as const).map((document) => (
                <a
                  key={document}
                  className="rules-document"
                  href={rulesDocuments[document]}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-describedby="rules-new-tab"
                >
                  <FileText size={22} aria-hidden="true" />
                  <span>
                    <span className="rules-document-title">
                      {t(`about.rules.${document}Document`)}
                    </span>
                    <span className="rules-document-meta">
                      {t(`about.rules.${document}Edition`)}
                    </span>
                  </span>
                  <ArrowUpRight size={20} aria-hidden="true" />
                </a>
              ))}
              <span id="rules-new-tab" className="sr-only">
                {t('about.rules.newTab')}
              </span>
            </div>
          </article>
        </div>
      </div>
    </section>
  )
}
