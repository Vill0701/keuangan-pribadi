import { useState, type FormEvent } from 'react'
import { connect, resetLocal, startDemo, syncNow, type FinanceState } from '../store.ts'

const APP_VERSION = '0.1.0'

interface Props {
  state: FinanceState
  onReady: () => void
}

export function Settings({ state, onReady }: Props) {
  const [url, setUrl] = useState(state.koneksi?.url ?? '')
  const [token, setToken] = useState(state.koneksi?.token ?? '')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<{ tone: '' | 'error' | 'success'; text: string }>({ tone: '', text: '' })
  const connected = Boolean(state.koneksi)

  async function handleConnect(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setStatus({ tone: '', text: '' })
    try {
      await connect({ url, token })
      setStatus({ tone: 'success', text: 'Terhubung ✓ Data berhasil dimuat dari Google Sheet.' })
      onReady()
    } catch (err) {
      setStatus({ tone: 'error', text: err instanceof Error ? err.message : String(err) })
    } finally {
      setBusy(false)
    }
  }

  function handleReset() {
    const unsent = state.antrean.length
    const message = unsent
      ? `Ada ${unsent} perubahan yang belum terkirim dan akan hilang. Tetap hapus data di perangkat ini?`
      : 'Hapus salinan data dan koneksi di perangkat ini? Data di Google Sheet tidak terhapus.'
    if (!window.confirm(message)) return
    resetLocal()
    setUrl('')
    setToken('')
    setStatus({ tone: '', text: '' })
  }

  const lastSync = state.terakhirSinkron
    ? new Date(state.terakhirSinkron).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
    : 'belum pernah'

  return (
    <>
      {!connected && !state.demo && (
        <section className="card">
          <h2>Selamat datang 👋</h2>
          <p className="note" style={{ marginTop: 0 }}>
            Semua catatan disimpan di Google Sheet milikmu sendiri. Hubungkan dengan URL dan token dari Apps Script
            (langkahnya ada di README), atau coba dulu dengan data contoh.
          </p>
        </section>
      )}

      <section className="card">
        <h2>Hubungkan ke Google Sheet</h2>
        <form onSubmit={handleConnect}>
          <label className="field">
            <span>URL web app (berakhiran /exec)</span>
            <input className="input" type="url" inputMode="url" autoComplete="off" spellCheck={false} required
              placeholder="https://script.google.com/macros/s/…/exec" value={url} onChange={e => setUrl(e.target.value)} />
          </label>
          <label className="field">
            <span>Token API</span>
            <input className="input" type="password" autoComplete="off" spellCheck={false} required
              value={token} onChange={e => setToken(e.target.value)} />
          </label>
          <button type="submit" className="btn primary block" disabled={busy}>
            {busy ? 'Menghubungkan…' : connected ? 'Simpan & muat ulang' : 'Hubungkan'}
          </button>
          {status.text && <p className={`note ${status.tone}`} role="status">{status.text}</p>}
        </form>
      </section>

      {connected && (
        <section className="card">
          <h2>Sinkronisasi</h2>
          <p className="note" style={{ marginTop: 0 }}>
            Terakhir: {lastSync} · {state.antrean.length} perubahan menunggu
          </p>
          {state.offline && (
            <p className="note">Sedang offline. Catatan tetap tersimpan di perangkat dan dikirim otomatis saat online.</p>
          )}
          {state.galat && <p className="note error">{state.galat}</p>}
          <button type="button" className="btn block" style={{ marginTop: 12 }} disabled={state.menyinkron}
            onClick={() => void syncNow()}>
            {state.menyinkron ? 'Menyinkron…' : 'Sinkron sekarang'}
          </button>
        </section>
      )}

      {!connected && (
        <section className="card">
          <h2>Coba tanpa Google dulu</h2>
          {state.demo ? (
            <>
              <p className="note" style={{ marginTop: 0 }}>Mode demo aktif. Data contoh hanya ada di perangkat ini.</p>
              <div className="btn-row" style={{ marginTop: 12 }}>
                <button type="button" className="btn" onClick={startDemo}>Ulangi data contoh</button>
                <button type="button" className="btn" onClick={resetLocal}>Keluar dari mode demo</button>
              </div>
            </>
          ) : (
            <>
              <p className="note" style={{ marginTop: 0 }}>
                Mode demo memakai data contoh yang hanya tersimpan di perangkat ini, untuk mencoba tampilan sebelum
                menyiapkan Google Sheet.
              </p>
              <button type="button" className="btn block" style={{ marginTop: 12 }} onClick={() => { startDemo(); onReady() }}>
                Coba mode demo
              </button>
            </>
          )}
        </section>
      )}

      <section className="card">
        <h2>Pasang di HP</h2>
        <ol className="help">
          <li>Buka alamat aplikasi ini di Chrome Android.</li>
          <li>Ketuk menu ⋮ lalu <b>Instal aplikasi</b> (atau <b>Tambahkan ke layar utama</b>).</li>
          <li>Tekan lama ikonnya untuk pintasan <b>Catat transaksi</b>.</li>
        </ol>
      </section>

      <section className="card">
        <h2>Data di perangkat ini</h2>
        <p className="note" style={{ marginTop: 0 }}>
          Menghapus salinan data dan koneksi di perangkat ini saja. Data di Google Sheet tidak tersentuh.
        </p>
        <button type="button" className="btn block" style={{ marginTop: 12 }} onClick={handleReset}>Hapus data lokal</button>
      </section>

      <p className="note" style={{ margin: '8px 0 24px', textAlign: 'center' }}>Keuangan Pribadi · versi {APP_VERSION}</p>
    </>
  )
}
