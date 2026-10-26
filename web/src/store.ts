// Penyimpanan state aplikasi + sinkronisasi dengan Google Sheet.
// Setiap perubahan masuk antrean dulu (tersimpan di perangkat), lalu dikirim saat online.

import { useSyncExternalStore } from 'react'
import type { DataKeuangan, Koneksi, Operasi, Transaksi } from './types.ts'
import { fetchAll, OfflineError, sendOperations } from './lib/api.ts'
import { createDemoData } from './lib/demo.ts'
import { load, newId, save } from './lib/storage.ts'

export interface FinanceState {
  koneksi: Koneksi | null
  demo: boolean
  server: DataKeuangan | null // data terakhir dari server (atau data demo)
  antrean: Operasi[]
  terakhirSinkron: string | null
  menyinkron: boolean
  offline: boolean
  galat: string | null
}

const STORAGE_KEYS = {
  koneksi: 'kp.koneksi',
  demo: 'kp.demo',
  server: 'kp.server',
  antrean: 'kp.antrean',
  terakhirSinkron: 'kp.terakhirSinkron',
} as const

const EMPTY: DataKeuangan = { akun: [], kategori: [], transaksi: [] }

let state: FinanceState = {
  koneksi: load<Koneksi | null>(STORAGE_KEYS.koneksi, null),
  demo: load(STORAGE_KEYS.demo, false),
  server: load<DataKeuangan | null>(STORAGE_KEYS.server, null),
  antrean: load<Operasi[]>(STORAGE_KEYS.antrean, []),
  terakhirSinkron: load<string | null>(STORAGE_KEYS.terakhirSinkron, null),
  menyinkron: false,
  offline: false,
  galat: null,
}

const listeners = new Set<() => void>()

function setState(patch: Partial<FinanceState>): void {
  const previous = state
  state = { ...state, ...patch }
  for (const key of Object.keys(STORAGE_KEYS) as (keyof typeof STORAGE_KEYS)[]) {
    if (state[key] !== previous[key]) save(STORAGE_KEYS[key], state[key])
  }
  listeners.forEach(listener => listener())
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useFinance(): FinanceState {
  return useSyncExternalStore(subscribe, () => state)
}

/** Data yang ditampilkan = data server + perubahan yang masih di antrean. */
export function applyQueue(server: DataKeuangan | null, antrean: Operasi[]): DataKeuangan {
  const base = server ?? EMPTY
  if (!antrean.length) return base
  const byId = new Map(base.transaksi.map(t => [t.id, t]))
  for (const op of antrean) {
    if (op.op === 'upsert') byId.set(op.tx.id, op.tx)
    else byId.delete(op.id)
  }
  return { ...base, transaksi: [...byId.values()] }
}

export function pendingIds(antrean: Operasi[]): Set<string> {
  return new Set(antrean.flatMap(op => (op.op === 'upsert' ? [op.tx.id] : [])))
}

let syncTimer: number | undefined
let syncAgain = false

export function scheduleSync(delay = 400): void {
  window.clearTimeout(syncTimer)
  syncTimer = window.setTimeout(() => void syncNow(), delay)
}

export async function syncNow(): Promise<void> {
  const { koneksi, demo } = state
  if (!koneksi || demo) return
  if (state.menyinkron) {
    syncAgain = true
    return
  }
  setState({ menyinkron: true })
  const sent = state.antrean
  try {
    const now = new Date().toISOString()
    if (sent.length) {
      const { data, results } = await sendOperations(koneksi, sent)
      const sentIds = new Set(sent.map(op => op.qid))
      const failed = results.filter(r => !r.ok)
      setState({
        server: data,
        antrean: state.antrean.filter(op => !sentIds.has(op.qid)),
        galat: failed.length ? `${failed.length} perubahan ditolak: ${failed[0].error ?? 'tanpa keterangan'}` : null,
        offline: false,
        terakhirSinkron: now,
      })
    } else {
      const data = await fetchAll(koneksi)
      setState({ server: data, galat: null, offline: false, terakhirSinkron: now })
    }
  } catch (err) {
    if (err instanceof OfflineError) setState({ offline: true })
    else setState({ galat: err instanceof Error ? err.message : String(err), offline: false })
  } finally {
    setState({ menyinkron: false })
    if (syncAgain) {
      syncAgain = false
      void syncNow()
    }
  }
}

export function saveTransaction(tx: Transaksi): void {
  const now = new Date().toISOString()
  if (state.demo) {
    const server = state.server ?? EMPTY
    const existing = server.transaksi.find(t => t.id === tx.id)
    const saved = { ...tx, dibuat: existing?.dibuat || now, diubah: now }
    setState({ server: { ...server, transaksi: [...server.transaksi.filter(t => t.id !== tx.id), saved] } })
    return
  }
  const queued: Transaksi = { ...tx, dibuat: tx.dibuat || now, diubah: now }
  const others = state.antrean.filter(op => !(op.op === 'upsert' && op.tx.id === tx.id))
  setState({ antrean: [...others, { qid: newId(), op: 'upsert', tx: queued }] })
  scheduleSync()
}

export function deleteTransaction(id: string): void {
  if (state.demo) {
    const server = state.server ?? EMPTY
    setState({ server: { ...server, transaksi: server.transaksi.filter(t => t.id !== id) } })
    return
  }
  // Kalau transaksinya belum sempat terkirim, cukup buang dari antrean.
  const antrean = state.antrean.filter(op => !(op.op === 'upsert' && op.tx.id === id))
  if (state.server?.transaksi.some(t => t.id === id)) antrean.push({ qid: newId(), op: 'delete', id })
  setState({ antrean })
  scheduleSync()
}

export async function connect(input: Koneksi): Promise<void> {
  const koneksi = { url: input.url.trim(), token: input.token.trim() }
  if (!/^https:\/\/script\.google\.com\/.+\/exec$/.test(koneksi.url)) {
    throw new Error('URL harus berbentuk https://script.google.com/macros/s/…/exec')
  }
  if (!koneksi.token) throw new Error('Token belum diisi')
  const data = await fetchAll(koneksi)
  setState({
    koneksi,
    demo: false,
    server: data,
    antrean: state.demo ? [] : state.antrean,
    galat: null,
    offline: false,
    terakhirSinkron: new Date().toISOString(),
  })
}

export function startDemo(): void {
  setState({ koneksi: null, demo: true, server: createDemoData(), antrean: [], galat: null, offline: false, terakhirSinkron: null })
}

export function resetLocal(): void {
  setState({ koneksi: null, demo: false, server: null, antrean: [], galat: null, offline: false, terakhirSinkron: null })
}
