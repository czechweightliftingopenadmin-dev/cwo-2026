import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { getLanguage, preferenceKeys, savePreference } from './lib/preferences'
import { cs } from './locales/cs'
import { en } from './locales/en'

void i18n.use(initReactI18next).init({
  resources: { cs: { translation: cs }, en: { translation: en } },
  lng: getLanguage(),
  fallbackLng: 'cs',
  supportedLngs: ['cs', 'en'],
  interpolation: { escapeValue: false },
  initAsync: false,
})

i18n.on('languageChanged', (language) => {
  document.documentElement.lang = language === 'en' ? 'en' : 'cs'
  savePreference(preferenceKeys.language, document.documentElement.lang)
})
document.documentElement.lang = i18n.language === 'en' ? 'en' : 'cs'

export default i18n
