import { describe, expect, it } from 'vitest'
import { maskBirthDate, normaliseBirthDate } from './draft'

// Simulates typing one character at a time, as the input receives it.
const type = (text: string) => [...text].reduce((value, char) => maskBirthDate(value + char), '')

describe('birth date input', () => {
  it('formats digits typed one by one', () => {
    expect(type('01052000')).toBe('01. 05. 2000')
    expect(type('0105200099')).toBe('01. 05. 2000')
  })

  it('keeps the separators people type themselves', () => {
    expect(type('1.5.2000')).toBe('1. 5. 2000')
    expect(type('1. 5. 2000')).toBe('1. 5. 2000')
    expect(maskBirthDate('1.')).toBe('1.')
    expect(maskBirthDate('abc')).toBe('')
  })

  it('lets backspace remove a separator', () => {
    expect(maskBirthDate('01. ')).toBe('01. ')
    expect(maskBirthDate('01.')).toBe('01.')
    expect(maskBirthDate('01')).toBe('01')
  })

  it('normalises to ISO for validation', () => {
    expect(normaliseBirthDate('1. 5. 2000')).toBe('2000-05-01')
    expect(normaliseBirthDate('01.05.2000')).toBe('2000-05-01')
    expect(normaliseBirthDate('2000-5-1')).toBe('2000-05-01')
    expect(normaliseBirthDate('1. 5.')).toBe('1. 5.')
  })
})
