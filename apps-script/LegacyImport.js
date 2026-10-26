/**
 * Impor data dari format sheet lama:
 *   Tanggal | Keterangan | Kategori | Jenis Transaksi | Nominal | Metode Pembayaran
 * Tempel data lama di tab "Impor" mulai baris 2, lalu jalankan menu 💰 Keuangan → Impor data lama.
 * Aman dijalankan ulang: baris yang sudah pernah diimpor (ID sama) dilewati.
 */

// Kategori lama → kategori baru. Kategori lama lain (Kebutuhan/Keinginan) ditebak dari keterangan.
const LEGACY_CATEGORY_MAP = {
  'gaji': 'Gaji',
  'freelance': 'Freelance',
  'beasiswa': 'Beasiswa',
  'pendapatan lain': 'Pemasukan Lain',
  'orang tua': 'Orang Tua',
  'kuliah': 'Pendidikan',
  'sedekah': 'Sedekah',
  'transport': 'Transport',
  'bpjs': 'Kesehatan',
  'biaya admin': 'Biaya Admin',
}
const LEGACY_GROUPS = { kebutuhan: 'Kebutuhan', keinginan: 'Keinginan' }
const LEGACY_DEBT_PERSON = 'Hutang (lama)'
const MAX_REPORTED_WARNINGS = 25

function importLegacy() {
  const sheet = getSheet_(SHEET_NAMES.legacyImport)
  if (sheet.getLastRow() < 2) {
    notify_('Tab Impor masih kosong',
      'Tempel data lama (kolom Tanggal sampai Metode Pembayaran) mulai baris 2, lalu jalankan menu ini lagi.')
    return
  }
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, HEADERS.Impor.length).getValues()
    .map(r => [toIsoDate_(r[0]) || String(r[0])].concat(r.slice(1)))

  const report = withLock_(() => {
    const result = convertLegacyRows_(rows, readAccounts_(), readCategories_())

    if (result.newAccounts.length) {
      const accountSheet = getSheet_(SHEET_NAMES.accounts)
      const accountHeaders = readHeaders_(accountSheet)
      const newRows = result.newAccounts.map(a => accountHeaders.map(h => (h in a ? a[h] : '')))
      accountSheet.getRange(accountSheet.getLastRow() + 1, 1, newRows.length, accountHeaders.length).setValues(newRows)
    }

    const existingIds = new Set(readTransactions_().map(t => t.id))
    const fresh = result.transactions.filter(t => !existingIds.has(t.id))
    const table = readTable_(SHEET_NAMES.transactions)
    const now = new Date().toISOString()
    const newRows = fresh.map(t => transactionToRow_(table.headers, Object.assign({}, t, { dibuat: now, diubah: now }), null))
    appendTransactionRows_(table.sheet, table.headers, newRows)
    return { result: result, fresh: fresh, duplicates: result.transactions.length - fresh.length }
  })

  report.result.warnings.forEach(w => console.log(w))
  notify_('Impor selesai', formatImportReport_(report))
}

/**
 * Mengubah baris format lama menjadi transaksi format baru.
 * Fungsi murni (tanpa akses sheet) supaya bisa diuji di komputer.
 */
