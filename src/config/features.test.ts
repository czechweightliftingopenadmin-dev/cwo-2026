import { describe, expect, it } from 'vitest'
import type { Features } from './features'
import { editFormState, isVisible, registrationFormState, visibleSections } from './features'

const auto: Features = {
  registrationSection: 'auto',
  registrationForm: 'auto',
  editForm: 'auto',
  startlist: 'auto',
}
const october = new Date('2026-10-22T12:00:00+02:00')
const november = new Date('2026-11-20T12:00:00+01:00')
const december = new Date('2026-12-10T12:00:00+01:00')
const afterEvent = new Date('2026-12-30T12:00:00+01:00')

describe('feature switches', () => {
  it('follow the dates in auto mode', () => {
    expect(visibleSections(october, auto)).toEqual(['about', 'venue'])
    expect(visibleSections(november, auto)).toEqual(['about', 'registration', 'venue'])
    expect(visibleSections(december, auto)).toEqual(['about', 'registration', 'startlist', 'venue'])
    expect(visibleSections(afterEvent, auto)).toEqual(['about', 'startlist', 'venue'])
    expect(editFormState(november, auto)).toBe('upcoming')
    expect(editFormState(december, auto)).toBe('open')
  })

  it('override the dates when switched on or off', () => {
    const on: Features = { ...auto, registrationSection: 'on', registrationForm: 'on' }
    expect(registrationFormState(october, on)).toBe('open')
    expect(isVisible('registration', october, on)).toBe(true)
    const off: Features = { ...auto, registrationSection: 'off', startlist: 'off' }
    expect(isVisible('registration', november, off)).toBe(false)
    expect(isVisible('startlist', december, off)).toBe(false)
    expect(isVisible('startlist', october, { ...auto, startlist: 'on' })).toBe(true)
  })
})
