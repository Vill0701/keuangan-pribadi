import { useEffect, useMemo, useState } from 'react'
import type { Transaksi } from './types.ts'
import { computeBalances } from './lib/calc.ts'
import { monthOf, todayIso } from './lib/format.ts'
import { buildHistory } from './lib/suggest.ts'
import {
  applyQueue, deleteTransaction, pendingIds, saveTransaction, syncNow, useFinance, type FinanceState,
} from './store.ts'
import { AddSheet } from './components/AddSheet.tsx'
import { History } from './components/History.tsx'
import { Home } from './components/Home.tsx'
import { Icon, type IconName } from './components/Icon.tsx'
import { Settings } from './components/Settings.tsx'
import { Summary } from './components/Summary.tsx'

type Tab = 'beranda' | 'riwayat' | 'ringkasan' | 'pengaturan'

const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'beranda', label: 'Beranda', icon: 'home' },
  { id: 'riwayat', label: 'Riwayat', icon: 'list' },
  { id: 'ringkasan', label: 'Ringkasan', icon: 'chart' },
  { id: 'pengaturan', label: 'Pengaturan', icon: 'settings' },
]

export default function App() {
  const state = useFinance()
  const ready = Boolean(state.koneksi || state.demo)
  const data = useMemo(() => applyQueue(state.server, state.antrean), [state.server, state.antrean])
  const balances = useMemo(() => computeBalances(data), [data])
  const history = useMemo(() => buildHistory(data), [data])
  const pending = useMemo(() => pendingIds(state.antrean), [state.antrean])

  const [tab, setTab] = useState<Tab>(ready ? 'beranda' : 'pengaturan')
  const [sheet, setSheet] = useState<{ tx: Transaksi | null } | null>(() =>
    ready && new URLSearchParams(window.location.search).has('catat') ? { tx: null } : null)
  const [historyMonth, setHistoryMonth] = useState(() => monthOf(todayIso()))
  const [historyQuery, setHistoryQuery] = useState('')
  const [summaryMonth, setSummaryMonth] = useState(() => monthOf(todayIso()))
  const [toast, setToast] = useState('')
  const activeTab: Tab = ready ? tab : 'pengaturan'

  useEffect(() => {
    // Pintasan "Catat transaksi" membuka ?catat=1; dibersihkan supaya tidak terbuka lagi saat dimuat ulang.
    if (window.location.search) window.history.replaceState(null, '', window.location.pathname)
    void syncNow()
    const onOnline = () => void syncNow()
    const onVisible = () => {
      if (document.visibilityState === 'visible') void syncNow()
    }
    window.addEventListener('online', onOnline)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('online', onOnline)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 2400)
    return () => window.clearTimeout(timer)
  }, [toast])

  function handleSave(tx: Transaksi) {
    saveTransaction(tx)
    setSheet(null)
    setToast(state.demo || navigator.onLine ? 'Tersimpan ✓' : 'Tersimpan di perangkat, dikirim saat online')
  }

  function handleDelete(id: string) {
    deleteTransaction(id)
    setSheet(null)
    setToast('Transaksi dihapus')
  }

  return (
    <div className="app">
      <header className="topbar">
        <h1>{TABS.find(t => t.id === activeTab)?.label}</h1>
        {ready && (
          <SyncPill state={state} onClick={() => (state.demo || state.galat ? setTab('pengaturan') : void syncNow())} />
        )}
      </header>

      <main>
        {activeTab === 'beranda' && (
          <Home data={data} balances={balances} pending={pending} onSelect={tx => setSheet({ tx })}
            onSeeAll={() => setTab('riwayat')} />
        )}
        {activeTab === 'riwayat' && (
          <History data={data} pending={pending} month={historyMonth} query={historyQuery}
            onMonthChange={setHistoryMonth} onQueryChange={setHistoryQuery} onSelect={tx => setSheet({ tx })} />
        )}
        {activeTab === 'ringkasan' && (
          <Summary data={data} month={summaryMonth} onMonthChange={setSummaryMonth}
            onDrill={query => {
              setHistoryMonth(summaryMonth)
              setHistoryQuery(query)
              setTab('riwayat')
            }} />
        )}
        {activeTab === 'pengaturan' && <Settings state={state} onReady={() => setTab('beranda')} />}
      </main>

      {ready && (
        <>
          <button type="button" className="fab" aria-label="Catat transaksi" onClick={() => setSheet({ tx: null })}>+</button>
          <nav className="bottom-nav" aria-label="Navigasi utama">
            <div className="inner">
              {TABS.map(t => (
                <button key={t.id} type="button" aria-current={activeTab === t.id ? 'page' : undefined} onClick={() => setTab(t.id)}>
                  <Icon name={t.icon} />
                  {t.label}
                </button>
              ))}
            </div>
          </nav>
        </>
      )}

      {sheet && (
        <AddSheet data={data} history={history} initial={sheet.tx} onSave={handleSave} onDelete={handleDelete}
          onClose={() => setSheet(null)} />
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  )
}

function SyncPill({ state, onClick }: { state: FinanceState; onClick: () => void }) {
  const queued = state.antrean.length
  let tone = 'ok'
  let text = 'Tersinkron'
  if (state.demo) {
    tone = 'demo'
    text = 'Mode demo'
  } else if (state.menyinkron) {
    tone = 'pending'
    text = 'Menyinkron…'
  } else if (state.galat) {
    tone = 'error'
    text = 'Gagal sinkron'
  } else if (state.offline) {
    tone = 'pending'
    text = queued ? `Offline · ${queued} menunggu` : 'Offline'
  } else if (queued) {
    tone = 'pending'
    text = `${queued} menunggu`
  }
  return (
    <button type="button" className={`sync-pill ${tone}`} onClick={onClick} title={state.galat ?? 'Ketuk untuk sinkron'}>
      <span className="dot" aria-hidden="true" />
      {text}
    </button>
  )
}
