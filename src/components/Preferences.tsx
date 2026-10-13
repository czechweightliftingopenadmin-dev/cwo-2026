import { Moon, Sun } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useTheme } from '../hooks/useTheme'

export function Preferences() {
  const { t, i18n } = useTranslation()
  const { theme, setTheme } = useTheme()

  return (
    <div className="preferences">
      <div className="preference-row">
        <span className="control-label" id="language-label">
          {t('controls.language')}
        </span>
        <div className="segmented-control" role="group" aria-labelledby="language-label">
          <button
            type="button"
            aria-label={t('controls.czech')}
            aria-pressed={i18n.language === 'cs'}
            onClick={() => void i18n.changeLanguage('cs')}
          >
            CZ
          </button>
          <button
            type="button"
            aria-label={t('controls.english')}
            aria-pressed={i18n.language === 'en'}
            onClick={() => void i18n.changeLanguage('en')}
          >
            EN
          </button>
        </div>
      </div>
      <div className="preference-row">
        <span className="control-label" id="theme-label">
          {t('controls.theme')}
        </span>
        <div className="segmented-control" role="group" aria-labelledby="theme-label">
          <button
            type="button"
            aria-label={t('controls.dark')}
            aria-pressed={theme === 'dark'}
            onClick={() => setTheme('dark')}
          >
            <Moon size={16} aria-hidden="true" />
            <span>{t('controls.dark')}</span>
          </button>
          <button
            type="button"
            aria-label={t('controls.light')}
            aria-pressed={theme === 'light'}
            onClick={() => setTheme('light')}
          >
            <Sun size={16} aria-hidden="true" />
            <span>{t('controls.light')}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
