import { Instagram, Mail } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { contacts, instagramUrl } from '../config/contacts'
import { sectionNumber } from '../config/features'

export function Contact() {
  const { t } = useTranslation()
  return (
    <section
      id="contact"
      tabIndex={-1}
      className="content-section contact-section"
      aria-labelledby="contact-title"
    >
      <div className="section-label">
        <span>{sectionNumber('contact')} /</span>
        <h2 id="contact-title" className="section-title">
          {t('contact.title')}
        </h2>
      </div>
      <ul className="contact-list">
        {contacts.map((person) => (
          <li key={person.email} className="contact-card">
            <h3 className="contact-name">{person.name}</h3>
            <p className="contact-role">{t(`contact.roles.${person.role}`)}</p>
            <ul className="contact-links">
              <li>
                <a href={`mailto:${person.email}`}>
                  <Mail size={18} aria-hidden="true" />
                  <span className="sr-only">{t('contact.email')}: </span>
                  {person.email}
                </a>
              </li>
              <li>
                <a
                  href={instagramUrl(person.instagram)}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-describedby="contact-new-tab"
                >
                  <Instagram size={18} aria-hidden="true" />
                  <span className="sr-only">Instagram: </span>@{person.instagram}
                </a>
              </li>
            </ul>
          </li>
        ))}
      </ul>
      <span id="contact-new-tab" className="sr-only">
        {t('contact.newTab')}
      </span>
    </section>
  )
}
