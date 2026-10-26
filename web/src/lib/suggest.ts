// Menebak kategori (atau orang) dari keterangan.
// 1) Riwayat: keterangan yang sama/mirip pernah dicatat ke mana?  2) Kata kunci di tab Kategori.

import type { DataKeuangan } from '../types.ts'

export type Target = { kind: 'kategori'; nama: string } | { kind: 'orang'; nama: string }
export type View = 'keluar' | 'masuk'

type Stats = { count: number; last: string }
export type History = Map<string, Map<string, Stats>>

export function normalize(text: string): string {
  const words = text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  return words ? ` ${words} ` : ''
}

function targetKey(view: View, target: Target): string {
  return `${view}|${target.kind}|${target.nama}`
}

function parseTargetKey(key: string): { view: View; target: Target } {
  const [view, kind, ...rest] = key.split('|')
  return { view: view as View, target: { kind: kind as Target['kind'], nama: rest.join('|') } }
}

/** Indeks: keterangan (dinormalisasi) → tujuan → berapa kali & kapan terakhir. */
export function buildHistory(data: DataKeuangan): History {
  const people = new Set(data.akun.filter(a => a.jenis === 'orang').map(a => a.nama))
  const history: History = new Map()
  for (const t of data.transaksi) {
    const key = normalize(t.keterangan)
    if (!key) continue
    let entry: { view: View; target: Target } | null = null
    if (t.tipe === 'keluar' || t.tipe === 'masuk') entry = { view: t.tipe, target: { kind: 'kategori', nama: t.kategori } }
    else if (people.has(t.akun_tujuan)) entry = { view: 'keluar', target: { kind: 'orang', nama: t.akun_tujuan } }
    else if (people.has(t.akun)) entry = { view: 'masuk', target: { kind: 'orang', nama: t.akun } }
    if (!entry) continue
    const targets = history.get(key) ?? new Map<string, Stats>()
    const tk = targetKey(entry.view, entry.target)
    const stats = targets.get(tk) ?? { count: 0, last: '' }
    stats.count += 1
    if (t.tanggal > stats.last) stats.last = t.tanggal
    targets.set(tk, stats)
    history.set(key, targets)
  }
  return history
}

export function suggestTarget(description: string, view: View, data: DataKeuangan, history: History): Target | null {
  const text = normalize(description)
  if (!text) return null
  const valid = (target: Target) =>
    target.kind === 'orang'
      ? data.akun.some(a => a.jenis === 'orang' && a.aktif && a.nama === target.nama)
      : data.kategori.some(k => k.tipe === view && k.aktif && k.nama === target.nama)

  // Riwayat: cocok persis dulu, lalu keterangan lama yang terkandung di teks (misal "indomaret" di "indomaret susu").
  const keys = history.has(text) ? [text] : [...history.keys()].filter(k => text.includes(k)).sort((a, b) => b.length - a.length)
  for (const key of keys) {
    let best: { target: Target; stats: Stats } | null = null
    for (const [tk, stats] of history.get(key) ?? []) {
      const parsed = parseTargetKey(tk)
      if (parsed.view !== view || !valid(parsed.target)) continue
      if (!best || stats.count > best.stats.count || (stats.count === best.stats.count && stats.last > best.stats.last)) {
        best = { target: parsed.target, stats }
      }
    }
    if (best) return best.target
  }

  // Kata kunci: yang terpanjang (paling spesifik) menang.
  let match: { nama: string; score: number; urutan: number } | null = null
  for (const k of data.kategori) {
    if (k.tipe !== view || !k.aktif) continue
    for (const keyword of k.kata_kunci) {
      const needle = normalize(keyword)
      if (!needle || !text.includes(needle)) continue
      const score = needle.length
      if (!match || score > match.score || (score === match.score && k.urutan < match.urutan)) {
        match = { nama: k.nama, score, urutan: k.urutan }
      }
    }
  }
  return match ? { kind: 'kategori', nama: match.nama } : null
}
