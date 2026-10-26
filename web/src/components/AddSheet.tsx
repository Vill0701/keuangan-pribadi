// Lembar "Catat": nominal lewat keypad, kategori ditebak dari keterangan, simpan.

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import type { Akun, DataKeuangan, Transaksi } from '../types.ts'
import { isLiquid } from '../lib/calc.ts'
import { addDays, formatNumber, formatRupiah, shortDayLabel, todayIso } from '../lib/format.ts'
import { load, newId, save } from '../lib/storage.ts'
import { suggestTarget, type History, type Target, type View } from '../lib/suggest.ts'

type Mode = View | 'transfer'

interface Props {
  data: DataKeuangan
  history: History
  initial: Transaksi | null
  onSave: (tx: Transaksi) => void
  onDelete: (id: string) => void
  onClose: () => void
}

const MAX_DIGITS = 12
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '000', '0', 'back']
const OTHER_DATE = 'lainnya'
const RECENT_DAYS = 7

const byOrder = (a: Akun, b: Akun) => a.urutan - b.urutan
const sameTarget = (a: Target | null, b: Target) => Boolean(a) && a?.kind === b.kind && a?.nama === b.nama

interface InitialValues {
  mode: Mode
  target: Target | null
  account: string
  from: string
  to: string
}

function initialValues(data: DataKeuangan, initial: Transaksi | null, liquid: Akun[]): InitialValues {
  const saved = load<string>('kp.akunTerakhir.keluar', '')
  const lastAccount = liquid.some(a => a.nama === saved) ? saved : liquid[0]?.nama ?? ''
  const blank = { target: null, account: lastAccount, from: liquid[0]?.nama ?? '', to: '' }
  if (!initial) return { mode: 'keluar', ...blank }
  if (initial.tipe !== 'transfer') {
    return { ...blank, mode: initial.tipe, target: { kind: 'kategori', nama: initial.kategori }, account: initial.akun }
  }
  const isPerson = (name: string) => data.akun.some(a => a.nama === name && a.jenis === 'orang')
  if (isPerson(initial.akun_tujuan)) {
    return { ...blank, mode: 'keluar', target: { kind: 'orang', nama: initial.akun_tujuan }, account: initial.akun }
  }
  if (isPerson(initial.akun)) {
    return { ...blank, mode: 'masuk', target: { kind: 'orang', nama: initial.akun }, account: initial.akun_tujuan }
  }
  return { ...blank, mode: 'transfer', from: initial.akun, to: initial.akun_tujuan }
}

