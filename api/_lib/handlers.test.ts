// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import type { RegistrationInput } from '../../src/lib/registration/schema'
import {
  createRegistration,
  getStartlist,
  lookupLimit,
  lookupRegistration,
  updateRegistration,
} from './handlers'
import type { Deps } from './handlers'
import type { Mailer } from './mailer'
import type { Store, StoredRegistration } from './store'

const duringRegistration = new Date('2026-11-20T12:00:00+01:00')
const duringEdits = new Date('2026-12-10T12:00:00+01:00')

const stored: StoredRegistration = {
  id: 'reg-1',
  kind: 'individual',
  teamName: null,
  invoiceNumber: '12345678',
  accessCode: 'CW-ABCD-EFGH',
  athletes: [
    {
      id: '6f1b8c1e-1f7a-4a8e-9c55-1d2b3c4d5e6f',
      firstName: 'Jana',
      lastName: 'Nováková',
      sex: 'F',
      weightClass: '61',
      total: 150,
      email: 'jana@example.cz',
      cwo: true,
      amcr: false,
      university: null,
      tshirtSize: 'M',
    },
  ],
}

function setup(now: Date, overrides: Partial<Store> = {}, mailer?: Mailer) {
  const store: Store = {
    createRegistration: vi.fn(async () => ({ id: 'reg-1' })),
    findRegistrations: vi.fn(async () => [stored]),
    applyChanges: vi.fn<Store['applyChanges']>(async (identifier, email, changes) => {
      // Handler tests simulate the transaction result; real constraints and atomicity
      // are exercised against the actual migrations in supabase/migration.test.ts.
      const registrations = await store.findRegistrations(identifier, email)
      const groups = registrations
        .map((registration) => {
          const changedAthletes = registration.athletes.flatMap((before) => {
            const change = changes.find((item) => item.athleteId === before.id)
            if (!change) return []
            const after = {
              ...before,
              ...(change.weightClass !== undefined
                ? { weightClass: change.weightClass, total: change.total! }
                : {}),
              ...(change.addCwo ? { cwo: true, tshirtSize: change.addCwo.tshirtSize } : {}),
              ...(change.addAmcr ? { amcr: true, university: change.addAmcr.university } : {}),
              ...(change.tshirtSize ? { tshirtSize: change.tshirtSize } : {}),
              ...(change.university ? { university: change.university } : {}),
            }
            return JSON.stringify(before) === JSON.stringify(after) ? [] : [{ before, after }]
          })
          const invoice = changes.find(
            (item) =>
              registration.athletes.some((athlete) => athlete.id === item.athleteId) && item.addCwo,
          )?.addCwo?.invoiceNumber
          return {
            registration: { ...registration, invoiceNumber: invoice ?? registration.invoiceNumber },
            changes: changedAthletes,
          }
        })
        .filter((group) => group.changes.length > 0)
      return {
        changed: groups.reduce((count, group) => count + group.changes.length, 0),
        registrations: groups,
      }
    }),
    recordLookupAttempt: vi.fn(async () => 1),
    logEmail: vi.fn(async () => {}),
    latestStartlist: vi.fn(async () => ({ publishedAt: null, isFinal: false, entries: [] })),
    ...overrides,
  }
  const send = vi.fn<Mailer['send']>(async () => 'email-1')
  const deps: Deps = {
    store,
    mailer: mailer ?? { send },
    now: () => now,
    // Date-driven, independent of the current switches in src/config/features.ts.
    features: {
      registrationSection: 'auto',
      registrationForm: 'auto',
      editForm: 'auto',
      startlist: 'auto',
    },
  }
  return { deps, store, send }
}

const post = (body: unknown) =>
  new Request('https://cwo.test/api', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.1' },
    body: JSON.stringify(body),
  })

const registration: RegistrationInput = {
  kind: 'individual',
  teamName: null,
  invoiceNumber: '12345678',
  consent: true,
  language: 'cs',
  athletes: [
    {
      firstName: 'Jana',
      lastName: 'Nováková',
      birthDate: '2000-05-01',
      sex: 'F',
      weightClass: '61',
      total: 150,
      email: 'jana@example.cz',
      phone: '777123456',
      tshirtSize: 'M',
      cwo: true,
      amcr: false,
      university: null,
    },
  ],
}

