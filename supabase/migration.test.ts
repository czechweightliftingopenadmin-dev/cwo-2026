// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { beforeEach, describe, expect, it } from 'vitest'

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

const athlete = (overrides: Record<string, unknown> = {}) => ({
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
