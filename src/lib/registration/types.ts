import type { FieldIssue, Sex } from './schema.js'

/** Error codes are keys of registration.errors in the locales. */
export type ApiErrorCode =
  | 'validation'
  | 'invoiceFull'
  | 'alreadyRegistered'
  | 'closed'
  | 'notFound'
  | 'rateLimited'
  | 'server'

export interface ApiError {
  error: ApiErrorCode
  issues?: FieldIssue[]
}

export interface CreatedRegistration {
  accessCode: string
  invoiceNumber: string | null
  emailSent: boolean
}

export interface EditableAthlete {
  id: string
  firstName: string
  lastName: string
  sex: Sex
  weightClass: string
  total: number
}

export interface EditableRegistration {
  kind: 'individual' | 'team'
  teamName: string | null
  athletes: EditableAthlete[]
}

/** Lookup answer: every registration on the invoice that includes the e-mail. */
export interface LookupResult {
  registrations: EditableRegistration[]
}

export interface UpdatedRegistration {
  changed: number
  emailSent: boolean
}

export interface StartlistEntry {
  kind: 'individual' | 'team'
  teamName: string | null
  firstName: string
  lastName: string
  sex: Sex
  weightClass: string
  total: number
  cwo: boolean
  amcr: boolean
  university: string | null
}

export interface Startlist {
  publishedAt: string | null
  isFinal: boolean
  entries: StartlistEntry[]
}