describe('createRegistration', () => {
  it('stores the registration, e-mails the athlete and returns the code', async () => {
    const { deps, store, send } = setup(duringRegistration)
    const response = await createRegistration(post(registration), deps)
    expect(response.status).toBe(201)
    const body = (await response.json()) as { accessCode: string }
    expect(body).toMatchObject({ invoiceNumber: '12345678', emailSent: true })
    expect(body.accessCode).toMatch(/^CW-/)
    expect(store.createRegistration).toHaveBeenCalledOnce()
    const message = send.mock.calls[0]![0]
    expect(message.to).toEqual(['jana@example.cz'])
    expect(message.text).toContain('12345678')
    expect(message.text).toContain('61 kg')
    expect(store.logEmail).toHaveBeenCalledWith(expect.objectContaining({ status: 'sent' }))
  })

  it('keeps the registration when the e-mail fails', async () => {
    const failing: Mailer = { send: vi.fn(async () => Promise.reject(new Error('down'))) }
    const { deps, store } = setup(duringRegistration, {}, failing)
    const response = await createRegistration(post(registration), deps)
    expect(response.status).toBe(201)
    expect(await response.json()).toMatchObject({ emailSent: false })
    expect(store.logEmail).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed', error: 'down' }),
    )
  })

  it('reports a full invoice and an athlete registered twice', async () => {
    for (const [conflict, error] of [
      ['invoiceFull', 'invoiceFull'],
      ['duplicateAthlete', 'alreadyRegistered'],
    ] as const) {
      const { deps, send } = setup(duringRegistration, {
        createRegistration: vi.fn(async () => ({ conflict })),
      })
      const response = await createRegistration(post(registration), deps)
      expect(response.status).toBe(409)
      expect(await response.json()).toEqual({ error })
      expect(send).not.toHaveBeenCalled()
    }
  })

  it('retries when a generated code already exists', async () => {
    const create = vi
      .fn<Store['createRegistration']>()
      .mockResolvedValueOnce({ conflict: 'accessCode' })
      .mockResolvedValueOnce({ id: 'reg-2' })
    const { deps } = setup(duringRegistration, { createRegistration: create })
    expect((await createRegistration(post(registration), deps)).status).toBe(201)
    expect(create).toHaveBeenCalledTimes(2)
  })

  it('returns field issues for invalid data', async () => {
    const { deps, store } = setup(duringRegistration)
    const response = await createRegistration(post({ ...registration, invoiceNumber: '1' }), deps)
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: 'validation',
      issues: [{ path: 'invoiceNumber', message: 'invoiceFormat' }],
    })
    expect(store.createRegistration).not.toHaveBeenCalled()
  })

  it('is closed outside the registration window', async () => {
    for (const now of [
      new Date('2026-10-31T23:59:00+01:00'),
      new Date('2026-12-16T00:00:00+01:00'),
    ]) {
      const { deps } = setup(now)
      expect((await createRegistration(post(registration), deps)).status).toBe(403)
    }
  })

  it('pretends success to bots without storing anything', async () => {
    const { deps, store, send } = setup(duringRegistration)
    const response = await createRegistration(post({ ...registration, website: 'spam' }), deps)
    expect(response.status).toBe(201)
    expect(store.createRegistration).not.toHaveBeenCalled()
    expect(send).not.toHaveBeenCalled()
  })

  it('answers with a generic error when the database fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { deps } = setup(duringRegistration, {
      createRegistration: vi.fn(async () => Promise.reject(new Error('db down'))),
    })
    const response = await createRegistration(post(registration), deps)
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'server' })
  })
})