function convertLegacyRows_(rows, accounts, categories) {
  const out = { transactions: [], newAccounts: [], warnings: [], skipped: 0 }
  const accountsByKey = {}
  accounts.forEach(a => { accountsByKey[accountKey_(a.nama)] = a })
  const hasCategory = (nama, tipe) => categories.some(c => c.nama === nama && c.tipe === tipe)
  const kasSilang = []
  let emptyAmount = 0

  const ensureAccount = (nama, jenis) => {
    const key = accountKey_(nama)
    if (!accountsByKey[key]) {
      const account = { nama: nama, jenis: jenis, saldo_awal: 0, urutan: accounts.length + out.newAccounts.length + 1, aktif: true }
      accountsByKey[key] = account
      out.newAccounts.push(account)
    }
    return accountsByKey[key].nama
  }
  const investmentAccount = () => {
    const key = Object.keys(accountsByKey).find(k => accountsByKey[k].jenis === 'investasi')
    return key ? accountsByKey[key].nama : ensureAccount('Investasi', 'investasi')
  }

  rows.forEach((r, i) => {
    const rowNo = i + 2
    const desc = String(r[1] === undefined || r[1] === null ? '' : r[1]).trim()
    const oldCategory = String(r[2] || '').trim()
    const oldKey = oldCategory.toLowerCase()
    const jenis = String(r[3] || '').trim().toLowerCase()
    const amount = toNumber_(r[4])
    const method = String(r[5] || '').trim()

    if (!desc && !oldCategory && !method && !amount) return
    if (!isFinite(amount) || amount === 0) {
      emptyAmount++
      out.skipped++
      return
    }
    const tanggal = toIsoDate_(r[0])
    if (!tanggal) {
      out.skipped++
      out.warnings.push('Baris ' + rowNo + ': tanggal "' + r[0] + '" tidak terbaca, dilewati')
      return
    }
    const account = accountsByKey[accountKey_(method)]
    if (!account) {
      out.skipped++
      out.warnings.push('Baris ' + rowNo + ': metode "' + method + '" tidak ada di tab Akun, dilewati')
      return
    }

    const direction = jenis === 'pemasukan' ? 'masuk' : jenis === 'pengeluaran' ? 'keluar' : amount < 0 ? 'keluar' : 'masuk'
    const base = {
      id: legacyId_(i, r), tanggal: tanggal, nominal: Math.abs(amount), keterangan: desc,
      sumber: 'impor', kategori: '', akun_tujuan: '', _row: rowNo,
    }

    // 1) Kas Silang = pindah dana antar akunmu sendiri. Dipasangkan setelah semua baris dibaca.
    if (oldKey === 'kas silang') {
      kasSilang.push({ base: base, direction: direction, account: account.nama, rowNo: rowNo })
      return
    }

    // 2) "Uang <nama>" dan Hutang = utang-piutang dengan seseorang.
    let person = ''
    if (/^uang\s+\S/i.test(oldCategory)) {
      person = ensureAccount(oldCategory.replace(/^uang\s+/i, '').trim(), 'orang')
    } else if (oldKey === 'hutang' || oldKey === 'utang') {
      person = ensureAccount(LEGACY_DEBT_PERSON, 'orang')
      out.warnings.push('Baris ' + rowNo + ': hutang "' + desc + '" dicatat ke "' + LEGACY_DEBT_PERSON + '", ganti dengan nama orangnya')
    }
    if (person) {
      out.transactions.push(Object.assign(base, direction === 'keluar'
        ? { tipe: 'transfer', akun: account.nama, akun_tujuan: person }
        : { tipe: 'transfer', akun: person, akun_tujuan: account.nama }))
      return
    }

    // 3) Investasi & pencairan (misal Bibit) = pindah dana dengan akun investasi.
    if (oldKey === 'investasi' || (direction === 'masuk' && /bibit/i.test(desc))) {
      const investment = investmentAccount()
      out.transactions.push(Object.assign(base, direction === 'keluar'
        ? { tipe: 'transfer', akun: account.nama, akun_tujuan: investment }
        : { tipe: 'transfer', akun: investment, akun_tujuan: account.nama }))
      return
    }

    // 4) Kategori biasa: dipetakan langsung, atau ditebak dari keterangan.
    let kategori = LEGACY_CATEGORY_MAP[oldKey] || ''
    if (kategori && !hasCategory(kategori, direction)) kategori = ''
    if (!kategori) {
      const group = LEGACY_GROUPS[oldKey] || ''
      kategori = adjustConsumptionCategory_(guessCategory_(desc, categories, direction, group), group, categories)
    }
    if (!kategori) {
      kategori = direction === 'masuk' ? 'Pemasukan Lain' : 'Lainnya'
      out.warnings.push('Baris ' + rowNo + ': "' + desc + '" (' + (oldCategory || 'tanpa kategori') + ') dimasukkan ke ' + kategori)
    }
    out.transactions.push(Object.assign(base, { tipe: direction, akun: account.nama, kategori: kategori }))
  })

  pairKasSilang_(kasSilang, accountsByKey, out)
  if (emptyAmount) out.warnings.unshift(emptyAmount + ' baris tanpa nominal dilewati')
  out.transactions.sort((a, b) => a.tanggal.localeCompare(b.tanggal) || a._row - b._row)
  out.transactions.forEach(t => { delete t._row })
  return out
}

/** Penilaian Kebutuhan/Keinginan di sheet lama tetap terbawa: makanan yang dulu "Keinginan" jadi Jajan & Ngopi. */
function adjustConsumptionCategory_(kategori, group, categories) {
  let adjusted = kategori
  if (group === 'Keinginan' && (kategori === 'Makan' || kategori === 'Belanja Harian')) adjusted = 'Jajan & Ngopi'
  if (group === 'Kebutuhan' && kategori === 'Jajan & Ngopi') adjusted = 'Makan'
  return categories.some(c => c.nama === adjusted) ? adjusted : kategori
}