export function AddSheet({ data, history, initial, onSave, onDelete, onClose }: Props) {
  const active = useMemo(() => data.akun.filter(a => a.aktif).sort(byOrder), [data.akun])
  const liquid = useMemo(() => active.filter(isLiquid), [active])
  const people = useMemo(() => active.filter(a => a.jenis === 'orang'), [active])
  const transferable = useMemo(() => active.filter(a => a.jenis !== 'orang'), [active])
  const today = todayIso()
  const recentDates = useMemo(() => Array.from({ length: RECENT_DAYS }, (_, i) => addDays(today, -i)), [today])

  const [start] = useState(() => initialValues(data, initial, liquid))
  const [mode, setMode] = useState<Mode>(start.mode)
  const [digits, setDigits] = useState(initial ? String(Math.round(initial.nominal)) : '')
  const [amountTouched, setAmountTouched] = useState(false)
  const [chosen, setChosen] = useState<Target | null>(start.target)
  const [account, setAccount] = useState(start.account)
  const [from, setFrom] = useState(start.from)
  const [to, setTo] = useState(start.to)
  const [date, setDate] = useState(initial?.tanggal ?? today)
  const [pickAnyDate, setPickAnyDate] = useState(() => !recentDates.includes(initial?.tanggal ?? today))
  const [description, setDescription] = useState(initial?.keterangan ?? '')
  const [error, setError] = useState('')
  const sheetRef = useRef<HTMLDivElement>(null)

  // Selama pengguna belum memilih sendiri, kategori ditebak dari keterangan.
  const suggested = useMemo(
    () => (mode === 'transfer' || chosen ? null : suggestTarget(description, mode, data, history)),
    [mode, chosen, description, data, history],
  )
  const target = chosen ?? suggested
  const amount = amountTouched || !initial ? Number(digits || 0) : initial.nominal

  useEffect(() => {
    sheetRef.current?.focus()
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  function press(key: string) {
    setAmountTouched(true)
    setError('')
    setDigits(prev => {
      if (key === 'back') return prev.slice(0, -1)
      const next = (prev + key).replace(/^0+/, '')
      return next.length > MAX_DIGITS ? prev : next
    })
  }

  function changeMode(next: Mode) {
    setMode(next)
    setChosen(null)
    setError('')
    if (next !== 'transfer') {
      const saved = load<string>(`kp.akunTerakhir.${next}`, '')
      if (liquid.some(a => a.nama === saved)) setAccount(saved)
    }
  }

  function pick(next: Target) {
    setChosen(sameTarget(chosen, next) ? null : next)
    setError('')
  }

  function submit() {
    if (!(amount > 0)) return setError('Isi nominalnya dulu')
    const base = {
      id: initial?.id ?? newId(),
      tanggal: date,
      nominal: amount,
      keterangan: description.trim(),
      sumber: initial?.sumber || 'manual',
      dibuat: initial?.dibuat ?? '',
      diubah: '',
    }
    if (mode === 'transfer') {
      if (!from || !to) return setError('Pilih akun asal dan tujuan')
      if (from === to) return setError('Akun asal dan tujuan tidak boleh sama')
      return onSave({ ...base, tipe: 'transfer', akun: from, akun_tujuan: to, kategori: '' })
    }
    if (!target) return setError('Pilih kategori atau orang')
    if (!account) return setError('Pilih akun')
    save(`kp.akunTerakhir.${mode}`, account)
    if (target.kind === 'orang') {
      return onSave(mode === 'keluar'
        ? { ...base, tipe: 'transfer', akun: account, akun_tujuan: target.nama, kategori: '' }
        : { ...base, tipe: 'transfer', akun: target.nama, akun_tujuan: account, kategori: '' })
    }
    onSave({ ...base, tipe: mode, akun: account, akun_tujuan: '', kategori: target.nama })
  }

  // Keyboard laptop: angka & Backspace untuk nominal, Enter untuk simpan, Esc untuk tutup.
  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') return onClose()
    const inField = e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement
    if (inField && e.key !== 'Enter') return
    if (e.key === 'Enter' && (e.target instanceof HTMLButtonElement || e.target instanceof HTMLSelectElement)) return
    if (/^\d$/.test(e.key)) press(e.key)
    else if (e.key === 'Backspace') press('back')
    else if (e.key === 'Enter') submit()
    else return
    e.preventDefault()
  }

  const categories = data.kategori
    .filter(k => k.aktif && k.tipe === (mode === 'masuk' ? 'masuk' : 'keluar'))
    .sort((a, b) => a.urutan - b.urutan)

  return (
    <div className="sheet-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Catat transaksi" tabIndex={-1}
        ref={sheetRef} onKeyDown={handleKeyDown}>
        <div className="sheet-header">
          <button type="button" className="btn-text" onClick={onClose}>Batal</button>
          <h2>{initial ? 'Ubah transaksi' : 'Catat'}</h2>
          <span className="end">
            {initial && (
              <button type="button" className="btn-text danger"
                onClick={() => window.confirm('Hapus transaksi ini?') && onDelete(initial.id)}>Hapus</button>
            )}
          </span>
        </div>

        <div className="segmented" role="group" aria-label="Jenis transaksi">
          {(['keluar', 'masuk', 'transfer'] as Mode[]).map(m => (
            <button key={m} type="button" aria-pressed={mode === m} onClick={() => changeMode(m)}>
              {m === 'keluar' ? 'Keluar' : m === 'masuk' ? 'Masuk' : 'Transfer'}
            </button>
          ))}
        </div>

        <div className={`amount-display${amount > 0 ? '' : ' empty'}`} aria-live="polite">
          {amountTouched || !initial ? `Rp ${formatNumber(Number(digits || 0))}` : formatRupiah(initial.nominal)}
        </div>

        {/* Akun & tanggal selalu terlihat, memakai pemilih bawaan HP supaya ringkas. */}
        <div className="meta-row">
          {mode === 'transfer' ? (
            <>
              <label className="meta-chip">
                <span className="meta-label">Dari</span>
                <select value={from} onChange={e => setFrom(e.target.value)}>
                  {transferable.map(a => <option key={a.nama} value={a.nama}>{a.nama}</option>)}
                </select>
              </label>
              <label className="meta-chip">
                <span className="meta-label">Ke</span>
                <select value={to} onChange={e => setTo(e.target.value)}>
                  <option value="">Pilih…</option>
                  {transferable.map(a => <option key={a.nama} value={a.nama}>{a.nama}</option>)}
                </select>
              </label>
            </>
          ) : (
            <label className="meta-chip">
              <span className="meta-label">{mode === 'keluar' ? 'Dari' : 'Ke'}</span>
              <select value={account} onChange={e => setAccount(e.target.value)}>
                {liquid.map(a => <option key={a.nama} value={a.nama}>{a.nama}</option>)}
              </select>
            </label>
          )}
          <label className="meta-chip">
            <span aria-hidden="true">📅</span>
            <span className="visually-hidden">Tanggal</span>
            {pickAnyDate ? (
              <input type="date" value={date} onChange={e => e.target.value && setDate(e.target.value)} />
            ) : (
              <select value={date} onChange={e => (e.target.value === OTHER_DATE ? setPickAnyDate(true) : setDate(e.target.value))}>
                {recentDates.map((iso, i) => (
                  <option key={iso} value={iso}>{i === 0 ? 'Hari ini' : i === 1 ? 'Kemarin' : shortDayLabel(iso)}</option>
                ))}
                <option value={OTHER_DATE}>Tanggal lain…</option>
              </select>
            )}
          </label>
        </div>

        <div className="sheet-body">
          <label className="field">
            <span className="visually-hidden">Keterangan</span>
            <input className="input" type="text" value={description} maxLength={200} autoComplete="off"
              placeholder="Keterangan (misal: nasi pecel)" onChange={e => setDescription(e.target.value)} />
          </label>

          {mode !== 'transfer' && (
            <>
              <div className="section-label">
                Kategori
                {!chosen && suggested && <span className="hint">✨ ditebak dari keterangan</span>}
              </div>
              <div className="chips">
                {categories.map(k => {
                  const t: Target = { kind: 'kategori', nama: k.nama }
                  return (
                    <button key={k.nama} type="button" className="chip" aria-pressed={sameTarget(target, t)} onClick={() => pick(t)}>
                      <span aria-hidden="true">{k.ikon}</span>{k.nama}
                    </button>
                  )
                })}
              </div>
              {people.length > 0 && (
                <>
                  <div className="section-label">
                    {mode === 'keluar' ? 'Bayarin / pinjamkan ke' : 'Terima dari (bayar utang / pinjaman)'}
                  </div>
                  <div className="chips">
                    {people.map(p => {
                      const t: Target = { kind: 'orang', nama: p.nama }
                      return (
                        <button key={p.nama} type="button" className="chip" aria-pressed={sameTarget(target, t)} onClick={() => pick(t)}>
                          <span aria-hidden="true">👤</span>{p.nama}
                        </button>
                      )
                    })}
                  </div>
                </>
              )}
            </>
          )}
          {mode === 'transfer' && (
            <p className="note">Transfer antar akunmu sendiri (top up e-wallet, tarik tunai, setor ke Bibit) tidak dihitung sebagai pengeluaran.</p>
          )}
          {error && <p className="note error" role="alert">{error}</p>}
        </div>

        <div className="keypad">
          {KEYS.map(key => (
            <button key={key} type="button" onClick={() => press(key)} aria-label={key === 'back' ? 'Hapus angka' : key}>
              {key === 'back' ? '⌫' : key}
            </button>
          ))}
        </div>
        <div className="sheet-footer">
          <button type="button" className="btn primary block" onClick={submit}>Simpan</button>
        </div>
      </div>
    </div>
  )
}
