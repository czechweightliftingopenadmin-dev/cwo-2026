import { ArrowDown, ArrowUpRight } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  editFormState,
  canChangeRegistration,
  registrationFormState,
  sectionNumber,
  showRegisterButton,
} from '../../config/features'
import { applicationFormUrl, priceTiers, registrationWindows } from '../../config/registration'
import { formatDay, formatPrice } from '../../lib/registration/format'
import { goToSection } from '../../lib/scroll'
import { EditRegistration } from './EditRegistration'
import { RegistrationForm } from './RegistrationForm'

type Tab = 'register' | 'edit'

export function Registration() {
  const { t, i18n } = useTranslation()
  const language = i18n.language
  const registration = registrationFormState()
  const edits = editFormState()
  // Only open forms get a tab; the switcher appears when both are open.
  const tabs = (['register', 'edit'] as const).filter((value) =>
    value === 'register' ? registration === 'open' : canChangeRegistration(),
  )
  const [selected, setSelected] = useState<Tab>('register')
  const tab = tabs.includes(selected) ? selected : tabs[0]
  const day = (iso: string, exclusiveEnd = false) => formatDay(iso, language, exclusiveEnd)

  return (
    <section
      id="registration"
      tabIndex={-1}
      className="content-section registration-section"
      aria-labelledby="registration-title"
    >
      <div className="about-content">
        <div className="section-label">
          <span>{sectionNumber('registration')} /</span>
          <h2 id="registration-title" className="section-title">
            {t('registration.title')}
          </h2>
        </div>
        <div className="competition-format competition-intro">
          <h3>{t('registration.howTitle')}</h3>
          <div className="competition-copy">
            <ol className="registration-steps">
              <li>
                <strong>{t('registration.stepApplyTitle')}</strong>
                <p>{t('registration.stepApply')}</p>
                {showRegisterButton() && (
                  <a
                    className="button apply-link"
                    href={applicationFormUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {t('registration.applyLink')}
                    <ArrowUpRight size={18} aria-hidden="true" />
                  </a>
                )}
              </li>
              <li>
                <strong>{t('registration.stepRegisterTitle')}</strong>
                <p>{t('registration.stepRegister')}</p>
                {registration === 'open' && (
                  <a
                    className="button button-secondary apply-link"
                    href="#registration-details"
                    onClick={(e) => {
                      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
                      e.preventDefault()
                      setSelected('register')
                      goToSection('registration-details')
                    }}
                  >
                    {t('registration.detailsLink')}
                    <ArrowDown size={18} aria-hidden="true" />
                  </a>
                )}
              </li>
            </ol>
            <p className="registration-amcr-note">{t('registration.amcrNote')}</p>
            <h4>{t('registration.pricesTitle')}</h4>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">{t('registration.pricesPeriod')}</th>
                    <th scope="col">{t('registration.individual')}</th>
                    <th scope="col">{t('registration.team')}</th>
                  </tr>
                </thead>
                <tbody>
                  {priceTiers.map((tier) => (
                    <tr key={tier.from}>
                      <th scope="row">
                        {day(tier.from)} – {day(tier.to)}
                      </th>
                      <td>{formatPrice(tier.individual, language)}</td>
                      <td>{formatPrice(tier.team, language)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div
          id="registration-details"
          tabIndex={-1}
          className="registration-forms"
          aria-labelledby="registration-details-title"
        >
          <h3 id="registration-details-title">{t('registration.detailsTitle')}</h3>
          {tab === 'register' && (
            <p className="registration-details-intro">{t('registration.detailsIntro')}</p>
          )}
          {tabs.length > 1 && (
            <div className="tabs" role="group" aria-label={t('registration.tabsLabel')}>
              {tabs.map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={tab === value}
                  onClick={() => setSelected(value)}
                >
                  {t(value === 'register' ? 'registration.tabRegister' : 'registration.tabEdit')}
                </button>
              ))}
            </div>
          )}
          {tab === 'register' ? (
            <>
              <p className="window-note">
                {t('registration.openUntil', {
                  date: day(registrationWindows.registration.closesAt, true),
                })}
              </p>
              <RegistrationForm
                onEdit={
                  canChangeRegistration()
                    ? () => {
                        setSelected('edit')
                        goToSection('registration-details')
                      }
                    : undefined
                }
              />
              <p className="registration-confirmation">
                {t('registration.stepConfirm', {
                  from: day(registrationWindows.edits.opensAt),
                  to: day(registrationWindows.edits.closesAt, true),
                })}
              </p>
            </>
          ) : tab === 'edit' ? (
            <EditRegistration />
          ) : (
            <p className="notice">
              {registration === 'upcoming'
                ? t('registration.upcoming', {
                    date: day(registrationWindows.registration.opensAt),
                  })
                : edits === 'upcoming'
                  ? t('edit.upcoming', { date: day(registrationWindows.edits.opensAt) })
                  : t('registration.closed')}
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
