// Format angka Rupiah dan tanggal dalam bahasa Indonesia.

const numberFormat = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 })
const monthLongFormat = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' })
const monthShortFormat = new Intl.DateTimeFormat('id-ID', { month: 'short' })
const dayFormat = new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'short' })
const shortDayFormat = new Intl.DateTimeFormat('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })
const shortDateFormat = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' })

export function formatNumber(value: number): string {
  return numberFormat.format(value)
}

/** 25000 → "Rp 25.000", -25000 → "−Rp 25.000". Spasinya tidak bisa dipotong, jadi "Rp" tidak terpisah dari angka. */
export function formatRupiah(value: number): string {
  const rounded = Math.round(value)
  return (rounded < 0 ? '−' : '') + 'Rp ' + numberFormat.format(Math.abs(rounded))
}

/** Versi ringkas untuk sumbu grafik: 1,5 jt · 250 rb */
export function formatCompact(value: number): string {
  const abs = Math.abs(value)
  const units: [number, string][] = [[1e9, ' M'], [1e6, ' jt'], [1e3, ' rb']]
  for (const [size, unit] of units) {
    if (abs >= size) return (value / size).toLocaleString('id-ID', { maximumFractionDigits: 1 }) + unit
  }
  return numberFormat.format(Math.round(value))
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

export function toIso(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function parseIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

export function todayIso(): string {
  return toIso(new Date())
}

export function addDays(iso: string, days: number): string {
  const date = parseIso(iso)
  date.setDate(date.getDate() + days)
  return toIso(date)
}

/** '2026-10-26' → '2026-10' */
export function monthOf(iso: string): string {
  return iso.slice(0, 7)
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  return toIso(new Date(y, m - 1 + delta, 1)).slice(0, 7)
}

export function daysInMonth(month: string): number {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

/** '2026-10' → 'Oktober 2026' */
export function monthLabel(month: string): string {
  return monthLongFormat.format(parseIso(month + '-01'))
}

/** '2026-10' → 'Okt' */
export function monthShortLabel(month: string): string {
  return monthShortFormat.format(parseIso(month + '-01'))
}

/** '2026-10-26' → 'Senin, 26 Okt' */
export function dayLabel(iso: string): string {
  return dayFormat.format(parseIso(iso))
}

/** '2026-10-26' → 'Sen, 26 Okt' */
export function shortDayLabel(iso: string): string {
  return shortDayFormat.format(parseIso(iso))
}

/** '2026-10-26' → '26 Okt' */
export function shortDate(iso: string): string {
  return shortDateFormat.format(parseIso(iso))
}
