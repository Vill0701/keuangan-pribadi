import { monthLabel, shiftMonth } from '../lib/format.ts'

interface Props {
  month: string
  onChange: (month: string) => void
  max?: string
}

export function MonthNav({ month, onChange, max }: Props) {
  return (
    <div className="month-nav">
      <button type="button" aria-label="Bulan sebelumnya" onClick={() => onChange(shiftMonth(month, -1))}>‹</button>
      <strong aria-live="polite">{monthLabel(month)}</strong>
      <button type="button" aria-label="Bulan berikutnya" disabled={Boolean(max) && month >= (max ?? '')}
        onClick={() => onChange(shiftMonth(month, 1))}>›</button>
    </div>
  )
}
