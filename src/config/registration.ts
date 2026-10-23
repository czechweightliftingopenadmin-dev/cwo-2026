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

/** Application and payment run through an external form; empty hides the link. */
export const applicationFormUrl = ''

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

export const universities = [
  { code: 'AMU', name: 'Akademie múzických umění v Praze' },
  { code: 'AVU', name: 'Akademie výtvarných umění v Praze' },
  { code: 'ČVUT', name: 'České vysoké učení technické v Praze' },
  { code: 'ČZU', name: 'Česká zemědělská univerzita v Praze' },
  { code: 'JAMU', name: 'Janáčkova akademie múzických umění' },
  { code: 'JU', name: 'Jihočeská univerzita v Českých Budějovicích' },
  { code: 'MENDELU', name: 'Mendelova univerzita v Brně' },
  { code: 'MU', name: 'Masarykova univerzita' },
  { code: 'OSU', name: 'Ostravská univerzita' },
  { code: 'SU', name: 'Slezská univerzita v Opavě' },
  { code: 'TUL', name: 'Technická univerzita v Liberci' },
  { code: 'UHK', name: 'Univerzita Hradec Králové' },
  { code: 'UJEP', name: 'Univerzita Jana Evangelisty Purkyně v Ústí nad Labem' },
  { code: 'UK', name: 'Univerzita Karlova' },
  { code: 'UMPRUM', name: 'Vysoká škola uměleckoprůmyslová v Praze' },
  { code: 'UNOB', name: 'Univerzita obrany' },
  { code: 'UP', name: 'Univerzita Palackého v Olomouci' },
  { code: 'UPCE', name: 'Univerzita Pardubice' },
  { code: 'UTB', name: 'Univerzita Tomáše Bati ve Zlíně' },
  { code: 'VETUNI', name: 'Veterinární univerzita Brno' },
  { code: 'VŠB-TUO', name: 'Vysoká škola báňská – Technická univerzita Ostrava' },
  { code: 'VŠCHT', name: 'Vysoká škola chemicko-technologická v Praze' },
  { code: 'VŠE', name: 'Vysoká škola ekonomická v Praze' },
  { code: 'VŠPJ', name: 'Vysoká škola polytechnická Jihlava' },
  { code: 'VŠTE', name: 'Vysoká škola technická a ekonomická v Českých Budějovicích' },
  { code: 'VŠTVS Palestra', name: 'Vysoká škola tělesné výchovy a sportu Palestra' },
  { code: 'VUT', name: 'Vysoké učení technické v Brně' },
  { code: 'ZČU', name: 'Západočeská univerzita v Plzni' },
] as const
