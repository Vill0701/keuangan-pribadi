import { useMemo } from 'react'
import type { DataKeuangan, Transaksi } from '../types.ts'
import { sortTransactions } from '../lib/calc.ts'
import { dayLabel, formatRupiah, monthOf, todayIso } from '../lib/format.ts'
import { normalize } from '../lib/suggest.ts'
import { MonthNav } from './MonthNav.tsx'
import { TransactionRow } from './TransactionRow.tsx'

interface Props {
  data: DataKeuangan
  pending: Set<string>
  month: string
  query: string
  onMonthChange: (month: string) => void
  onQueryChange: (query: string) => void
  onSelect: (tx: Transaksi) => void
}

export function History({ data, pending, month, query, onMonthChange, onQueryChange, onSelect }: Props) {
  const categories = useMemo(() => new Map(data.kategori.map(k => [k.nama, k])), [data.kategori])
  const accounts = useMemo(() => new Map(data.akun.map(a => [a.nama, a])), [data.akun])

  const days = useMemo(() => {
    const needle = normalize(query).trim()
    const filtered = sortTransactions(data.transaksi).filter(t => {
      if (monthOf(t.tanggal) !== month) return false
      if (!needle) return true
      return normalize([t.keterangan, t.kategori, t.akun, t.akun_tujuan].join(' ')).includes(needle)
    })
    const groups = new Map<string, Transaksi[]>()
    filtered.forEach(t => groups.set(t.tanggal, [...(groups.get(t.tanggal) ?? []), t]))
    return [...groups]
  }, [data.transaksi, month, query])

  const totals = days.flatMap(([, list]) => list).reduce(
    (sum, t) => ({
      masuk: sum.masuk + (t.tipe === 'masuk' ? t.nominal : 0),
      keluar: sum.keluar + (t.tipe === 'keluar' ? t.nominal : 0),
    }),
    { masuk: 0, keluar: 0 },
  )

  return (
    <>
      <MonthNav month={month} onChange={onMonthChange} max={monthOf(todayIso())} />
      <label className="field">
        <span className="visually-hidden">Cari transaksi</span>
        <input className="input" type="search" value={query} placeholder="Cari keterangan, kategori, atau akun"
          onChange={e => onQueryChange(e.target.value)} />
      </label>
      <p className="note" style={{ margin: '0 4px 4px' }}>
        Keluar {formatRupiah(totals.keluar)} · Masuk {formatRupiah(totals.masuk)}
      </p>

      {days.length === 0 ? (
        <p className="empty">{query ? 'Tidak ada transaksi yang cocok.' : 'Belum ada transaksi di bulan ini.'}</p>
      ) : (
        days.map(([date, list]) => {
          const spent = list.reduce((sum, t) => sum + (t.tipe === 'keluar' ? t.nominal : 0), 0)
          return (
            <section key={date}>
              <div className="day-head">
                <span>{dayLabel(date)}</span>
                {spent > 0 && <span>{formatRupiah(-spent)}</span>}
              </div>
              <div className="card" style={{ padding: '4px 16px' }}>
                <ul className="list">
                  {list.map(tx => (
                    <TransactionRow key={tx.id} tx={tx} categories={categories} accounts={accounts}
                      pending={pending.has(tx.id)} onSelect={onSelect} />
                  ))}
                </ul>
              </div>
            </section>
          )
        })
      )}
    </>
  )
}
