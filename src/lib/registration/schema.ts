import { z } from 'zod'
import { bodyweightCategories } from '../../config/competition.js'
import {
  invoicePattern,
  minimumMenAge,
  teamSize,
  tshirtSizes,
  universities,
} from '../../config/registration.js'

// Issue messages are keys of registration.errors in the locales.
export type Sex = 'M' | 'F'

export function weightClassesFor(sex: Sex): readonly string[] {
  return sex === 'F' ? bodyweightCategories.women : bodyweightCategories.men
}

const text = (max: number) => z.string().trim().min(1, 'required').max(max, 'tooLong')
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'required')
  .pipe(z.email('invalidEmail'))
export const totalSchema = z
  .number({ error: 'required' })
  .int('wholeNumber')
  .min(0, 'totalRange')
  .max(500, 'totalRange')
const universityCodes: readonly string[] = universities.map((university) => university.code)

export const athleteSchema = z
  .object({
    firstName: text(60),
    lastName: text(60),
    birthDate: z.string().min(1, 'required').pipe(z.iso.date('invalidDate')),
    sex: z.enum(['M', 'F'], 'required'),
    weightClass: z.string(),
    total: totalSchema,
    email: emailSchema,
    phone: z
      .string()
      .trim()
      .min(1, 'required')
      .regex(/^\+?[\d\s()-]{9,20}$/, 'invalidPhone'),
    tshirtSize: z.enum(tshirtSizes).nullable(),
    cwo: z.boolean(),
    amcr: z.boolean(),
    university: z.string().nullable(),
  })
  // Runs even when single fields are invalid, so every error shows at once. The value
  // may then be incomplete, hence the defensive checks.
  .superRefine(
    (athlete, ctx) => {
      const issue = (path: string, message: string) =>
        ctx.addIssue({ code: 'custom', path: [path], message })
      if (/^\d{4}-\d{2}-\d{2}$/.test(String(athlete.birthDate))) {
        const birthYear = Number(athlete.birthDate.slice(0, 4))
        if (birthYear < 1920 || new Date(athlete.birthDate) > new Date()) {
          issue('birthDate', 'invalidDate')
        } else if (
          athlete.sex === 'M' &&
          minimumMenAge.competitionYear - birthYear < minimumMenAge.years
        ) {
          issue('birthDate', 'tooYoung')
        }
      }
      if (
        (athlete.sex === 'M' || athlete.sex === 'F') &&
        !weightClassesFor(athlete.sex).includes(athlete.weightClass)
      )
        issue('weightClass', 'required')
      if (athlete.cwo === true && !athlete.tshirtSize) issue('tshirtSize', 'required')
      if (athlete.amcr === true && !universityCodes.includes(athlete.university ?? ''))
        issue('university', 'required')
    },
    { when: () => true },
  )
  .transform((athlete) => ({
    ...athlete,
    tshirtSize: athlete.cwo ? athlete.tshirtSize : null,
    university: athlete.amcr ? athlete.university : null,
  }))

export const languageSchema = z.enum(['cs', 'en']).catch('cs')

export const registrationSchema = z
  .object({
    kind: z.enum(['individual', 'team']),
    teamName: z.string().trim().max(60, 'tooLong').nullable(),
    invoiceNumber: z.string().trim().nullable(),
    athletes: z.array(athleteSchema),
    consent: z.literal(true, 'consentRequired'),
    language: languageSchema,
  })
  .superRefine(
    (registration, ctx) => {
      const issue = (path: (string | number)[], message: string) =>
        ctx.addIssue({ code: 'custom', path, message })
      const athletes: Partial<z.output<typeof athleteSchema>>[] = Array.isArray(
        registration.athletes,
      )
        ? registration.athletes
        : []
      if (registration.kind === 'team') {
        if (!registration.teamName) issue(['teamName'], 'required')
        if (athletes.length < teamSize.min || athletes.length > teamSize.max)
          issue(['athletes'], 'teamSize')
        athletes.forEach((athlete, index) => {
          if (athlete?.cwo !== true) issue(['athletes', index, 'cwo'], 'teamMembersInCwo')
          // Members are different people, so their e-mails must differ too.
          const email = String(athlete?.email ?? '')
            .trim()
            .toLowerCase()
          const earlier = athletes.slice(0, index).map((other) =>
            String(other?.email ?? '')
              .trim()
              .toLowerCase(),
          )
          if (email && earlier.includes(email))
            issue(['athletes', index, 'email'], 'duplicateEmail')
        })
      } else {
        if (athletes.length !== 1) issue(['athletes'], 'individualSize')
        if (athletes[0] && athletes[0].cwo !== true && athletes[0].amcr !== true)
          issue(['athletes', 0, 'cwo'], 'competitionRequired')
      }
      if (athletes.some((athlete) => athlete?.cwo === true)) {
        if (!registration.invoiceNumber) issue(['invoiceNumber'], 'required')
        else if (!invoicePattern.test(registration.invoiceNumber))
          issue(['invoiceNumber'], 'invoiceFormat')
      }
    },
    { when: () => true },
  )
  .transform((registration) => ({
    ...registration,
    teamName: registration.kind === 'team' ? registration.teamName : null,
    invoiceNumber: registration.athletes.some((athlete) => athlete.cwo)
      ? registration.invoiceNumber
      : null,
  }))

export type RegistrationInput = z.input<typeof registrationSchema>
export type Registration = z.output<typeof registrationSchema>
export type AthleteInput = z.input<typeof athleteSchema>

export const lookupSchema = z.object({
  identifier: z.string().trim().min(1, 'required').max(20, 'tooLong'),
  email: emailSchema,
  language: languageSchema,
})

export const updateSchema = lookupSchema.extend({
  changes: z
    .array(z.object({ athleteId: z.uuid(), weightClass: z.string(), total: totalSchema }))
    .min(1)
    .max(teamSize.max),
})

export type LookupInput = z.input<typeof lookupSchema>
export type UpdateInput = z.input<typeof updateSchema>

export interface FieldIssue {
  path: string
  message: string
}

export function toFieldIssues(error: z.ZodError): FieldIssue[] {
  return error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }))
}

// Codes avoid 0/O and 1/I so they survive being read aloud or retyped.
const codeAlphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function generateAccessCode(hasInvoice: boolean): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  const chars = Array.from(bytes, (byte) => codeAlphabet[byte % codeAlphabet.length]).join('')
  return `${hasInvoice ? 'CW' : 'AM'}-${chars.slice(0, 4)}-${chars.slice(4)}`
}

export type Identifier = { invoiceNumber: string } | { accessCode: string } | null

/** Accepts an invoice number, or an access code with any case, spaces or dashes. */
export function parseIdentifier(value: string): Identifier {
  const compact = value.replace(/[\s-]/g, '').toUpperCase()
  if (invoicePattern.test(compact)) return { invoiceNumber: compact }
  if (/^(CW|AM)[A-Z2-9]{8}$/.test(compact))
    return { accessCode: `${compact.slice(0, 2)}-${compact.slice(2, 6)}-${compact.slice(6)}` }
  return null
}
