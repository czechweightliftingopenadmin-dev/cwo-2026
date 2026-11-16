// Shared by the page and the API in api/. Imports reachable from api/ use .js
// extensions, because Vercel runs the functions as native ES modules.
export interface TimeWindow {
  opensAt: string
  /** Exclusive end. */
  closesAt: string
}

export const registrationWindows = {
  registration: { opensAt: '2026-11-01T00:00:00+01:00', closesAt: '2026-12-16T00:00:00+01:00' },
  edits: { opensAt: '2026-12-07T00:00:00+01:00', closesAt: '2026-12-16T00:00:00+01:00' },
  /** The first snapshot is taken at the end of 6 December; see supabase/migrations. */
  startlist: { opensAt: '2026-12-07T00:00:00+01:00', closesAt: '2026-12-23T00:00:00+01:00' },
} as const satisfies Record<string, TimeWindow>

export type WindowState = 'upcoming' | 'open' | 'closed'

export function windowState(window: TimeWindow, now = new Date()): WindowState {
  if (now < new Date(window.opensAt)) return 'upcoming'
  return now < new Date(window.closesAt) ? 'open' : 'closed'
}

/** Confirmation e-mails. The sender's domain must be verified in Resend. Replies go to the
 *  sender's mailbox (info@ at Webglobe), or to replyTo when it is set. */
export const emailSettings = {
  from: 'CWO 2026 <info@czechweightliftingopen.cz>',
  replyTo: '',
} as const

/** First step for CWO: external application, followed by invoice payment.
 *  Athletes then return to this site to enter their competition details. */
export const applicationFormUrl = 'https://forms.gle/sq6Bbdaxo1xmtaJN7'

export const priceTiers = [
  { from: '2026-11-01', to: '2026-11-15', individual: 1226, team: 3826 },
  { from: '2026-11-16', to: '2026-12-06', individual: 1526, team: 4826 },
  { from: '2026-12-07', to: '2026-12-13', individual: 1826, team: 5626 },
] as const

/** Applying ends with the last price tier; the hero's registration button hides after it. */
export const applicationWindow = {
  opensAt: registrationWindows.registration.opensAt,
  closesAt: new Date(
    Date.parse(`${priceTiers.at(-1)!.to}T00:00:00+01:00`) + 24 * 60 * 60 * 1000,
  ).toISOString(),
} satisfies TimeWindow

export const teamSize = { min: 3, max: 4 } as const
/** One invoice covers 1–4 people: a team, or individuals from one club. */
export const invoiceMaxAthletes = 4
export const invoicePattern = /^\d{8}$/
export const tshirtSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL'] as const
/** Men must turn 15 in the calendar year of the competition. */
export const minimumMenAge = { years: 15, competitionYear: 2026 } as const

export { universities } from './schools.js'
