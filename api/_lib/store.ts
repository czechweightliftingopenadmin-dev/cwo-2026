import { createClient } from '@supabase/supabase-js'
import { invoiceMaxAthletes } from '../../src/config/registration.js'
import type {
  AthleteUpdate,
  Identifier,
  Registration,
  Sex,
} from '../../src/lib/registration/schema.js'
import type { ApiErrorCode, Startlist, StartlistEntry } from '../../src/lib/registration/types.js'

export interface StoredAthlete {
  id: string
  firstName: string
  lastName: string
  sex: Sex
  weightClass: string
  total: number
  email: string
  cwo: boolean
  amcr: boolean
  university: string | null
  tshirtSize: string | null
}

export interface StoredRegistration {
  id: string
  kind: 'individual' | 'team'
  teamName: string | null
  invoiceNumber: string | null
  accessCode: string
  athletes: StoredAthlete[]
}

export type CreateResult =
  { id: string } | { conflict: 'invoiceFull' | 'duplicateAthlete' | 'accessCode' }

export interface AthleteChange {
  before: StoredAthlete
  after: StoredAthlete
}
export interface AppliedChanges {
  changed: number
  registrations: { registration: StoredRegistration; changes: AthleteChange[] }[]
}
export type ApplyResult = AppliedChanges | { error: ApiErrorCode }

export interface EmailLogEntry {
  registrationId: string
  kind: 'registration' | 'update'
  recipients: string[]
  status: 'sent' | 'failed'
  providerId?: string
  error?: string
}

export interface Store {
  createRegistration(registration: Registration, accessCode: string): Promise<CreateResult>
  /** Active registrations on the invoice (or with the code) that include the e-mail. */
  findRegistrations(
    identifier: { invoiceNumber: string } | { accessCode: string },
    email: string,
  ): Promise<StoredRegistration[]>
  applyChanges(
    identifier: NonNullable<Identifier>,
    email: string,
    changes: AthleteUpdate[],
    permissions: { results: boolean; competitions: boolean },
  ): Promise<ApplyResult>
  recordLookupAttempt(ipHash: string): Promise<number>
  logEmail(entry: EmailLogEntry): Promise<void>
  latestStartlist(): Promise<Startlist>
}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing environment variable ${name}`)
  return value
}

export function createSupabaseStore(): Store {
  const db = createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SECRET_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  return {
    async createRegistration(registration, accessCode) {
      const { athletes, ...rest } = registration
      const { data, error } = await db.rpc('create_registration', {
        p_registration: { ...rest, accessCode },
        p_athletes: athletes,
        p_invoice_limit: invoiceMaxAthletes,
      })
      // Distinguish identity conflicts from the rare generated-code collision.
      if (error?.code === 'CW001') return { conflict: 'invoiceFull' }
      if (error?.code === 'CW002') return { conflict: 'duplicateAthlete' }
      if (error?.code === '23505') {
        if (error.message.includes('athletes_active_identity_key'))
          return { conflict: 'duplicateAthlete' }
        if (error.message.includes('registrations_access_code_key'))
          return { conflict: 'accessCode' }
      }
      if (error) throw error
      return { id: data as string }
    },

    async findRegistrations(identifier, email) {
      const { data, error } = await db.rpc('find_registrations', {
        p_invoice: 'invoiceNumber' in identifier ? identifier.invoiceNumber : null,
        p_code: 'accessCode' in identifier ? identifier.accessCode : null,
        p_email: email,
      })
      if (error) throw error
      return (data as StoredRegistration[] | null) ?? []
    },

    async applyChanges(identifier, email, changes, permissions) {
      const { data, error } = await db.rpc('apply_registration_changes', {
        p_invoice: 'invoiceNumber' in identifier ? identifier.invoiceNumber : null,
        p_code: 'accessCode' in identifier ? identifier.accessCode : null,
        p_email: email,
        p_changes: changes,
        p_results_open: permissions.results,
        p_competitions_open: permissions.competitions,
        p_invoice_limit: invoiceMaxAthletes,
      })
      const errors: Record<string, ApiErrorCode> = {
        CW001: 'invoiceFull',
        CW002: 'alreadyRegistered',
        CW003: 'notFound',
        CW004: 'changeConflict',
        CW005: 'resultsClosed',
        CW006: 'competitionsClosed',
      }
      if (error && errors[error.code]) return { error: errors[error.code]! }
      if (error) throw error
      return data as AppliedChanges
    },

    async recordLookupAttempt(ipHash) {
      const { data, error } = await db.rpc('record_lookup_attempt', { p_ip_hash: ipHash })
      if (error) throw error
      return data as number
    },

    async logEmail(entry) {
      const { error } = await db.from('email_log').insert({
        registration_id: entry.registrationId,
        kind: entry.kind,
        recipients: entry.recipients,
        status: entry.status,
        provider_id: entry.providerId ?? null,
        error: entry.error ?? null,
      })
      // The registration is already saved; a missing log line must not fail the request.
      if (error) console.error('email_log insert failed', error)
    },

    async latestStartlist() {
      const { data, error } = await db
        .from('startlist_snapshots')
        .select('published_at, is_final, data')
        .order('published_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      if (!data) return { publishedAt: null, isFinal: false, entries: [] }
      return {
        publishedAt: data.published_at as string,
        isFinal: data.is_final as boolean,
        // Snapshots also hold the birth year; the public start list leaves it out.
        entries: (data.data as (StartlistEntry & { birthYear?: number })[]).map(
          ({ birthYear: _birthYear, ...entry }) => entry,
        ),
      }
    },
  }
}
