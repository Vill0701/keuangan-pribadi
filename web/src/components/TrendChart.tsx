// Kolom berkelompok: pemasukan (seri 1) vs pengeluaran (seri 2) per bulan.
// Satu sumbu, legenda selalu ada, tooltip per bulan, dan tabel angka sebagai pendamping.

import { useState } from 'react'
import type { TrendPoint } from '../lib/calc.ts'
import { formatCompact, formatRupiah, monthLabel, monthShortLabel } from '../lib/format.ts'

const W = 340
const H = 200
const PAD = { top: 12, right: 4, bottom: 24, left: 42 }
const SERIES = [
  { key: 'masuk', label: 'Pemasukan', color: 'var(--series-1)' },
  { key: 'keluar', label: 'Pengeluaran', color: 'var(--series-2)' },
] as const

/** Batas atas sumbu yang "bulat", dan titik tengahnya juga bulat (misal 6 jt → 3 jt). */
function niceMax(value: number): number {
  const magnitude = 10 ** Math.floor(Math.log10(value))
  const step = [1, 1.2, 1.6, 2, 3, 4, 5, 6, 8, 10].find(n => n * magnitude >= value) ?? 10
  return step * magnitude
}

/** Batang dengan ujung data membulat 4px dan dasar persegi. */
function barPath(x: number, top: number, width: number, base: number): string {
  const height = base - top
  if (height <= 0.5) return ''
  const r = Math.min(4, width / 2, height)
  return `M${x},${base}V${top + r}Q${x},${top} ${x + r},${top}H${x + width - r}Q${x + width},${top} ${x + width},${top + r}V${base}Z`
}

export function TrendChart({ points, current }: { points: TrendPoint[]; current: string }) {
  // Bulan yang angkanya ditampilkan: default bulan terakhir, berganti saat disentuh/diarahkan.
  const [active, setActive] = useState(points.length - 1)
  const max = niceMax(Math.max(1, ...points.flatMap(p => [p.masuk, p.keluar])))
  const plotW = W - PAD.left - PAD.right
  const plotH = H - PAD.top - PAD.bottom
  const base = PAD.top + plotH
  const band = plotW / points.length
  const barW = Math.min(16, (band - 12) / 2)
  const y = (value: number) => base - (value / max) * plotH
  const shown = points[Math.min(active, points.length - 1)]

  return (
    <div className="chart">
      <div className="legend-inline">
        {SERIES.map(s => (
          <span key={s.key}><i className="swatch" style={{ background: s.color }} aria-hidden="true" />{s.label}</span>
        ))}
      </div>
      {/* Panel angka di atas grafik (pengganti tooltip): tidak pernah menutupi batang atau keluar layar. */}
      <div className="readout" aria-live="polite">
        <div className="t-title">{monthLabel(shown.month)}</div>
        <div className="t-rows">
          {SERIES.map(s => (
            <span key={s.key} className="t-row">
              <i className="t-key" style={{ background: s.color }} aria-hidden="true" />
              <strong>{formatRupiah(shown[s.key])}</strong>
              <span>{s.label}</span>
            </span>
          ))}
        </div>
      </div>
      <div>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Pemasukan dan pengeluaran per bulan, 6 bulan terakhir. Angka lengkap ada di tabel di bawah.">
          {[0, max / 2, max].map(tick => (
            <g key={tick}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(tick)} y2={y(tick)} stroke={tick === 0 ? 'var(--axis)' : 'var(--grid)'}
                strokeWidth={1} shapeRendering="crispEdges" />
              <text className="tick" x={PAD.left - 6} y={y(tick)} dy="0.32em" textAnchor="end">{formatCompact(tick)}</text>
            </g>
          ))}
          {points.map((p, i) => {
            const center = PAD.left + band * (i + 0.5)
            return (
              <g key={p.month}>
                <rect className={`hit${active === i ? ' active' : ''}`} x={PAD.left + band * i + 2} y={PAD.top} width={band - 4} height={plotH}
                  rx={6} tabIndex={0} aria-label={`${monthLabel(p.month)}: pemasukan ${formatRupiah(p.masuk)}, pengeluaran ${formatRupiah(p.keluar)}`}
                  onPointerEnter={() => setActive(i)} onClick={() => setActive(i)} onFocus={() => setActive(i)} />
                <path d={barPath(center - barW - 1, y(p.masuk), barW, base)} fill={SERIES[0].color} pointerEvents="none" />
                <path d={barPath(center + 1, y(p.keluar), barW, base)} fill={SERIES[1].color} pointerEvents="none" />
                <text className={`tick${p.month === current ? ' current' : ''}`} x={center} y={H - 7} textAnchor="middle">
                  {monthShortLabel(p.month)}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
      <details className="table-view">
        <summary>Lihat angka</summary>
        <table className="data">
          <thead>
            <tr><th scope="col">Bulan</th><th scope="col">Pemasukan</th><th scope="col">Pengeluaran</th><th scope="col">Selisih</th></tr>
          </thead>
          <tbody>
            {points.map(p => (
              <tr key={p.month}>
                <td>{monthLabel(p.month)}</td>
                <td>{formatRupiah(p.masuk)}</td>
                <td>{formatRupiah(p.keluar)}</td>
                <td>{formatRupiah(p.masuk - p.keluar)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  )
}
