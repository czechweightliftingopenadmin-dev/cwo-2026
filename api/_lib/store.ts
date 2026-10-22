import { createClient } from '@supabase/supabase-js'
import { invoiceMaxAthletes } from '../../src/config/registration.js'
import type { Registration, Sex } from '../../src/lib/registration/schema.js'
import type { Startlist, StartlistEntry } from '../../src/lib/registration/types.js'

export interface StoredAthlete {
  id: string
  firstName: string
  lastName: string
  sex: Sex
  weightClass: string
  total: number
  email: string
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

export interface ResultChange {
  id: string
  weightClass: string
  total: number
}

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
  updateResults(registrationId: string, changes: ResultChange[]): Promise<number>
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
      // Custom codes from the migration; 23505 is a duplicate generated access code.
      if (error?.code === 'CW001') return { conflict: 'invoiceFull' }
      if (error?.code === 'CW002') return { conflict: 'duplicateAthlete' }
      if (error?.code === '23505') return { conflict: 'accessCode' }
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

    async updateResults(registrationId, changes) {
      const { data, error } = await db.rpc('update_athlete_results', {
        p_registration_id: registrationId,
        p_changes: changes.map(({ id, weightClass, total }) => ({
          id,
          weight_class: weightClass,
          total,
        })),
      })
      if (error) throw error
      return data as number
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
        entries: data.data as StartlistEntry[],
      }
    },
  }
}