describe('lookupRegistration', () => {
  const lookup = { identifier: '1234 5678', email: 'JANA@example.cz', language: 'cs' }

  it('finds the registration by invoice and e-mail without exposing the e-mail', async () => {
    const { deps, store } = setup(duringEdits)
    const response = await lookupRegistration(post(lookup), deps)
    expect(response.status).toBe(200)
    const body = (await response.json()) as { registrations: { athletes: object[] }[] }
    expect(store.findRegistrations).toHaveBeenCalledWith(
      { invoiceNumber: '12345678' },
      'jana@example.cz',
    )
    const [athlete] = body.registrations[0]!.athletes
    expect(athlete).not.toHaveProperty('email')
    expect(athlete).toMatchObject({ weightClass: '61', total: 150 })
  })

  it('gives the same answer for an unknown identifier and a wrong e-mail', async () => {
    const { deps } = setup(duringEdits, { findRegistrations: vi.fn(async () => []) })
    expect((await lookupRegistration(post(lookup), deps)).status).toBe(404)
    expect(
      (await lookupRegistration(post({ ...lookup, identifier: 'nonsense' }), deps)).status,
    ).toBe(404)
  })

  it('allows additions before 7 December but keeps results locked, and rate limits lookups', async () => {
    const early = await lookupRegistration(post(lookup), setup(duringRegistration).deps)
    expect(early.status).toBe(200)
    expect(await early.json()).toMatchObject({
      permissions: { results: false, competitions: true },
    })
    const { deps } = setup(duringEdits, { recordLookupAttempt: vi.fn(async () => lookupLimit + 1) })
    expect((await lookupRegistration(post(lookup), deps)).status).toBe(429)
  })
})

