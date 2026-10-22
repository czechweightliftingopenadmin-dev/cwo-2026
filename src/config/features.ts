import { registrationWindows, windowState } from './registration.js'
import type { TimeWindow, WindowState } from './registration.js'

/**
 * Přepínače sekcí a formulářů. Po změně stačí web znovu nasadit.
 *
 *   'auto' — řídí se termíny v src/config/registration.ts
 *   'on'   — zobrazeno / otevřeno hned, bez ohledu na termín
 *   'off'  — skryto / zavřeno
 *
 * Formuláře hlídá podle stejného nastavení i server, takže 'on' u formuláře
 * znamená, že registrace opravdu jde odeslat.
 */

/** Produkce: czechweightliftingopen.cz (větev main, databáze cwo-prod). */
const production = {
  /** Sekce Registrace v menu a na stránce. 'auto': od otevření registrace do konce změn. */
  registrationSection: 'auto',
  /** Registrační formulář. 'auto': 1. 11. – 15. 12. */
  registrationForm: 'auto',
  /** Změna registrace (hmotnostní kategorie a dvojboj). 'auto': 7. 12. – 15. 12. */
  editForm: 'auto',
  /** Sekce Startovní listina. 'auto': od 7. 12. */
  startlist: 'auto',
} satisfies Features

/** Dev a lokální vývoj (větev dev, databáze cwo-dev): vše zapnuté, ať jde všechno testovat. */
const testing = {
  registrationSection: 'on',
  registrationForm: 'on',
  editForm: 'on',
  startlist: 'on',
} satisfies Features

// The server knows its environment from VERCEL_ENV; the page gets VITE_DEPLOY_ENV, set
// to "production" only in the Vercel production environment.
const deployEnv =
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
    ?.VERCEL_ENV ??
  (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_DEPLOY_ENV

export const isProduction = deployEnv === 'production'
export const features: Features = isProduction ? production : testing

export type Switch = 'auto' | 'on' | 'off'
export type Features = Record<
  'registrationSection' | 'registrationForm' | 'editForm' | 'startlist',
  Switch
>

export function resolve(value: Switch, window: TimeWindow, now = new Date()): WindowState {
  if (value === 'on') return 'open'
  if (value === 'off') return 'closed'
  return windowState(window, now)
}

export const registrationFormState = (now = new Date(), config: Features = features) =>
  resolve(config.registrationForm, registrationWindows.registration, now)

export const editFormState = (now = new Date(), config: Features = features) =>
  resolve(config.editForm, registrationWindows.edits, now)

export function isVisible(
  section: 'registration' | 'startlist',
  now = new Date(),
  config: Features = features,
): boolean {
  if (section === 'startlist')
    return (
      config.startlist === 'on' ||
      (config.startlist === 'auto' &&
        windowState(registrationWindows.startlist, now) !== 'upcoming')
    )
  if (config.registrationSection !== 'auto') return config.registrationSection === 'on'
  return registrationFormState(now, config) === 'open' || editFormState(now, config) === 'open'
}

/** Content sections in page order; their labels are numbered by position. */
export function visibleSections(now = new Date(), config: Features = features) {
  return (['about', 'registration', 'startlist', 'venue'] as const).filter(
    (id) => (id !== 'registration' && id !== 'startlist') || isVisible(id, now, config),
  )
}

export function sectionNumber(id: ReturnType<typeof visibleSections>[number], now = new Date()) {
  return String(visibleSections(now).indexOf(id) + 1).padStart(2, '0')
}
