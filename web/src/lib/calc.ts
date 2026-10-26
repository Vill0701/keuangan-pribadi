// Perhitungan saldo dan ringkasan. Semua dihitung di perangkat dari daftar transaksi.

import type { Akun, DataKeuangan, JenisAkun, Kategori, Transaksi } from '../types.ts'
import { monthOf, shiftMonth } from './format.ts'

export const LIQUID_KINDS: JenisAkun[] = ['bank', 'ewallet', 'tunai']

/** Grup tetap untuk ringkasan; grup lain digabung ke "Lainnya". Urutan ini juga urutan warnanya. */
export const SUMMARY_GROUPS = ['Kebutuhan', 'Keinginan', 'Memberi'] as const

export function isLiquid(akun: Akun): boolean {
  return LIQUID_KINDS.includes(akun.jenis)
}

/**
 * Saldo setiap akun = saldo_awal ± semua transaksi.
 * Untuk akun "orang": positif = dia berutang ke kamu, negatif = kamu berutang ke dia.
 */
export function computeBalances(data: DataKeuangan): Map<string, number> {
  const balances = new Map<string, number>()
  data.akun.forEach(a => balances.set(a.nama, a.saldo_awal))
  const add = (name: string, delta: number) => balances.set(name, (balances.get(name) ?? 0) + delta)
  for (const t of data.transaksi) {
    if (t.tipe === 'keluar') add(t.akun, -t.nominal)
    else if (t.tipe === 'masuk') add(t.akun, t.nominal)
    else if (t.tipe === 'transfer') {
      add(t.akun, -t.nominal)
      add(t.akun_tujuan, t.nominal)
    }
  }
  return balances
}

/** Terbaru di atas. */
export function sortTransactions(list: Transaksi[]): Transaksi[] {
  return [...list].sort((a, b) => b.tanggal.localeCompare(a.tanggal) || b.dibuat.localeCompare(a.dibuat))
}

export interface CategoryTotal {
  nama: string
  total: number
  kategori?: Kategori
}

export interface GroupTotal {
  grup: string
  total: number
}

export interface MonthSummary {
  masuk: number
  keluar: number
  keluarPerKategori: CategoryTotal[]
  masukPerKategori: CategoryTotal[]
  perGrup: GroupTotal[]
}

export function summarizeMonth(data: DataKeuangan, month: string): MonthSummary {
  const byName = new Map(data.kategori.map(k => [k.nama, k]))
  const out = new Map<string, number>()
  const inc = new Map<string, number>()
  let totalIn = 0
  let totalOut = 0
  for (const t of data.transaksi) {
    if (monthOf(t.tanggal) !== month) continue
    if (t.tipe === 'keluar') {
      totalOut += t.nominal
      out.set(t.kategori, (out.get(t.kategori) ?? 0) + t.nominal)
    } else if (t.tipe === 'masuk') {
      totalIn += t.nominal
      inc.set(t.kategori, (inc.get(t.kategori) ?? 0) + t.nominal)
    }
  }
  const toList = (totals: Map<string, number>): CategoryTotal[] =>
    [...totals]
      .map(([nama, total]) => ({ nama, total, kategori: byName.get(nama) }))
      .sort((a, b) => b.total - a.total)

  const groups = new Map<string, number>()
  out.forEach((total, nama) => {
    const grup = byName.get(nama)?.grup ?? ''
    const key = (SUMMARY_GROUPS as readonly string[]).includes(grup) ? grup : 'Lainnya'
    groups.set(key, (groups.get(key) ?? 0) + total)
  })
  const perGrup = [...SUMMARY_GROUPS, 'Lainnya']
    .map(grup => ({ grup, total: groups.get(grup) ?? 0 }))
    .filter(g => g.total > 0)

  return { masuk: totalIn, keluar: totalOut, keluarPerKategori: toList(out), masukPerKategori: toList(inc), perGrup }
}

/** Total pemasukan & pengeluaran antara dua tanggal (inklusif). */
export function totalsBetween(data: DataKeuangan, from: string, to: string): { masuk: number; keluar: number } {
  let masuk = 0
  let keluar = 0
  for (const t of data.transaksi) {
    if (t.tanggal < from || t.tanggal > to) continue
    if (t.tipe === 'masuk') masuk += t.nominal
    else if (t.tipe === 'keluar') keluar += t.nominal
  }
  return { masuk, keluar }
}

export interface TrendPoint {
  month: string
  masuk: number
  keluar: number
}

export function monthlyTrend(data: DataKeuangan, endMonth: string, count: number): TrendPoint[] {
  const months = Array.from({ length: count }, (_, i) => shiftMonth(endMonth, i - count + 1))
  const index = new Map(months.map((m, i) => [m, i]))
  const points = months.map(month => ({ month, masuk: 0, keluar: 0 }))
  for (const t of data.transaksi) {
    const i = index.get(monthOf(t.tanggal))
    if (i === undefined) continue
    if (t.tipe === 'masuk') points[i].masuk += t.nominal
    else if (t.tipe === 'keluar') points[i].keluar += t.nominal
  }
  return points
}

export function personStatus(nama: string, balance: number): string {
  if (Math.round(balance) === 0) return 'Lunas'
  return balance > 0 ? `${nama} berutang ke kamu` : `Kamu berutang ke ${nama}`
}
