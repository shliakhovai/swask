export function today(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function isDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false
  const [year, month, day] = value.split('-').map(Number)
  if (
    year === undefined ||
    month === undefined ||
    day === undefined ||
    year < 1900 ||
    year > 9999
  )
    return false
  return today(new Date(year, month - 1, day, 12)) === value
}

export function addDays(date: string, days: number): string {
  if (!isDate(date) || !Number.isSafeInteger(days))
    throw new RangeError('Некоректна календарна дата або кількість днів.')
  const [year, month, day] = date.split('-').map(Number)
  const result = today(new Date(year!, month! - 1, day! + days, 12))
  if (!isDate(result))
    throw new RangeError('Дата має бути між 1900-01-01 та 9999-12-31.')
  return result
}

export function postponeDate(
  deadline: string | null,
  days: 1 | 3 | 7,
  current = today(),
): string {
  return addDays(deadline && deadline > current ? deadline : current, days)
}

export function formatDate(
  date: string,
  options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' },
): string {
  const [year, month, day] = date.split('-').map(Number)
  return new Intl.DateTimeFormat('uk-UA', options).format(
    new Date(year!, month! - 1, day!, 12),
  )
}
