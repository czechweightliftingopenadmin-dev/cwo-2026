// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

// Runs the real migrations in an in-memory Postgres. pg_cron and the Supabase roles
// do not exist there, so the scheduler call is skipped and the roles are created.
const migrationsDir = join(import.meta.dirname, 'migrations')
const migrations = readdirSync(migrationsDir)
  .sort()
  .map((file) => readFileSync(join(migrationsDir, file), 'utf8'))
  .join('\n')
  .replace(/^create extension if not exists pg_cron.*$/m, '')
  .replace(/^select cron\.schedule\([\s\S]*?\);$/m, '')

let db: PGlite

beforeEach(async () => {
  db = new PGlite()
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;`)
  await db.exec(migrations)
})
afterEach(async () => {
  await db.close()
})

const athlete = (overrides: Record<string, unknown> = {}) => ({
  firstName: 'Jana',
  lastName: 'Nováková',
  birthDate: '2000-05-01',
  sex: 'F',
  nationality: 'CZE',
  weightClass: '61',
  total: 150,
  email: 'jana@example.cz',
  phone: '777123456',
  tshirtSize: 'M',
  cwo: true,
  amcr: false,
  university: null,
  ...overrides,
})

async function create(
  registration: Record<string, unknown> = {},
  athletes = [athlete()],
): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    'select public.create_registration($1, $2, 4) as id',
    [
      {
        kind: 'individual',
        invoiceNumber: '12345678',
        accessCode: 'CW-ABCD-EFGH',
        teamName: null,
        language: 'cs',
        ...registration,
      },
      athletes,
    ],
  )
  return rows[0]!.id
}

async function audit() {
  const { rows } = await db.query<{
    id: number
    table_name: string
    action: string
    source: string
  }>('select id, table_name, action, source from public.audit_log order by id')
  return rows
}

describe('registration migration', () => {
  it('creates a team with its athletes in order and audits it as the API', async () => {
    const id = await create({ kind: 'team', teamName: 'Brno' }, [
      athlete(),
      athlete({ firstName: 'Petr', sex: 'M', weightClass: '75', email: 'petr@example.cz' }),
      athlete({ firstName: 'Eva', email: 'eva@example.cz' }),
    ])
    const { rows } = await db.query<{ first_name: string; position: number }>(
      'select first_name, position from public.athletes where registration_id = $1 order by position',
      [id],
    )
    expect(rows.map((row) => row.first_name)).toEqual(['Jana', 'Petr', 'Eva'])
    expect((await audit()).map((entry) => entry.source)).toEqual(['api', 'api', 'api', 'api'])
  })

  it('rolls back the whole registration when an athlete is invalid', async () => {
    await expect(create({}, [athlete({ total: 900 })])).rejects.toThrow()
    const { rows } = await db.query('select * from public.registrations')
    expect(rows).toHaveLength(0)
  })

  it('shares an invoice among up to 4 people, each registered once', async () => {
    const person = (n: number) => athlete({ firstName: `Osoba${n}`, email: `osoba${n}@example.cz` })
    await create({ accessCode: 'CW-AAAA-AAAA' }, [person(1)])
    await create({ accessCode: 'CW-AAAA-AAAB' }, [person(2), person(3)])
    // The same e-mail, or the same name and date of birth, is the same person.
    await expect(
      create({ accessCode: 'CW-AAAA-AAAC' }, [
        athlete({ firstName: 'Jiná', email: 'osoba1@example.cz' }),
      ]),
    ).rejects.toMatchObject({ code: 'CW002' })
    await expect(
      create({ accessCode: 'CW-AAAA-AAAC' }, [
        athlete({ firstName: 'OSOBA2', email: 'nova@example.cz' }),
      ]),
    ).rejects.toMatchObject({ code: 'CW002' })
    await create({ accessCode: 'CW-AAAA-AAAD' }, [person(4)])
    await expect(create({ accessCode: 'CW-AAAA-AAAE' }, [person(5)])).rejects.toMatchObject({
      code: 'CW001',
    })
    // A cancelled registration frees its places.
    await db.query(
      `update public.registrations set status = 'cancelled' where access_code = 'CW-AAAA-AAAD'`,
    )
    await expect(create({ accessCode: 'CW-AAAA-AAAE' }, [person(5)])).resolves.toBeTruthy()
    await expect(create({ invoiceNumber: '87654321', accessCode: 'CW-AAAA-AAAA' })).rejects.toThrow(
      'access_code',
    )
  })

  it('finds a registration only with a matching e-mail', async () => {
    await create({ invoiceNumber: null, accessCode: 'AM-ABCD-EFGH' }, [
      athlete({ cwo: false, amcr: true, university: 'MU', tshirtSize: null }),
    ])
    const find = async (invoice: string | null, code: string | null, email: string) =>
      (
        await db.query<{ result: { athletes: { email: string }[] }[] }>(
          'select public.find_registrations($1, $2, $3) as result',
          [invoice, code, email],
        )
      ).rows[0]!.result
    expect((await find(null, 'AM-ABCD-EFGH', ' Jana@Example.cz '))[0]?.athletes).toHaveLength(1)
    expect(await find(null, 'AM-ABCD-EFGH', 'other@example.cz')).toEqual([])
    expect(await find('12345678', null, 'jana@example.cz')).toEqual([])
  })

  it('updates only changed results and keeps the previous state restorable', async () => {
    const id = await create()
    const { rows: athletes } = await db.query<{ id: string }>('select id from public.athletes')
    const athleteId = athletes[0]!.id
    const update = async (weightClass: string, total: number) =>
      (
        await db.query<{ changed: number }>(
          'select public.update_athlete_results($1, $2) as changed',
          [id, [{ id: athleteId, weight_class: weightClass, total }]],
        )
      ).rows[0]!.changed
    expect(await update('61', 150)).toBe(0)
    expect(await update('69', 160)).toBe(1)
    expect(await update('69', 160)).toBe(0)

    // An organiser's mistake in the dashboard, then the undo.
    await db.query(`update public.athletes set last_name = 'Oops', total = 0`)
    const mistake = (await audit()).at(-1)!
    expect(mistake).toMatchObject({ table_name: 'athletes', action: 'UPDATE', source: 'dashboard' })
    await db.query('select public.restore_from_audit($1)', [mistake.id])
    const { rows } = await db.query('select last_name, weight_class, total from public.athletes')
    expect(rows).toEqual([{ last_name: 'Nováková', weight_class: '69', total: 160 }])
    expect((await audit()).at(-1)!.source).toBe(`restore:${mistake.id}`)
  })

  it('restores a deleted registration with its athletes', async () => {
    await create()
    await db.query('delete from public.registrations')
    const deleted = (await audit()).filter((entry) => entry.action === 'DELETE')
    for (const table of ['registrations', 'athletes']) {
      const entry = deleted.find((item) => item.table_name === table)!
      await db.query('select public.restore_from_audit($1)', [entry.id])
    }
    const { rows } = await db.query('select first_name from public.registrations_overview')
    expect(rows).toEqual([{ first_name: 'Jana' }])
  })

  it('publishes start list snapshots without cancelled registrations or contacts', async () => {
    await create()
    const cancelled = await create({ invoiceNumber: '87654321', accessCode: 'CW-ZZZZ-ZZZZ' }, [
      athlete({ firstName: 'Zrušená' }),
    ])
    await db.query(`update public.registrations set status = 'cancelled' where id = $1`, [
      cancelled,
    ])
    await db.query('select public.publish_startlist_snapshot(true)')
    const { rows } = await db.query<{ is_final: boolean; data: Record<string, unknown>[] }>(
      'select is_final, data from public.startlist_snapshots',
    )
    expect(rows[0]!.is_final).toBe(true)
    expect(rows[0]!.data).toEqual([
      expect.objectContaining({ firstName: 'Jana', birthYear: 2000, weightClass: '61' }),
    ])
    expect(rows[0]!.data[0]).not.toHaveProperty('email')
  })

  it('counts lookup attempts per address', async () => {
    const attempt = async (ip: string) =>
      (await db.query<{ count: number }>('select public.record_lookup_attempt($1) as count', [ip]))
        .rows[0]!.count
    await attempt('a')
    expect(await attempt('a')).toBe(2)
    expect(await attempt('b')).toBe(1)
  })

  it('lets the API role do its work without default grants', async () => {
    // PGlite roles start without privileges, like a project with automatic exposure off.
    await db.exec('set role service_role')
    const id = await create()
    expect(
      (
        await db.query('select public.find_registrations($1, null, $2) as r', [
          '12345678',
          'jana@example.cz',
        ])
      ).rows[0],
    ).toBeTruthy()
    await db.query('select public.record_lookup_attempt($1)', ['ip'])
    await db.query(
      `insert into public.email_log (registration_id, kind, recipients, status) values ($1, 'registration', '{a@b.cz}', 'sent')`,
      [id],
    )
    await db.query('select public.publish_startlist_snapshot()')
    await db.query('select * from public.startlist_snapshots')
    await db.query('select * from public.registrations_overview')
    await expect(db.query('select public.restore_from_audit(1)')).rejects.toThrow(
      'permission denied',
    )
  })

  it('gives the public roles no access', async () => {
    await create()
    await db.exec('set role anon')
    await expect(db.query('select * from public.athletes')).rejects.toThrow('permission denied')
    await expect(db.query('select public.find_registrations(null, null, null)')).rejects.toThrow(
      'permission denied',
    )
  })
})

async function applyChanges(
  identifier: string,
  changes: Record<string, unknown>[],
  options: { email?: string; results?: boolean; competitions?: boolean } = {},
) {
  return (
    await db.query<{
      result: {
        changed: number
        registrations: { registration: Record<string, unknown>; changes: unknown[] }[]
      }
    }>('select public.apply_registration_changes($1, $2, $3, $4, $5, $6, 4) as result', [
      /^\d{8}$/.test(identifier) ? identifier : null,
      /^\d{8}$/.test(identifier) ? null : identifier,
      options.email ?? 'jana@example.cz',
      changes,
      options.results ?? true,
      options.competitions ?? true,
    ])
  ).rows[0]!.result
}
async function onlyAthlete() {
  return (await db.query<{ id: string }>('select id from public.athletes')).rows[0]!.id
}
const amOnly = () => athlete({ cwo: false, amcr: true, university: 'MU', tshirtSize: null })

describe('identity protection and competition changes', () => {
  it('blocks duplicate AM CR and cross-invoice registrations with a normalised identity', async () => {
    await create({ invoiceNumber: null, accessCode: 'AM-AAAA-AAAA' }, [amOnly()])
    const before = await audit()
    await expect(
      create({ invoiceNumber: null, accessCode: 'AM-AAAA-AAAB' }, [amOnly()]),
    ).rejects.toMatchObject({ code: '23505' })
    expect(await audit()).toEqual(before)
    // Registering with CWO takes over the AM ČR-only registration, despite spacing and case.
    await create({ invoiceNumber: '87654321', accessCode: 'CW-AAAA-AAAC' }, [
      athlete({ firstName: ' JANA ', lastName: '  NOVÁKOVÁ  ' }),
    ])
    await expect(
      create({ invoiceNumber: '11223344', accessCode: 'CW-AAAA-AAAD' }, [athlete()]),
    ).rejects.toMatchObject({ code: '23505' })
    const { rows } = await db.query(
      'select access_code, status from public.registrations order by access_code',
    )
    expect(rows).toEqual([
      { access_code: 'AM-AAAA-AAAA', status: 'cancelled' },
      { access_code: 'CW-AAAA-AAAC', status: 'active' },
    ])
  })

  it('handles two simultaneous submissions as one athlete and rolls back the losing registration', async () => {
    const results = await Promise.allSettled([
      create({ invoiceNumber: null, accessCode: 'AM-AAAA-AAAA' }, [amOnly()]),
      create({ invoiceNumber: null, accessCode: 'AM-AAAA-AAAB' }, [amOnly()]),
    ])
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect((await db.query('select * from public.athletes')).rows).toHaveLength(1)
    expect((await db.query('select * from public.registrations')).rows).toHaveLength(1)
  })

  it('tells people apart by name and date of birth, not by e-mail', async () => {
    await create({ invoiceNumber: null, accessCode: 'AM-AAAA-AAAA' }, [amOnly()])
    // Same name, another date of birth: another person.
    await create({ invoiceNumber: null, accessCode: 'AM-AAAA-AAAB' }, [
      athlete({ ...amOnly(), birthDate: '2001-05-01' }),
    ])
    // Another person sharing the e-mail, e.g. a parent's address.
    await create({ invoiceNumber: null, accessCode: 'AM-AAAA-AAAC' }, [
      athlete({ ...amOnly(), firstName: 'Petra' }),
    ])
    // The same person under another e-mail is refused.
    await expect(
      create({ invoiceNumber: null, accessCode: 'AM-AAAA-AAAD' }, [
        athlete({ ...amOnly(), email: 'other@example.cz' }),
      ]),
    ).rejects.toMatchObject({ code: '23505' })
    expect((await db.query('select * from public.athletes')).rows).toHaveLength(3)
  })

  it('protects direct inserts and cancellation/reactivation as well as the API', async () => {
    const id = await create({ invoiceNumber: null, accessCode: 'AM-AAAA-AAAA' }, [amOnly()])
    await db.query('update public.athletes set registration_active = false')
    expect((await db.query('select registration_active from public.athletes')).rows[0]).toEqual({
      registration_active: true,
    })
    await db.query("update public.registrations set status = 'cancelled' where id = $1", [id])
    await create({ invoiceNumber: null, accessCode: 'AM-AAAA-AAAB' }, [amOnly()])
    await expect(
      db.query("update public.registrations set status = 'active' where id = $1", [id]),
    ).rejects.toMatchObject({ code: '23505' })
    expect((await db.query('select * from public.public_startlist')).rows).toHaveLength(1)
  })

  it('adds CWO to AM CR in place, preserves the original code and makes the invoice usable', async () => {
    const registrationId = await create({ invoiceNumber: null, accessCode: 'AM-AAAA-AAAA' }, [
      amOnly(),
    ])
    const athleteId = await onlyAthlete()
    const request = [{ athleteId, addCwo: { invoiceNumber: '12345678', tshirtSize: 'M' } }]
    const result = await applyChanges('AM-AAAA-AAAA', request, { results: false })
    expect(result.changed).toBe(1)
    expect(result.registrations[0]!.registration).toMatchObject({
      id: registrationId,
      invoiceNumber: '12345678',
      accessCode: 'AM-AAAA-AAAA',
    })
    expect(
      (await db.query('select id, cwo, amcr, university, tshirt_size from public.athletes')).rows,
    ).toEqual([{ id: athleteId, cwo: true, amcr: true, university: 'MU', tshirt_size: 'M' }])
    for (const [invoice, code] of [
      ['12345678', null],
      [null, 'AM-AAAA-AAAA'],
    ]) {
      const found = await db.query<{ result: unknown[] }>(
        'select public.find_registrations($1, $2, $3) as result',
        [invoice, code, 'JANA@example.cz'],
      )
      expect(found.rows[0]!.result).toHaveLength(1)
    }
    const before = await audit()
    expect((await applyChanges('AM-AAAA-AAAA', request)).changed).toBe(0)
    expect(await audit()).toEqual(before)
    expect((await db.query('select * from public.public_startlist')).rows).toHaveLength(1)
    expect(
      (await applyChanges('12345678', [{ athleteId, university: 'UK', tshirtSize: 'L' }])).changed,
    ).toBe(1)
  })

  it('adds AM CR by invoice or code, with a university, and does not duplicate team members', async () => {
    await create({ kind: 'team', teamName: 'Brno' }, [
      athlete(),
      athlete({ firstName: 'Eva', email: 'eva@example.cz' }),
      athlete({ firstName: 'Petr', email: 'petr@example.cz' }),
    ])
    const athleteId = (
      await db.query<{ id: string }>("select id from public.athletes where first_name = 'Jana'")
    ).rows[0]!.id
    expect(
      (
        await applyChanges('12345678', [{ athleteId, addAmcr: { university: 'MU' } }], {
          results: false,
        })
      ).changed,
    ).toBe(1)
    expect((await applyChanges('CW-ABCD-EFGH', [{ athleteId, university: 'UK' }])).changed).toBe(1)
    expect((await db.query('select * from public.athletes')).rows).toHaveLength(3)
    expect((await db.query('select kind from public.registrations')).rows).toEqual([
      { kind: 'team' },
    ])
  })

  it('rejects missing invoice, T-shirt or school without changing anything', async () => {
    await create({ invoiceNumber: null, accessCode: 'AM-AAAA-AAAA' }, [amOnly()])
    const athleteId = await onlyAthlete()
    for (const addCwo of [
      { tshirtSize: 'M' },
      { invoiceNumber: '12345678' },
      { invoiceNumber: 'bad', tshirtSize: 'M' },
    ]) {
      await expect(applyChanges('AM-AAAA-AAAA', [{ athleteId, addCwo }])).rejects.toMatchObject({
        code: 'CW004',
      })
    }
    expect((await db.query('select cwo from public.athletes')).rows).toEqual([{ cwo: false }])
    expect((await db.query('select invoice_number from public.registrations')).rows).toEqual([
      { invoice_number: null },
    ])
  })

  it('rechecks authentication and rejects a foreign athlete even with a valid invoice', async () => {
    await create()
    const athleteId = await onlyAthlete()
    const change = [{ athleteId, addAmcr: { university: 'MU' } }]
    await expect(
      applyChanges('12345678', change, { email: 'wrong@example.cz' }),
    ).rejects.toMatchObject({ code: 'CW003' })
    await expect(applyChanges('AM-AAAA-AAAA', change)).rejects.toMatchObject({ code: 'CW003' })
    await expect(
      applyChanges('12345678', [{ athleteId: crypto.randomUUID(), total: 160, weightClass: '61' }]),
    ).rejects.toMatchObject({ code: 'CW003' })
    expect((await db.query('select amcr from public.athletes')).rows).toEqual([{ amcr: false }])
  })

  it('enforces both editing windows inside the database and rolls back a mixed request', async () => {
    await create()
    const athleteId = await onlyAthlete()
    const before = await audit()
    await expect(
      applyChanges(
        '12345678',
        [{ athleteId, weightClass: '69', total: 155, addAmcr: { university: 'MU' } }],
        { results: false },
      ),
    ).rejects.toMatchObject({ code: 'CW005' })
    await expect(
      applyChanges(
        '12345678',
        [{ athleteId, weightClass: '69', total: 155, addAmcr: { university: 'MU' } }],
        { competitions: false },
      ),
    ).rejects.toMatchObject({ code: 'CW006' })
    expect(await audit()).toEqual(before)
    expect((await db.query('select total, amcr from public.athletes')).rows).toEqual([
      { total: 150, amcr: false },
    ])
  })

  it('checks invoice capacity for an upgrade and leaves the AM CR entry intact on failure', async () => {
    for (let n = 0; n < 4; n++)
      await create({ accessCode: `CW-AAAA-AAA${'ABCD'[n]}` }, [
        athlete({ firstName: `Person${n}`, email: `person${n}@example.cz` }),
      ])
    const id = await create({ invoiceNumber: null, accessCode: 'AM-AAAA-AAAA' }, [amOnly()])
    const athleteId = (
      await db.query<{ id: string }>('select id from public.athletes where registration_id = $1', [
        id,
      ])
    ).rows[0]!.id
    await expect(
      applyChanges('AM-AAAA-AAAA', [
        { athleteId, addCwo: { invoiceNumber: '12345678', tshirtSize: 'M' } },
      ]),
    ).rejects.toMatchObject({ code: 'CW001' })
    expect(
      (await db.query('select invoice_number from public.registrations where id = $1', [id]))
        .rows[0],
    ).toEqual({ invoice_number: null })
  })

  it('does not let a retried or stale request replace the saved invoice', async () => {
    await create()
    const athleteId = await onlyAthlete()
    await expect(
      applyChanges('12345678', [
        { athleteId, addCwo: { invoiceNumber: '87654321', tshirtSize: 'M' } },
      ]),
    ).rejects.toMatchObject({ code: 'CW004' })
    expect((await db.query('select invoice_number from public.registrations')).rows).toEqual([
      { invoice_number: '12345678' },
    ])
  })

  it('keeps private update functions inaccessible to anonymous callers', async () => {
    await create()
    const athleteId = await onlyAthlete()
    await db.exec('set role anon')
    await expect(
      applyChanges('12345678', [{ athleteId, addAmcr: { university: 'MU' } }]),
    ).rejects.toThrow('permission denied')
    await expect(
      db.query('select public.registration_details($1)', [crypto.randomUUID()]),
    ).rejects.toThrow('permission denied')
  })
})

describe('migration rollout and legacy backup compatibility', () => {
  it('refuses pre-existing active duplicates without merging or deleting their data', async () => {
    await db.close()
    db = new PGlite()
    await db.exec(
      'create role anon; create role authenticated; create role service_role bypassrls;',
    )
    const files = readdirSync(migrationsDir).sort()
    const changes = files.indexOf('20261030000000_registration_changes.sql')
    const original = files
      .slice(0, changes)
      .map((file) => readFileSync(join(migrationsDir, file), 'utf8'))
      .join('\n')
      .replace(/^create extension if not exists pg_cron.*$/m, '')
      .replace(/^select cron\.schedule\([\s\S]*?\);$/m, '')
    await db.exec(original)
    await create({ invoiceNumber: null, accessCode: 'AM-AAAA-AAAA' }, [amOnly()])
    await create({ invoiceNumber: null, accessCode: 'AM-AAAA-AAAB' }, [amOnly()])
    await expect(
      db.exec('begin;\n' + readFileSync(join(migrationsDir, files[changes]!), 'utf8')),
    ).rejects.toThrow('Duplicate active athletes exist')
    await db.exec('rollback')
    expect((await db.query('select * from public.athletes')).rows).toHaveLength(2)
    expect((await db.query('select * from public.registrations')).rows).toHaveLength(2)
  })

  it('rebuilds active identity flags with restore triggers disabled without adding audit entries', async () => {
    const cancelled = await create({ invoiceNumber: null, accessCode: 'AM-AAAA-AAAA' }, [amOnly()])
    await db.query("update public.registrations set status = 'cancelled' where id = $1", [
      cancelled,
    ])
    await create({ invoiceNumber: null, accessCode: 'AM-AAAA-AAAB' }, [amOnly()])
    const before = await audit()
    await db.exec(
      'set session_replication_role = replica; update public.athletes set registration_active = false;',
    )
    await db.exec(
      "update public.athletes a set registration_active = (r.status = 'active') from public.registrations r where r.id = a.registration_id;",
    )
    await db.exec('set session_replication_role = origin')
    expect(
      (
        await db.query(
          'select registration_active from public.athletes order by registration_active',
        )
      ).rows,
    ).toEqual([{ registration_active: false }, { registration_active: true }])
    expect(await audit()).toEqual(before)
    await expect(
      create({ invoiceNumber: null, accessCode: 'AM-AAAA-AAAC' }, [amOnly()]),
    ).rejects.toMatchObject({ code: '23505' })
  })
})

describe('nationality and the weight class overview', () => {
  const nationality = async () =>
    (await db.query<{ nationality: string | null }>('select nationality from public.athletes'))
      .rows[0]!.nationality

  it('stores a three-letter code and leaves registrations from older clients empty', async () => {
    await create()
    expect(await nationality()).toBe('CZE')
    await db.exec('delete from public.registrations')
    const { nationality: _omitted, ...legacy } = athlete()
    await create({}, [legacy as ReturnType<typeof athlete>])
    expect(await nationality()).toBeNull()
    for (const invalid of ['cze', 'CZ', 'CZEE'])
      await expect(
        create({ invoiceNumber: '87654321', accessCode: 'CW-ZZZZ-ZZZZ' }, [
          athlete({ email: 'other@example.cz', firstName: 'Other', nationality: invalid }),
        ]),
      ).rejects.toThrow('athletes_nationality_check')
  })

  it('publishes the nationality and exports it to organisers', async () => {
    await create()
    await db.query('select public.publish_startlist_snapshot()')
    const { rows } = await db.query<{ data: Record<string, unknown>[] }>(
      'select data from public.startlist_snapshots',
    )
    expect(rows[0]!.data[0]).toMatchObject({ nationality: 'CZE' })
    const overview = await db.query<Record<string, unknown>>(
      'select * from public.registrations_overview',
    )
    expect(overview.rows[0]).toMatchObject({ nationality: 'CZE', first_name: 'Jana' })
    expect(overview.fields.map((field) => field.name).slice(7, 11)).toEqual([
      'birth_date',
      'sex',
      'nationality',
      'weight_class',
    ])
  })

  it('restores a nationality change, but keeps a hand-filled one when restoring older history', async () => {
    await create()
    await db.exec(`update public.athletes set nationality = 'SVK'`)
    await db.query('select public.restore_from_audit($1)', [(await audit()).at(-1)!.id])
    expect(await nationality()).toBe('CZE')

    // History saved before the migration has no nationality key.
    await db.exec(`update public.athletes set nationality = 'POL'`)
    await db.exec('update public.athletes set total = 160')
    const older = (await audit()).at(-1)!.id
    await db.query(
      `update public.audit_log set old_data = old_data - 'nationality' where id = $1`,
      [older],
    )
    await db.query('select public.restore_from_audit($1)', [older])
    const { rows } = await db.query<{ total: number; nationality: string }>(
      'select total, nationality from public.athletes',
    )
    expect(rows[0]).toEqual({ total: 150, nationality: 'POL' })
  })

  it('counts active athletes per weight class, women first and heavyweights last', async () => {
    await create({ kind: 'team', teamName: 'Brno' }, [
      athlete(),
      athlete({ firstName: 'Petr', sex: 'M', weightClass: '+110', email: 'petr@example.cz' }),
      athlete({ firstName: 'Pavel', sex: 'M', weightClass: '110', email: 'pavel@example.cz' }),
    ])
    await create({ invoiceNumber: null, accessCode: 'AM-ABCD-EFGH' }, [
      athlete({
        firstName: 'Eva',
        email: 'eva@example.cz',
        cwo: false,
        amcr: true,
        university: 'MU',
        tshirtSize: null,
      }),
    ])
    const cancelled = await create({ invoiceNumber: '87654321', accessCode: 'CW-ZZZZ-ZZZZ' }, [
      athlete({ firstName: 'Zrušená', email: 'zrusena@example.cz' }),
    ])
    await db.query(`update public.registrations set status = 'cancelled' where id = $1`, [
      cancelled,
    ])
    const { rows } = await db.query('select * from public.prehled_vahovek')
    expect(rows).toEqual([
      { cislo: 1, pohlavi: 'Ženy', vahovka: '61', celkem: 2, cwo: 1, amcr: 1 },
      { cislo: 2, pohlavi: 'Muži', vahovka: '110', celkem: 1, cwo: 1, amcr: 0 },
      { cislo: 3, pohlavi: 'Muži', vahovka: '+110', celkem: 1, cwo: 1, amcr: 0 },
    ])
    // The Table Editor sorts by the first column; that must keep the same order.
    expect((await db.query('select * from public.prehled_vahovek order by 1')).rows).toEqual(rows)
  })

  it('shows the overview to the API role only', async () => {
    await create()
    await db.exec('set role service_role')
    await db.query('select * from public.prehled_vahovek')
    await db.exec('reset role; set role anon')
    await expect(db.query('select * from public.prehled_vahovek')).rejects.toThrow(
      'permission denied',
    )
  })
})

describe('start list preview for organisers', () => {
  it('lists each sex by category from the lightest, then by total from the highest', async () => {
    await create({ kind: 'team', teamName: 'Brno' }, [
      athlete({ firstName: 'Anna', weightClass: '86', total: 160, email: 'anna@example.cz' }),
      athlete({ firstName: 'Bára', weightClass: '+86', total: 200, email: 'bara@example.cz' }),
      athlete({ firstName: 'Cecílie', weightClass: '49', total: 110, email: 'cecilie@example.cz' }),
      athlete({ firstName: 'Petr', sex: 'M', weightClass: '110', email: 'petr@example.cz' }),
    ])
    await create({ invoiceNumber: '87654321', accessCode: 'CW-ZZZZ-ZZZZ' }, [
      athlete({ firstName: 'Dana', weightClass: '49', total: 130, email: 'dana@example.cz' }),
      athlete({
        firstName: 'Ema',
        weightClass: '86',
        total: 150,
        email: 'ema@example.cz',
        nationality: 'SVK',
        cwo: false,
        amcr: true,
        university: 'MU',
        tshirtSize: null,
      }),
    ])
    const cancelled = await create({ invoiceNumber: null, accessCode: 'AM-ZZZZ-ZZZZ' }, [
      athlete({
        firstName: 'Zrušená',
        weightClass: '49',
        total: 300,
        email: 'z@example.cz',
        cwo: false,
        amcr: true,
        university: 'MU',
        tshirtSize: null,
      }),
    ])
    await db.query(`update public.registrations set status = 'cancelled' where id = $1`, [
      cancelled,
    ])

    // The Table Editor ignores the view's order and sorts by the first column.
    const women = await db.query<Record<string, unknown>>(
      'select * from public.startovka_zeny order by 1',
    )
    expect(
      women.rows.map((row) => [row.cislo, row.vahovka, row.poradi_v_kategorii, row.jmeno]),
    ).toEqual([
      [1, '49 kg', 1, 'Dana'],
      [2, '49 kg', 2, 'Cecílie'],
      [3, '86 kg', 1, 'Anna'],
      [4, '86 kg', 2, 'Ema'],
      [5, '+86 kg', 1, 'Bára'],
    ])
    expect(women.fields[0]!.name).toBe('cislo')
    expect(women.rows[3]).toMatchObject({
      narodnost: 'SVK',
      rocnik: 2000,
      dvojboj: 150,
      soutez: 'AM ČR',
      tym: null,
      skola: 'MU',
    })
    expect(women.rows[0]).toMatchObject({ soutez: 'CWO', tym: null })
    expect(women.rows[2]).toMatchObject({ tym: 'Brno' })
    expect((await db.query('select jmeno from public.startovka_muzi')).rows).toEqual([
      { jmeno: 'Petr' },
    ])
  })

  it('shows the preview to the API role only', async () => {
    await db.exec('set role service_role')
    await db.query('select * from public.startovka_zeny, public.startovka_muzi')
    await db.exec('reset role; set role anon')
    await expect(db.query('select * from public.startovka_zeny')).rejects.toThrow(
      'permission denied',
    )
    await expect(db.query('select * from public.startovka_muzi')).rejects.toThrow(
      'permission denied',
    )
  })
})

describe('one person, one registration', () => {
  const team = (member: ReturnType<typeof athlete>) => [
    athlete({ firstName: 'Anna', email: 'anna@example.cz' }),
    athlete({ firstName: 'Bára', email: 'bara@example.cz' }),
    member,
  ]
  const registrations = async () =>
    (
      await db.query<{ access_code: string; status: string; note: string | null }>(
        'select access_code, status, note from public.registrations order by created_at, access_code',
      )
    ).rows

  it('moves an AM ČR-only athlete into a CWO team with their school, under another e-mail', async () => {
    await create({ invoiceNumber: null, accessCode: 'AM-AAAA-AAAA' }, [amOnly()])
    await create({ kind: 'team', teamName: 'Brno' }, team(athlete({ email: 'captain@example.cz' })))

    const [old, current] = await registrations()
    expect(old).toMatchObject({ access_code: 'AM-AAAA-AAAA', status: 'cancelled' })
    expect(old!.note).toContain('Sloučeno do registrace CW-ABCD-EFGH')
    expect(current).toMatchObject({ access_code: 'CW-ABCD-EFGH', status: 'active' })
    const { rows } = await db.query(
      `select first_name, cwo, amcr, university from public.public_startlist where first_name = 'Jana'`,
    )
    expect(rows).toEqual([{ first_name: 'Jana', cwo: true, amcr: true, university: 'MU' }])
    // Undoing the merge would make the person active twice, so it is refused.
    const cancel = (await audit()).find(
      (entry) => entry.table_name === 'registrations' && entry.action === 'UPDATE',
    )!
    await expect(
      db.query('select public.restore_from_audit($1)', [cancel.id]),
    ).rejects.toMatchObject({
      code: '23505',
    })
  })

  it('keeps a school chosen in the new registration', async () => {
    await create({ invoiceNumber: null, accessCode: 'AM-AAAA-AAAA' }, [amOnly()])
    await create({}, [athlete({ amcr: true, university: 'ČVUT' })])
    const { rows } = await db.query('select amcr, university from public.public_startlist')
    expect(rows).toEqual([{ amcr: true, university: 'ČVUT' }])
  })

  it('refuses every other second registration and leaves everything unchanged', async () => {
    await create()
    const before = await registrations()
    // Already in CWO: joining a team is a conflict, not a merge.
    await expect(
      create(
        { kind: 'team', teamName: 'Brno', invoiceNumber: '87654321', accessCode: 'CW-ZZZZ-ZZZZ' },
        team(athlete({ email: 'captain@example.cz' })),
      ),
    ).rejects.toMatchObject({ code: '23505' })
    // AM ČR only, twice.
    await db.exec('delete from public.registrations')
    await create({ invoiceNumber: null, accessCode: 'AM-AAAA-AAAA' }, [amOnly()])
    await expect(
      create({ invoiceNumber: null, accessCode: 'AM-AAAA-AAAB' }, [
        athlete({ ...amOnly(), email: 'other@example.cz' }),
      ]),
    ).rejects.toMatchObject({ code: '23505' })
    expect((await registrations()).map((row) => row.status)).toEqual(['active'])
    expect(before).toHaveLength(1)
  })

  it('does not take over an AM ČR team member', async () => {
    await create(
      { kind: 'team', teamName: 'Brno' },
      team(athlete({ amcr: true, university: 'MU' })),
    )
    await expect(
      create(
        { kind: 'team', teamName: 'Praha', invoiceNumber: '87654321', accessCode: 'CW-ZZZZ-ZZZZ' },
        [
          athlete({ firstName: 'Cyril', sex: 'M', weightClass: '75', email: 'cyril@example.cz' }),
          athlete({ firstName: 'Dita', email: 'dita@example.cz' }),
          athlete({ email: 'another@example.cz' }),
        ],
      ),
    ).rejects.toMatchObject({ code: '23505' })
    expect((await registrations()).map((row) => row.status)).toEqual(['active'])
  })

  it('refuses to install while one person is active twice, without merging anyone', async () => {
    await db.close()
    db = new PGlite()
    await db.exec(
      'create role anon; create role authenticated; create role service_role bypassrls;',
    )
    const files = readdirSync(migrationsDir).sort()
    const merge = files.indexOf('20261116150000_identity_merge.sql')
    await db.exec(
      files
        .slice(0, merge)
        .map((file) => readFileSync(join(migrationsDir, file), 'utf8'))
        .join('\n')
        .replace(/^create extension if not exists pg_cron.*$/m, '')
        .replace(/^select cron\.schedule\([\s\S]*?\);$/m, ''),
    )
    await create({ invoiceNumber: null, accessCode: 'AM-AAAA-AAAA' }, [amOnly()])
    await create({ kind: 'team', teamName: 'Brno' }, team(athlete({ email: 'captain@example.cz' })))
    await expect(
      db.exec('begin;\n' + readFileSync(join(migrationsDir, files[merge]!), 'utf8')),
    ).rejects.toThrow('Duplicate active athletes (same name and date of birth) exist')
    await db.exec('rollback')
    expect((await registrations()).map((row) => row.status)).toEqual(['active', 'active'])
  })
})
