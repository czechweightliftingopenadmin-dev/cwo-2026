import { useEffect } from 'react'
import { ArrowUp } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Sidebar } from './components/Sidebar'
import { Hero } from './components/Hero'
import { About } from './components/About'
import { Venue } from './components/Venue'
import { event } from './config/event'

export default function App() {
  const { t, i18n } = useTranslation()

  useEffect(() => {
    document.title = `${event.name} ${event.year}`
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute('content', t('meta.description', { year: event.year }))
    document.documentElement.lang = i18n.language === 'en' ? 'en' : 'cs'
  }, [t, i18n.language])

  return (
    <>
      <a href="#main" className="skip-link">
        {t('skip')}
      </a>
      <Sidebar />
      <main id="main" tabIndex={-1} className="page-content">
        <Hero />
        <About />
        <Venue />
        <footer className="footer">
          <span className="footer-brand">
            CWO <span>{event.year}</span>
          </span>
          <span className="footer-note">{t('footer.note')}</span>
          <a href="#home" className="footer-top">
            {t('footer.back')}
            <ArrowUp size={18} aria-hidden="true" />
          </a>
        </footer>
      </main>
    </>
  )
}
