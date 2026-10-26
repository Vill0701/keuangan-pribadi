// Komunikasi dengan Google Apps Script (web app /exec).
// Body dikirim sebagai text/plain supaya browser tidak mengirim preflight CORS.

import type { DataKeuangan, Koneksi, Operasi } from '../types.ts'

export class OfflineError extends Error {
  constructor() {
    super('Tidak ada koneksi internet')
    this.name = 'OfflineError'
  }
}

export interface OpResult {
  id: string
  ok: boolean
  error?: string
}

interface ApiResponse {
  ok: boolean
  error?: string
  data?: DataKeuangan
  results?: OpResult[]
}

async function post(conn: Koneksi, body: Record<string, unknown>): Promise<ApiResponse> {
  let response: Response
  try {
    response = await fetch(conn.url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ ...body, token: conn.token }),
      redirect: 'follow',
    })
  } catch {
    throw new OfflineError()
  }
  const text = await response.text()
  let json: ApiResponse
  try {
    json = JSON.parse(text) as ApiResponse
  } catch {
    throw new Error('Respons bukan JSON. Pastikan URL berakhiran /exec dan web app diset "Who has access: Anyone".')
  }
  if (!json.ok) throw new Error(json.error || 'Permintaan gagal')
  return json
}

function checkData(data: DataKeuangan | undefined): DataKeuangan {
  if (!data || !Array.isArray(data.akun) || !Array.isArray(data.kategori) || !Array.isArray(data.transaksi)) {
    throw new Error('Data dari server tidak lengkap')
  }
  return data
}

export async function fetchAll(conn: Koneksi): Promise<DataKeuangan> {
  const res = await post(conn, { action: 'bootstrap' })
  return checkData(res.data)
}

export async function sendOperations(conn: Koneksi, ops: Operasi[]): Promise<{ data: DataKeuangan; results: OpResult[] }> {
  const payload = ops.map(o => (o.op === 'upsert' ? { op: o.op, tx: o.tx } : { op: o.op, id: o.id }))
  const res = await post(conn, { action: 'sync', ops: payload })
  return { data: checkData(res.data), results: res.results ?? [] }
}