/** Memasangkan baris Kas Silang keluar & masuk (tanggal dan nominal sama) menjadi satu transfer. */
function pairKasSilang_(items, accountsByKey, out) {
  const incoming = items.filter(x => x.direction === 'masuk')
  items.filter(x => x.direction === 'keluar').forEach(o => {
    const guess = guessAccountFromText_(o.base.keterangan, accountsByKey, o.account)
    const candidate = x => !x.used && x.base.tanggal === o.base.tanggal && x.base.nominal === o.base.nominal && x.account !== o.account
    const match = incoming.find(x => candidate(x) && x.account === guess) || incoming.find(candidate)
    if (match) {
      match.used = true
      if (guess && guess !== match.account) {
        out.warnings.push('Baris ' + o.rowNo + ' & ' + match.rowNo + ': "' + o.base.keterangan + '" keluar dari ' +
          o.account + ' tapi masuk ke ' + match.account + ', cek lagi')
      }
      out.transactions.push(Object.assign(o.base, {
        tipe: 'transfer', akun: o.account, akun_tujuan: match.account,
        keterangan: o.base.keterangan || match.base.keterangan,
      }))
    } else if (guess) {
      out.warnings.push('Baris ' + o.rowNo + ': Kas Silang tanpa pasangan, tujuan ditebak ' + guess)
      out.transactions.push(Object.assign(o.base, { tipe: 'transfer', akun: o.account, akun_tujuan: guess }))
    } else {
      out.skipped++
      out.warnings.push('Baris ' + o.rowNo + ': Kas Silang "' + o.base.keterangan + '" tanpa pasangan dan tujuannya tidak jelas, dilewati')
    }
  })
  incoming.filter(x => !x.used).forEach(x => {
    out.warnings.push('Baris ' + x.rowNo + ': Kas Silang masuk tanpa pasangan, dicatat sebagai Pemasukan Lain')
    out.transactions.push(Object.assign(x.base, { tipe: 'masuk', akun: x.account, kategori: 'Pemasukan Lain' }))
  })
}

/** Menebak akun dari teks, misal "Tarik Tunai" → Tunai, "Shopeepay" → ShopeePay. */
function guessAccountFromText_(text, accountsByKey, excludeName) {
  const textKey = accountKey_(text)
  if (!textKey) return ''
  const key = Object.keys(accountsByKey).find(k => {
    const account = accountsByKey[k]
    return k && account.jenis !== 'orang' && account.nama !== excludeName && textKey.indexOf(k) > -1
  })
  return key ? accountsByKey[key].nama : ''
}

function accountKey_(name) {
  return String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

/** ID stabil dari isi baris, supaya impor ulang tidak membuat data ganda. */
function legacyId_(index, row) {
  const text = index + '|' + row.map(v => String(v)).join('|')
  return 'imp-' + fnv1a_(text, 0x811c9dc5) + fnv1a_(text, 0x050c5d1f)
}

function fnv1a_(text, seed) {
  let hash = seed >>> 0
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return ('0000000' + hash.toString(16)).slice(-8)
}

function formatImportReport_(report) {
  const r = report.result
  const count = tipe => report.fresh.filter(t => t.tipe === tipe).length
  const lines = ['Transaksi baru: ' + report.fresh.length +
    ' (keluar ' + count('keluar') + ', masuk ' + count('masuk') + ', transfer ' + count('transfer') + ')']
  if (report.duplicates) lines.push('Sudah pernah diimpor, dilewati: ' + report.duplicates)
  if (r.skipped) lines.push('Baris dilewati: ' + r.skipped)
  if (r.newAccounts.length) lines.push('Akun baru: ' + r.newAccounts.map(a => a.nama + ' (' + a.jenis + ')').join(', '))
  if (r.warnings.length) {
    lines.push('', 'Perlu dicek:')
    r.warnings.slice(0, MAX_REPORTED_WARNINGS).forEach(w => lines.push('• ' + w))
    if (r.warnings.length > MAX_REPORTED_WARNINGS) lines.push('• …dan ' + (r.warnings.length - MAX_REPORTED_WARNINGS) + ' lainnya (lihat log eksekusi)')
  }
  lines.push('', 'Jangan lupa isi saldo_awal di tab Akun: saldo tiap akun sebelum transaksi pertama.')
  return lines.join('\n')
}
