import { describe, expect, it } from 'vitest'
import { addDays, isDate, postponeDate, today } from './date'

describe('calendar dates', () => {
  it('keeps the local date rather than converting to UTC', () => {
    expect(today(new Date(2026, 9, 13, 0, 1))).toBe('2026-10-13')
  })
  it('validates real calendar dates including leap years', () => {
    expect(isDate('2028-02-29')).toBe(true)
    expect(isDate('2026-02-29')).toBe(false)
    expect(isDate('13.10.2026')).toBe(false)
  })
  it('adds calendar days across month, year and DST boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-28', 3)).toBe('2026-03-31')
  })
  it('postpones from the later of today and the current deadline', () => {
    expect(postponeDate('2026-10-10', 3, '2026-10-13')).toBe('2026-10-16')
    expect(postponeDate('2026-10-20', 7, '2026-10-13')).toBe('2026-10-27')
    expect(postponeDate(null, 1, '2026-10-13')).toBe('2026-10-14')
  })
})
