import type { Akun, Kategori, Transaksi } from '../types.ts'
import { formatRupiah, shortDate } from '../lib/format.ts'

interface Props {
  tx: Transaksi
  categories: Map<string, Kategori>
  accounts: Map<string, Akun>
  pending: boolean
  showDate?: boolean
  onSelect: (tx: Transaksi) => void
}

interface RowView {
  icon: string
  title: string
  sub: string
  amount: string
  tone: '' | 'in' | 'move'
}

function describe(tx: Transaksi, categories: Map<string, Kategori>, accounts: Map<string, Akun>): RowView {
  if (tx.tipe === 'transfer') {
    const from = accounts.get(tx.akun)
    const to = accounts.get(tx.akun_tujuan)
    const route = `${tx.akun} → ${tx.akun_tujuan}`
    if (to?.jenis === 'orang') {
      return { icon: '👤', title: tx.keterangan || `Bayarin ${tx.akun_tujuan}`, sub: route, amount: formatRupiah(tx.nominal), tone: 'move' }
    }
    if (from?.jenis === 'orang') {
      return { icon: '👤', title: tx.keterangan || `Dari ${tx.akun}`, sub: route, amount: formatRupiah(tx.nominal), tone: 'move' }
    }
    const icon = from?.jenis === 'investasi' || to?.jenis === 'investasi' ? '📈' : '⇄'
    return { icon, title: tx.keterangan || 'Transfer', sub: route, amount: formatRupiah(tx.nominal), tone: 'move' }
  }
  const category = categories.get(tx.kategori)
  const incoming = tx.tipe === 'masuk'
  return {
    icon: category?.ikon || (incoming ? '💰' : '💸'),
    title: tx.keterangan || tx.kategori,
    sub: `${tx.kategori} · ${tx.akun}`,
    amount: incoming ? '+' + formatRupiah(tx.nominal) : formatRupiah(-tx.nominal),
    tone: incoming ? 'in' : '',
  }
}

export function TransactionRow({ tx, categories, accounts, pending, showDate, onSelect }: Props) {
  const view = describe(tx, categories, accounts)
  const sub = showDate ? `${shortDate(tx.tanggal)} · ${view.sub}` : view.sub
  return (
    <li>
      <button type="button" className="row" onClick={() => onSelect(tx)}>
        <span className="icon" aria-hidden="true">{view.icon}</span>
        <span className="main">
          <span className="title">
            {view.title}
            {pending && <span className="pending-dot" title="Belum tersinkron" />}
          </span>
          <span className="sub">{sub}</span>
        </span>
        <span className={`amount ${view.tone}`}>{view.amount}</span>
      </button>
    </li>
  )
}
