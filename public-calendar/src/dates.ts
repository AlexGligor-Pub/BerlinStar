import { TIMEZONE } from './config'

// Toate datele se afiseaza si se grupeaza in ora garajului, indiferent de
// fusul orar al telefonului clientului.

const partsFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** Cheia zilei, YYYY-MM-DD, in ora garajului. */
export function dayKey(d: Date): string {
  return partsFmt.format(d)
}

export function addDays(key: string, n: number): string {
  const [y, m, d] = key.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + n, 12))
  return dt.toISOString().slice(0, 10)
}

/** O zi (cheie) ca Date la pranz UTC — suficient pentru a-i afisa numele. */
function keyToDate(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, 12))
}

const weekdayFmt = new Intl.DateTimeFormat('ro-RO', { weekday: 'short', timeZone: 'UTC' })
const dayNumFmt = new Intl.DateTimeFormat('ro-RO', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const longDayFmt = new Intl.DateTimeFormat('ro-RO', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: TIMEZONE,
})
const timeFmt = new Intl.DateTimeFormat('ro-RO', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: TIMEZONE,
})

export const weekdayShort = (key: string) => weekdayFmt.format(keyToDate(key)).replace('.', '')
export const dayShort = (key: string) => dayNumFmt.format(keyToDate(key)).replace('.', '')
export const longDay = (iso: string) => longDayFmt.format(new Date(iso))
export const hhmm = (iso: string) => timeFmt.format(new Date(iso))
