import { useMemo } from 'react'
import type { DataKeuangan, Transaksi } from '../types.ts'
import { isLiquid, personStatus, sortTransactions, totalsBetween } from '../lib/calc.ts'
import { daysInMonth, formatRupiah, monthOf, shiftMonth, todayIso } from '../lib/format.ts'
import { TransactionRow } from './TransactionRow.tsx'

interface Props {
  data: DataKeuangan
  balances: Map<string, number>
  pending: Set<string>
  onSelect: (tx: Transaksi) => void
  onSeeAll: () => void
}

const KIND_ICON: Record<string, string> = { bank: '🏦', ewallet: '📱', tunai: '💵', investasi: '📈', orang: '👤' }

export function Home({ data, balances, pending, onSelect, onSeeAll }: Props) {
  const today = todayIso()
  const month = monthOf(today)
  const accounts = useMemo(() => [...data.akun].sort((a, b) => a.urutan - b.urutan), [data.akun])
  const categories = useMemo(() => new Map(data.kategori.map(k => [k.nama, k])), [data.kategori])
  const accountMap = useMemo(() => new Map(data.akun.map(a => [a.nama, a])), [data.akun])
  const balanceOf = (name: string) => balances.get(name) ?? 0

  const liquid = accounts.filter(a => isLiquid(a) && (a.aktif || Math.round(balanceOf(a.nama)) !== 0))
  const investments = accounts.filter(a => a.jenis === 'investasi' && (a.aktif || Math.round(balanceOf(a.nama)) !== 0))
  const people = accounts.filter(a => a.jenis === 'orang' && (a.aktif || Math.round(balanceOf(a.nama)) !== 0))
  const total = liquid.reduce((sum, a) => sum + balanceOf(a.nama), 0)

  // Pengeluaran bulan ini dibanding periode yang sama bulan lalu (tanggal 1 s.d. hari ini).
  const current = totalsBetween(data, `${month}-01`, today)
  const previousMonth = shiftMonth(month, -1)
  const sameDay = Math.min(Number(today.slice(8, 10)), daysInMonth(previousMonth))
  const previous = totalsBetween(data, `${previousMonth}-01`, `${previousMonth}-${String(sameDay).padStart(2, '0')}`)
  const delta = previous.keluar > 0 ? (current.keluar - previous.keluar) / previous.keluar : null
  const recent = useMemo(() => sortTransactions(data.transaksi).slice(0, 8), [data.transaksi])

  return (
    <>
      <section className="card" aria-labelledby="total-saldo">
        <div className="hero-label" id="total-saldo">Total saldo</div>
        <div className="hero-value">{formatRupiah(total)}</div>
        <div className="hero-sub">Bank, e-wallet & tunai</div>
        <ul className="list" style={{ marginTop: 12 }}>
          {liquid.map(a => (
            <li key={a.nama} className="row">
              <span className="icon" aria-hidden="true">{KIND_ICON[a.jenis]}</span>
              <span className="main"><span className="title">{a.nama}</span></span>
              <span className="amount">{formatRupiah(balanceOf(a.nama))}</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="tiles">
        <div className="tile">
          <div className="label">Pemasukan bulan ini</div>
          <div className="value">{formatRupiah(current.masuk)}</div>
        </div>
        <div className="tile">
          <div className="label">Pengeluaran bulan ini</div>
          <div className="value">{formatRupiah(current.keluar)}</div>
          {delta !== null && <Delta value={delta} />}
        </div>
      </div>

      {(investments.length > 0 || people.length > 0) && (
        <section className="card">
          {investments.length > 0 && (
            <>
              <h2>Investasi</h2>
              <ul className="list">
                {investments.map(a => (
                  <li key={a.nama} className="row">
                    <span className="icon" aria-hidden="true">📈</span>
                    <span className="main">
                      <span className="title">{a.nama}</span>
                      <span className="sub">Setoran dikurangi pencairan</span>
                    </span>
                    <span className="amount">{formatRupiah(balanceOf(a.nama))}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          {people.length > 0 && (
            <>
              <h2 style={investments.length ? { marginTop: 16 } : undefined}>Utang & piutang</h2>
              <ul className="list">
                {people.map(a => {
                  const balance = balanceOf(a.nama)
                  return (
                    <li key={a.nama} className="row">
                      <span className="icon" aria-hidden="true">👤</span>
                      <span className="main">
                        <span className="title">{a.nama}</span>
                        <span className="sub">{personStatus(a.nama, balance)}</span>
                      </span>
                      <span className="amount">{formatRupiah(Math.abs(balance))}</span>
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </section>
      )}

      <section className="card">
        <div className="card-head">
          <h2>Transaksi terakhir</h2>
          {recent.length > 0 && <button type="button" className="link-button" onClick={onSeeAll}>Lihat semua</button>}
        </div>
        {recent.length === 0 ? (
          <p className="empty">Belum ada transaksi. Tekan tombol + untuk mencatat.</p>
        ) : (
          <ul className="list">
            {recent.map(tx => (
              <TransactionRow key={tx.id} tx={tx} categories={categories} accounts={accountMap}
                pending={pending.has(tx.id)} showDate onSelect={onSelect} />
            ))}
          </ul>
        )}
      </section>
    </>
  )
}

/** Naik = buruk untuk pengeluaran; panah + teks, bukan warna saja. */
function Delta({ value }: { value: number }) {
  const percent = Math.round(Math.abs(value) * 100)
  if (percent === 0) return <div className="delta">≈ sama dengan periode yang sama bulan lalu</div>
  const up = value > 0
  return (
    <div className={`delta ${up ? 'bad' : 'good'}`}>
      <span className="arrow" aria-hidden="true">{up ? '▲' : '▼'}</span> {up ? 'Naik' : 'Turun'} {percent}% dari periode yang sama bulan lalu
    </div>
  )
}
