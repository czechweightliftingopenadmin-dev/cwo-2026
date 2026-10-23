import { useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowUpRight, ChevronDown, FileText } from 'lucide-react'
import { bodyweightCategories, rulesDocuments } from '../config/competition'
import { sectionNumber } from '../config/features'

type Part = 'intro' | 'individuals' | 'teams' | 'academic' | 'rules'

interface PartProps {
  id: Part
  title: string
  open: boolean
  onToggle: () => void
  /** Shown under the title, only while open. */
  aside?: ReactNode
  className?: string
  copyClassName?: string
  children: ReactNode
}

/** A subsection that folds to its title; open, it keeps the two-column layout. */
function CompetitionPart({
  id,
  title,
  open,
  onToggle,
  aside,
  className,
  copyClassName,
  children,
}: PartProps) {
  return (
    <article
      // The rules are a link target, so the reference can reach and focus them.
      id={id === 'rules' ? 'rules' : undefined}
      tabIndex={id === 'rules' ? -1 : undefined}
      className={['competition-format', className].filter(Boolean).join(' ')}
      data-open={open}
      aria-labelledby={`${id}-title`}
    >
      <div>
        <h3 id={`${id}-title`}>
          <button
            type="button"
            className="part-toggle"
            aria-expanded={open}
            aria-controls={`${id}-content`}
            onClick={onToggle}
          >
            <span>{title}</span>
            <ChevronDown className="part-chevron" size={24} aria-hidden="true" />
          </button>
        </h3>
        {open && aside}
      </div>
      <div
        id={`${id}-content`}
        className={['competition-copy', copyClassName].filter(Boolean).join(' ')}
        hidden={!open}
      >
        {children}
      </div>
    </article>
  )
}

export function About() {
  const { t } = useTranslation()
  const [open, setOpen] = useState<Record<Part, boolean>>({
    intro: true,
    individuals: true,
    teams: true,
    academic: true,
    rules: true,
  })
  const part = (id: Part) => ({
    id,
    open: open[id],
    onToggle: () => setOpen((current) => ({ ...current, [id]: !current[id] })),
  })

  return (
    <section
      id="about"
      tabIndex={-1}
      className="content-section about-section"
      aria-labelledby="about-title"
    >
      <div className="about-content">
        <div className="section-label">
          <span>{sectionNumber('about')} /</span>
          <h2 id="about-title" className="section-title">
            {t('about.title')}
          </h2>
        </div>
        <CompetitionPart
          {...part('intro')}
          title={t('about.introTitle')}
          className="competition-intro"
        >
          <p>{t('about.text')}</p>
          <p>{t('about.details')}</p>
        </CompetitionPart>
        <div className="competition-formats">
          <CompetitionPart {...part('individuals')} title={t('about.individuals.title')}>
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
            <a
              className="rules-reference"
              href="#rules"
              onClick={() => setOpen((current) => ({ ...current, rules: true }))}
            >
              {t('about.individuals.weighInRules')}
            </a>
          </CompetitionPart>
          <CompetitionPart
            {...part('teams')}
            title={t('about.teams.title')}
            aside={
              <div className="competition-tags">
                <span>{t('about.teams.members')}</span>
              </div>
            }
          >
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
          </CompetitionPart>
          <CompetitionPart {...part('academic')} title={t('about.academic.title')}>
            <p>{t('about.academic.description')}</p>
          </CompetitionPart>
          <CompetitionPart
            {...part('rules')}
            title={t('about.rules.title')}
            copyClassName="rules-documents"
          >
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
                  <span className="rules-document-meta">{t(`about.rules.${document}Edition`)}</span>
                </span>
                <ArrowUpRight size={20} aria-hidden="true" />
              </a>
            ))}
            <span id="rules-new-tab" className="sr-only">
              {t('about.rules.newTab')}
            </span>
          </CompetitionPart>
        </div>
      </div>
    </section>
  )
}
