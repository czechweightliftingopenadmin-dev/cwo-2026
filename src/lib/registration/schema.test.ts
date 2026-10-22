import { describe, expect, it } from 'vitest'
import type { AthleteInput, RegistrationInput } from './schema'
import { generateAccessCode, parseIdentifier, registrationSchema, toFieldIssues } from './schema'

const athlete = (overrides: Partial<AthleteInput> = {}): AthleteInput => ({
  firstName: ' Jana ',
  lastName: 'Nováková',
  birthDate: '2000-05-01',
  sex: 'F',
  weightClass: '61',
  total: 150,
  email: ' Jana@Example.CZ ',
  phone: '+420 777 123 456',
  tshirtSize: 'M',
  cwo: true,
  amcr: false,
  university: null,
  ...overrides,
})

const individual = (overrides: Partial<RegistrationInput> = {}): RegistrationInput => ({
  kind: 'individual',
  teamName: null,
  invoiceNumber: '12345678',
  athletes: [athlete()],
  consent: true,
  language: 'cs',
  ...overrides,
})

function messages(input: unknown) {
  const result = registrationSchema.safeParse(input)
  return result.success ? [] : toFieldIssues(result.error)
}

describe('registrationSchema', () => {
  it('normalises a valid individual registration', () => {
    const result = registrationSchema.parse(individual())
    expect(result.athletes[0]).toMatchObject({ firstName: 'Jana', email: 'jana@example.cz' })
    expect(result.teamName).toBeNull()
  })

  it('requires an eight-digit invoice for CWO', () => {
    expect(messages(individual({ invoiceNumber: null }))).toContainEqual({
      path: 'invoiceNumber',
      message: 'required',
    })
    expect(messages(individual({ invoiceNumber: '1234' }))).toContainEqual({
      path: 'invoiceNumber',
      message: 'invoiceFormat',
    })
  })

  it('accepts AM ČR without an invoice and drops CWO-only data', () => {
    const result = registrationSchema.parse(
      individual({
        invoiceNumber: '99999999',
        athletes: [athlete({ cwo: false, amcr: true, university: 'MU', tshirtSize: null })],
      }),
    )
    expect(result.invoiceNumber).toBeNull()
    expect(result.athletes[0]).toMatchObject({ university: 'MU', tshirtSize: null })
  })

  it('requires a competition, a university for AM ČR and a T-shirt for CWO', () => {
    expect(messages(individual({ athletes: [athlete({ cwo: false })] }))).toContainEqual({
      path: 'athletes.0.cwo',
      message: 'competitionRequired',
    })
    const issues = messages(individual({ athletes: [athlete({ amcr: true, tshirtSize: null })] }))
    expect(issues).toContainEqual({ path: 'athletes.0.university', message: 'required' })
    expect(issues).toContainEqual({ path: 'athletes.0.tshirtSize', message: 'required' })
  })

  it('checks the weight class against the sex', () => {
    expect(messages(individual({ athletes: [athlete({ sex: 'M' })] }))).toContainEqual({
      path: 'athletes.0.weightClass',
      message: 'required',
    })
  })

  it('requires men to turn 15 in 2026', () => {
    const man = { sex: 'M', weightClass: '75' } as const
    expect(
      messages(individual({ athletes: [athlete({ ...man, birthDate: '2011-12-31' })] })),
    ).toEqual([])
    expect(
      messages(individual({ athletes: [athlete({ ...man, birthDate: '2012-01-01' })] })),
    ).toContainEqual({ path: 'athletes.0.birthDate', message: 'tooYoung' })
  })

  it('accepts teams of three or four CWO members with a name', () => {
    const team = (count: number) =>
      individual({
        kind: 'team',
        teamName: 'Brno',
        athletes: Array.from({ length: count }, (_, n) =>
          athlete({ email: `clen${n}@example.cz` }),
        ),
      })
    expect(messages(team(3))).toEqual([])
    const shared = team(3)
    shared.athletes[2] = athlete({ email: 'CLEN0@example.cz' })
    expect(messages(shared)).toContainEqual({ path: 'athletes.2.email', message: 'duplicateEmail' })
    expect(messages(team(4))).toEqual([])
    expect(messages(team(2))).toContainEqual({ path: 'athletes', message: 'teamSize' })
    expect(messages(team(5))).toContainEqual({ path: 'athletes', message: 'teamSize' })
    expect(messages({ ...team(3), teamName: null })).toContainEqual({
      path: 'teamName',
      message: 'required',
    })
  })

  it('reports field and registration errors together', () => {
    const issues = messages(
      individual({ invoiceNumber: null, athletes: [athlete({ firstName: '', tshirtSize: null })] }),
    )
    expect(issues).toContainEqual({ path: 'athletes.0.firstName', message: 'required' })
    expect(issues).toContainEqual({ path: 'athletes.0.tshirtSize', message: 'required' })
    expect(issues).toContainEqual({ path: 'invoiceNumber', message: 'required' })
  })

  it('requires consent', () => {
    expect(messages(individual({ consent: false as true }))).toContainEqual({
      path: 'consent',
      message: 'consentRequired',
    })
  })
})

describe('access codes', () => {
  it('generates readable codes that parse back from loose input', () => {
    const code = generateAccessCode(false)
    expect(code).toMatch(/^AM-[A-Z2-9]{4}-[A-Z2-9]{4}$/)
    expect(code).not.toMatch(/[01OI]/)
    expect(parseIdentifier(` ${code.toLowerCase().replaceAll('-', ' ')} `)).toEqual({
      accessCode: code,
    })
    expect(generateAccessCode(true)).toMatch(/^CW-/)
  })

  it('recognises invoice numbers and rejects anything else', () => {
    expect(parseIdentifier('1234 5678')).toEqual({ invoiceNumber: '12345678' })
    expect(parseIdentifier('XX-1234-5678')).toBeNull()
    expect(parseIdentifier('')).toBeNull()
  })
})
