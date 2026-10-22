import { editFormState, features, registrationFormState } from '../../src/config/features.js'
import type { Features } from '../../src/config/features.js'
import {
  generateAccessCode,
  lookupSchema,
  parseIdentifier,
  registrationSchema,
  toFieldIssues,
  updateSchema,
  weightClassesFor,
} from '../../src/lib/registration/schema.js'
import type { FieldIssue } from '../../src/lib/registration/schema.js'
import type {
  CreatedRegistration,
  EditableRegistration,
  LookupResult,
  UpdatedRegistration,
} from '../../src/lib/registration/types.js'
import { apiError, hashClient, json, readJson } from './http.js'
import type { EmailMessage, Mailer } from './mailer.js'
import type { EmailLogEntry, Store, StoredRegistration } from './store.js'
import { registrationEmail, updateEmail } from './templates.js'
import type { AthleteChange } from './templates.js'

export interface Deps {
  store: Store
  mailer: Mailer
  now: () => Date
  /** Switches from src/config/features.ts; tests pass their own. */
  features?: Features
}

/** Lookups and updates allowed per client address in 15 minutes. */
export const lookupLimit = 10
const noStore = { 'cache-control': 'no-store' }

function guard(handler: (request: Request, deps: Deps) => Promise<Response>) {
  return async (request: Request, deps: Deps | (() => Deps)) => {
    try {
      return await handler(request, typeof deps === 'function' ? deps() : deps)
    } catch (error) {
      console.error(error)
      return apiError('server')
    }
  }
}

async function sendAndLog(
  deps: Deps,
  message: EmailMessage,
  log: Pick<EmailLogEntry, 'registrationId' | 'kind'>,
): Promise<boolean> {
  try {
    const providerId = await deps.mailer.send(message)
    await deps.store.logEmail({ ...log, recipients: message.to, status: 'sent', providerId })
    return true
  } catch (error) {
    console.error('E-mail failed', error)
    await deps.store.logEmail({
      ...log,
      recipients: message.to,
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
    })
    return false
  }
}

export const createRegistration = guard(async (request, deps) => {
  const body = await readJson(request)
  // A filled hidden field means a bot; answer like a success and store nothing.
  if (body && typeof body === 'object' && 'website' in body && body.website) {
    return json(
      { accessCode: generateAccessCode(false), invoiceNumber: null, emailSent: true },
      201,
    )
  }
  if (registrationFormState(deps.now(), deps.features ?? features) !== 'open')
    return apiError('closed')

  const parsed = registrationSchema.safeParse(body)
  if (!parsed.success) return apiError('validation', toFieldIssues(parsed.error))
  const registration = parsed.data

  for (let attempt = 0; attempt < 3; attempt++) {
    const accessCode = generateAccessCode(registration.invoiceNumber !== null)
    const result = await deps.store.createRegistration(registration, accessCode)
    if ('conflict' in result) {
      if (result.conflict === 'invoiceFull') return apiError('invoiceFull')
      if (result.conflict === 'duplicateAthlete') return apiError('alreadyRegistered')
      continue
    }
    const emailSent = await sendAndLog(deps, registrationEmail(registration, accessCode), {
      registrationId: result.id,
      kind: 'registration',
    })
    const created: CreatedRegistration = {
      accessCode,
      invoiceNumber: registration.invoiceNumber,
      emailSent,
    }
    return json(created, 201, noStore)
  }
  throw new Error('Could not generate a unique access code')
})

/** Shared start of lookup and update: window, rate limit and finding the registrations. */
async function authorise(
  request: Request,
  deps: Deps,
  body: { identifier: string; email: string },
): Promise<Response | StoredRegistration[]> {
  if (editFormState(deps.now(), deps.features ?? features) !== 'open') return apiError('closed')
  const attempts = await deps.store.recordLookupAttempt(await hashClient(request))
  if (attempts > lookupLimit) return apiError('rateLimited')
  const identifier = parseIdentifier(body.identifier)
  const registrations = identifier ? await deps.store.findRegistrations(identifier, body.email) : []
  // One answer for every miss, so the endpoint does not reveal which invoices exist.
  return registrations.length ? registrations : apiError('notFound')
}

export const lookupRegistration = guard(async (request, deps) => {
  const parsed = lookupSchema.safeParse(await readJson(request))
  if (!parsed.success) return apiError('validation', toFieldIssues(parsed.error))
  const registrations = await authorise(request, deps, parsed.data)
  if (registrations instanceof Response) return registrations

  const result: LookupResult = {
    registrations: registrations.map((registration): EditableRegistration => ({
      kind: registration.kind,
      teamName: registration.teamName,
      athletes: registration.athletes.map(({ email: _email, ...athlete }) => athlete),
    })),
  }
  return json(result, 200, noStore)
})

export const updateRegistration = guard(async (request, deps) => {
  const parsed = updateSchema.safeParse(await readJson(request))
  if (!parsed.success) return apiError('validation', toFieldIssues(parsed.error))
  const registrations = await authorise(request, deps, parsed.data)
  if (registrations instanceof Response) return registrations

  const issues: FieldIssue[] = []
  const changes = new Map<StoredRegistration, AthleteChange[]>()
  parsed.data.changes.forEach((change, index) => {
    const registration = registrations.find((item) =>
      item.athletes.some((athlete) => athlete.id === change.athleteId),
    )
    const before = registration?.athletes.find((athlete) => athlete.id === change.athleteId)
    if (!registration || !before)
      issues.push({ path: `changes.${index}.athleteId`, message: 'required' })
    else if (!weightClassesFor(before.sex).includes(change.weightClass))
      issues.push({ path: `changes.${index}.weightClass`, message: 'required' })
    else if (before.weightClass !== change.weightClass || before.total !== change.total)
      changes.set(registration, [
        ...(changes.get(registration) ?? []),
        { before, weightClass: change.weightClass, total: change.total },
      ])
  })
  if (issues.length) return apiError('validation', issues)

  // Each registration gets its own update and e-mail, sent to its own athletes.
  const result: UpdatedRegistration = { changed: 0, emailSent: changes.size > 0 }
  for (const [registration, athleteChanges] of changes) {
    result.changed += await deps.store.updateResults(
      registration.id,
      athleteChanges.map(({ before, weightClass, total }) => ({
        id: before.id,
        weightClass,
        total,
      })),
    )
    const sent = await sendAndLog(
      deps,
      updateEmail(registration, athleteChanges, parsed.data.language),
      { registrationId: registration.id, kind: 'update' },
    )
    result.emailSent &&= sent
  }
  return json(result, 200, noStore)
})

export const getStartlist = guard(async (_request, deps) =>
  json(await deps.store.latestStartlist(), 200, {
    'cache-control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
  }),
)
