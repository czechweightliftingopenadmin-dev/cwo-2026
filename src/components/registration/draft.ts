import { teamSize } from '../../config/registration'
import type { Sex } from '../../lib/registration/schema'

export interface AthleteDraft {
  firstName: string
  lastName: string
  birthDate: string
  sex: Sex
  weightClass: string
  total: string
  email: string
  phone: string
  tshirtSize: string
  cwo: boolean
  amcr: boolean
  university: string
}

export interface Draft {
  kind: 'individual' | 'team'
  teamName: string
  invoiceNumber: string
  athletes: AthleteDraft[]
  consent: boolean
  /** Honeypot, hidden from people. */
  website: string
}

export const emptyAthlete = (cwo = true): AthleteDraft => ({
  firstName: '',
  lastName: '',
  birthDate: '',
  sex: 'F',
  weightClass: '',
  total: '',
  email: '',
  phone: '',
  tshirtSize: '',
  cwo,
  amcr: false,
  university: '',
})

export const emptyDraft = (): Draft => ({
  kind: 'individual',
  teamName: '',
  invoiceNumber: '',
  athletes: [emptyAthlete()],
  consent: false,
  website: '',
})

/** Switching the type keeps the first athlete, so nothing typed is lost. */
export function withKind(draft: Draft, kind: Draft['kind']): Draft {
  const [first = emptyAthlete()] = draft.athletes
  if (kind === 'individual') return { ...draft, kind, athletes: [first] }
  const athletes = [{ ...first, cwo: true }, ...draft.athletes.slice(1)]
  while (athletes.length < teamSize.min) athletes.push(emptyAthlete())
  return { ...draft, kind, athletes }
}

export const needsInvoice = (draft: Draft) =>
  draft.kind === 'team' || draft.athletes.some((athlete) => athlete.cwo)

/** Formats typing into "DD. MM. YYYY": digits past a full day or month flow into the next
 *  part ("01052000" → "01. 05. 2000"), and own separators are kept ("1.5.2000" → "1. 5. 2000"). */
export function maskBirthDate(value: string): string {
  const groups = value.split(/\D+/).filter(Boolean)
  const parts: string[] = []
  const limits = [2, 2, 4]
  while (groups.length && parts.length < limits.length) {
    const group = groups.shift()!
    const limit = limits[parts.length]!
    parts.push(group.slice(0, limit))
    if (group.length > limit) groups.unshift(group.slice(limit))
  }
  // Keep a separator the user just typed, so "1." can continue with the month.
  const trailing = parts.length < 3 && /\D\s*$/.test(value) ? value.match(/\D+$/)![0] : ''
  return parts.join('. ') + (parts.length ? trailing : '')
}

/** "1. 5. 2000", "01.05.2000" or "2000-05-01" becomes "2000-05-01"; anything else stays
 *  as typed and fails validation. */
export function normaliseBirthDate(value: string): string {
  const pad = (part: string) => part.padStart(2, '0')
  const trimmed = value.trim()
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(trimmed)
  if (iso) return `${iso[1]}-${pad(iso[2]!)}-${pad(iso[3]!)}`
  const local = /^(\d{1,2})\s*[./]\s*(\d{1,2})\s*[./]\s*(\d{4})$/.exec(trimmed)
  if (local) return `${local[3]}-${pad(local[2]!)}-${pad(local[1]!)}`
  return trimmed
}

/** The shape registrationSchema expects; empty strings become missing values. */
export function toInput(draft: Draft, language: string) {
  return {
    kind: draft.kind,
    teamName: draft.kind === 'team' ? draft.teamName : null,
    invoiceNumber: needsInvoice(draft) ? draft.invoiceNumber.replace(/\s/g, '') : null,
    athletes: draft.athletes.map((athlete) => ({
      ...athlete,
      birthDate: normaliseBirthDate(athlete.birthDate),
      total: athlete.total.trim() === '' ? undefined : Number(athlete.total),
      tshirtSize: athlete.tshirtSize || null,
      university: athlete.university || null,
    })),
    consent: draft.consent,
    language,
  }
}

// Kept for the browser session, so a reload or an accidental tab switch loses nothing.
const storageKey = 'cwo:registration-draft'

export function loadDraft(): Draft {
  try {
    const stored = sessionStorage.getItem(storageKey)
    if (stored) return { ...emptyDraft(), ...(JSON.parse(stored) as Partial<Draft>), website: '' }
  } catch {
    // Storage can be unavailable; start empty.
  }
  return emptyDraft()
}

export function saveDraft(draft: Draft | null) {
  try {
    if (draft) sessionStorage.setItem(storageKey, JSON.stringify(draft))
    else sessionStorage.removeItem(storageKey)
  } catch {
    // Not saving the draft only costs convenience.
  }
}