describe('updateRegistration', () => {
  const athleteId = stored.athletes[0]!.id
  const update = (weightClass: string, total: number) => ({
    identifier: '12345678',
    email: 'jana@example.cz',
    language: 'en',
    changes: [{ athleteId, weightClass, total }],
  })

  it('saves changed results and e-mails the difference', async () => {
    const { deps, store, send } = setup(duringEdits)
    const response = await updateRegistration(post(update('69', 155)), deps)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ changed: 1, emailSent: true })
    expect(store.applyChanges).toHaveBeenCalledWith(
      { invoiceNumber: '12345678' },
      'jana@example.cz',
      [{ athleteId, weightClass: '69', total: 155 }],
      { results: true, competitions: true },
    )
    const message = send.mock.calls[0]![0]
    expect(message.subject).toBe('CWO 2026 registration change')
    expect(message.text).toContain('61 kg → 69 kg')
    expect(message.text).toContain('150 kg → 155 kg')
  })

  it('does nothing when nothing changed', async () => {
    const { deps, store, send } = setup(duringEdits)
    const response = await updateRegistration(post(update('61', 150)), deps)
    expect(await response.json()).toEqual({ changed: 0, emailSent: false })
    expect(store.applyChanges).toHaveBeenCalledOnce()
    expect(send).not.toHaveBeenCalled()
  })

  it('rejects a category of the other sex', async () => {
    const { deps, store } = setup(duringEdits)
    const response = await updateRegistration(post(update('75', 150)), deps)
    expect(response.status).toBe(400)
    expect(store.applyChanges).not.toHaveBeenCalled()
  })

  it('updates and e-mails each registration on a shared invoice separately', async () => {
    const other: StoredRegistration = {
      ...stored,
      id: 'reg-2',
      accessCode: 'CW-HJKL-MNPQ',
      athletes: [
        {
          ...stored.athletes[0]!,
          id: '7a2c9d2f-2b8b-4b9f-8d66-2e3c4d5e6f70',
          firstName: 'Eva',
          email: 'jana@example.cz',
        },
      ],
    }
    const { deps, store, send } = setup(duringEdits, {
      findRegistrations: vi.fn(async () => [stored, other]),
    })
    const response = await updateRegistration(
      post({
        ...update('69', 155),
        changes: [
          { athleteId, weightClass: '69', total: 155 },
          { athleteId: other.athletes[0]!.id, weightClass: '57', total: 150 },
        ],
      }),
      deps,
    )
    expect(await response.json()).toEqual({ changed: 2, emailSent: true })
    expect(store.applyChanges).toHaveBeenCalledOnce()
    expect(send).toHaveBeenCalledTimes(2)
  })

  it('is closed after 15 December', async () => {
    const { deps } = setup(new Date('2026-12-16T00:00:01+01:00'))
    expect((await updateRegistration(post(update('69', 155)), deps)).status).toBe(403)
  })

  it('adds AM CR by invoice and by code before results editing opens', async () => {
    for (const identifier of ['12345678', 'CW-ABCD-EFGH']) {
      const { deps, store, send } = setup(duringRegistration)
      const response = await updateRegistration(
        post({
          identifier,
          email: 'jana@example.cz',
          language: 'cs',
          changes: [{ athleteId, addAmcr: { university: 'MU' } }],
        }),
        deps,
      )
      expect(response.status).toBe(200)
      expect(store.applyChanges).toHaveBeenCalledWith(
        expect.any(Object),
        'jana@example.cz',
        expect.any(Array),
        { results: false, competitions: true },
      )
      expect(send.mock.calls[0]![0].text).toContain('CWO → CWO + AM ČR')
      expect(send.mock.calls[0]![0].text).toContain('Masarykova univerzita')
    }
  })

  it('blocks early result changes and invalid schools before calling the database', async () => {
    const { deps, store } = setup(duringRegistration)
    expect((await updateRegistration(post(update('69', 155)), deps)).status).toBe(403)
    const invalid = await updateRegistration(
      post({ ...update('61', 150), changes: [{ athleteId, addAmcr: { university: 'unknown' } }] }),
      deps,
    )
    expect(invalid.status).toBe(400)
    expect(await invalid.json()).toMatchObject({
      issues: [{ path: 'changes.0.addAmcr.university', message: 'required' }],
    })
    expect(store.applyChanges).not.toHaveBeenCalled()
  })

  it('returns invoice errors on the matching field and keeps ownership failures generic', async () => {
    const { deps } = setup(duringRegistration, {
      applyChanges: vi.fn(async () => ({ error: 'invoiceFull' as const })),
    })
    const response = await updateRegistration(
      post({
        identifier: 'AM-ABCD-EFGH',
        email: 'jana@example.cz',
        changes: [{ athleteId, addCwo: { invoiceNumber: '12345678', tshirtSize: 'M' } }],
      }),
      deps,
    )
    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({
      error: 'invoiceFull',
      issues: [{ path: 'changes.0.addCwo.invoiceNumber', message: 'invoiceFull' }],
    })
    const unauthorised = setup(duringRegistration, { findRegistrations: vi.fn(async () => []) })
    expect((await updateRegistration(post(update('61', 150)), unauthorised.deps)).status).toBe(404)
    expect(unauthorised.store.applyChanges).not.toHaveBeenCalled()
  })

  it('does not report a saved change as a failed save when its email fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { deps } = setup(
      duringEdits,
      {},
      {
        send: vi.fn(async () => {
          throw new Error('mail down')
        }),
      },
    )
    const response = await updateRegistration(post(update('69', 155)), deps)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ changed: 1, emailSent: false })
  })
})

describe('feature switches', () => {
  it('opens or closes the forms regardless of the dates', async () => {
    const { deps } = setup(new Date('2026-10-22T12:00:00+02:00'))
    const on = { ...deps.features!, registrationForm: 'on' as const }
    expect((await createRegistration(post(registration), { ...deps, features: on })).status).toBe(
      201,
    )
    const off = { ...deps.features!, registrationForm: 'off' as const }
    const during = { ...deps, now: () => duringRegistration, features: off }
    expect((await createRegistration(post(registration), during)).status).toBe(403)
  })
})

describe('getStartlist', () => {
  it('serves the latest snapshot with a CDN cache', async () => {
    const { deps } = setup(duringEdits)
    const response = await getStartlist(new Request('https://cwo.test/api/startlist'), deps)
    expect(response.headers.get('cache-control')).toContain('s-maxage=300')
    expect(await response.json()).toEqual({ publishedAt: null, isFinal: false, entries: [] })
  })
})
