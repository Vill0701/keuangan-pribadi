import { useMemo } from 'react'
import type { DataKeuangan, Kategori } from '../types.ts'
import { monthlyTrend, summarizeMonth } from '../lib/calc.ts'
import { formatCompact, formatRupiah, monthOf, todayIso } from '../lib/format.ts'
import { MonthNav } from './MonthNav.tsx'
import { TrendChart } from './TrendChart.tsx'

interface Props {
  data: DataKeuangan
  month: string
  onMonthChange: (month: string) => void
  onDrill: (query: string) => void
}

// Warna mengikuti grupnya (bukan peringkat), jadi Kebutuhan selalu biru di bulan mana pun.
const GROUP_COLORS: Record<string, string> = {
  Kebutuhan: 'var(--series-1)',
  Keinginan: 'var(--series-2)',
  Memberi: 'var(--series-3)',
  Lainnya: 'var(--other)',
}

function percent(part: number, whole: number): string {
  return whole > 0 ? `${Math.round((part / whole) * 100)}%` : '–'
}

export function Summary({ data, month, onMonthChange, onDrill }: Props) {
  const summary = useMemo(() => summarizeMonth(data, month), [data, month])
  const trend = useMemo(() => monthlyTrend(data, month, 6), [data, month])
  const budgets = data.kategori
    .filter(k => k.aktif && k.tipe === 'keluar' && k.budget_bulanan)
    .sort((a, b) => a.urutan - b.urutan)
  const spentBy = new Map(summary.keluarPerKategori.map(c => [c.nama, c.total]))
  const largest = summary.keluarPerKategori[0]?.total ?? 0
  const net = summary.masuk - summary.keluar

  return (
    <>
      <MonthNav month={month} onChange={onMonthChange} max={monthOf(todayIso())} />

      <section className="card">
        <dl className="totals">
          <div><dt>Pemasukan</dt><dd>{formatRupiah(summary.masuk)}</dd></div>
          <div><dt>Pengeluaran</dt><dd>{formatRupiah(summary.keluar)}</dd></div>
          <div className="net"><dt>Selisih</dt><dd>{net > 0 ? '+' : ''}{formatRupiah(net)}</dd></div>
        </dl>
      </section>

      {summary.keluar > 0 && (
        <section className="card">
          <h2>Kebutuhan, keinginan & memberi</h2>
          <div className="stack" role="img"
            aria-label={summary.perGrup.map(g => `${g.grup} ${percent(g.total, summary.keluar)}`).join(', ')}>
            {summary.perGrup.map(g => (
              <span key={g.grup} style={{ flex: `${g.total} 0 0`, background: GROUP_COLORS[g.grup] }} />
            ))}
          </div>
          {summary.perGrup.map(g => (
            <div key={g.grup} className="legend-row">
              <span className="swatch" style={{ background: GROUP_COLORS[g.grup] }} aria-hidden="true" />
              <span>{g.grup}</span>
              <span className="val">{formatRupiah(g.total)}</span>
              <span className="pct">{percent(g.total, summary.keluar)}</span>
            </div>
          ))}
        </section>
      )}

      <section className="card">
        <h2>Budget vs realisasi</h2>
        {budgets.length === 0 ? (
          <p className="note" style={{ marginTop: 0 }}>
            Isi kolom <b>budget_bulanan</b> di tab Kategori (Google Sheet) untuk melihat budget vs realisasi di sini.
          </p>
        ) : (
          budgets.map(k => <BudgetRow key={k.nama} kategori={k} spent={spentBy.get(k.nama) ?? 0} />)
        )}
      </section>

      <section className="card">
        <h2>Pengeluaran per kategori</h2>
        {summary.keluarPerKategori.length === 0 ? (
          <p className="empty">Belum ada pengeluaran di bulan ini.</p>
        ) : (
          summary.keluarPerKategori.map(c => (
            <button key={c.nama} type="button" className="cat-row" onClick={() => onDrill(c.nama)}>
              <span className="line">
                <span aria-hidden="true">{c.kategori?.ikon ?? '📦'}</span>
                <span className="name">{c.nama}</span>
                <span className="val">{formatRupiah(c.total)}</span>
                <span className="pct">{percent(c.total, summary.keluar)}</span>
              </span>
              <span className="bar"><span style={{ width: `${(c.total / largest) * 100}%` }} /></span>
            </button>
          ))
        )}
      </section>

      {summary.masukPerKategori.length > 0 && (
        <section className="card">
          <h2>Pemasukan per kategori</h2>
          {summary.masukPerKategori.map(c => (
            <button key={c.nama} type="button" className="cat-row" onClick={() => onDrill(c.nama)}>
              <span className="line">
                <span aria-hidden="true">{c.kategori?.ikon ?? '💰'}</span>
                <span className="name">{c.nama}</span>
                <span className="val">{formatRupiah(c.total)}</span>
                <span className="pct">{percent(c.total, summary.masuk)}</span>
              </span>
            </button>
          ))}
        </section>
      )}

      <section className="card">
        <h2>Tren 6 bulan</h2>
        <TrendChart points={trend} current={month} />
      </section>
    </>
  )
}

/** Meter budget: biru = aman, kuning = ≥80%, merah = lewat. Selalu dengan ikon + teks. */
function BudgetRow({ kategori, spent }: { kategori: Kategori; spent: number }) {
  const budget = kategori.budget_bulanan ?? 0
  const ratio = budget > 0 ? spent / budget : 0
  const level = ratio > 1 ? 'over' : ratio >= 0.8 ? 'warn' : ''
  const note = level === 'over'
    ? `⛔ Lewat ${formatRupiah(spent - budget)}`
    : level === 'warn'
      ? `⚠️ ${Math.round(ratio * 100)}% terpakai · sisa ${formatRupiah(budget - spent)}`
      : `Sisa ${formatRupiah(budget - spent)}`
  return (
    <div className="cat-row">
      <div className="line">
        <span aria-hidden="true">{kategori.ikon}</span>
        <span className="name">{kategori.nama}</span>
        <span className="val">{formatRupiah(spent)}</span>
        <span className="budget-of">/ {formatCompact(budget)}</span>
      </div>
      <div className={`meter ${level}`} role="meter" aria-valuemin={0} aria-valuemax={budget} aria-valuenow={Math.min(spent, budget)}
        aria-label={`${kategori.nama}: ${formatRupiah(spent)} dari budget ${formatRupiah(budget)}`}>
        <span style={{ width: `${Math.min(ratio, 1) * 100}%` }} />
      </div>
      <div className="meter-note">{note}</div>
    </div>
  )
}
