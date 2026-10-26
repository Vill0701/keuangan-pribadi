/**
 * Helper untuk membaca dan menulis sheet, serta merapikan tipe data
 * (tanggal, angka, boolean) supaya aplikasi selalu menerima format yang sama.
 */

/**
 * Spreadsheet milik aplikasi. Saat dijalankan sebagai web app, "active spreadsheet" tidak tersedia,
 * jadi dipakai ID yang disimpan oleh setup().
 */
function getSpreadsheet_() {
  let active = null
  try {
    active = SpreadsheetApp.getActiveSpreadsheet()
  } catch (err) {
    active = null
  }
  if (active) return active
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID')
  if (!id) throw new Error('Spreadsheet belum disiapkan. Jalankan menu 💰 Keuangan → Siapkan sheet.')
  return SpreadsheetApp.openById(id)
}

function getSheet_(name) {
  const sheet = getSpreadsheet_().getSheetByName(name)
  if (!sheet) throw new Error('Tab "' + name + '" tidak ditemukan. Jalankan menu 💰 Keuangan → Siapkan sheet.')
  return sheet
}

/** Membaca seluruh tab: header + semua baris data (termasuk baris kosong, supaya nomor baris tetap cocok). */
function readTable_(name) {
  const sheet = getSheet_(name)
  const lastRow = sheet.getLastRow()
  const lastCol = sheet.getLastColumn()
  if (lastRow < 1 || lastCol < 1) return { sheet: sheet, headers: [], values: [] }
  const all = sheet.getRange(1, 1, lastRow, lastCol).getValues()
  return { sheet: sheet, headers: all[0].map(h => String(h).trim()), values: all.slice(1) }
}

function rowToObject_(headers, row) {
  const obj = {}
  headers.forEach((h, i) => { if (h) obj[h] = row[i] })
  return obj
}

function isBlankRow_(row) {
  return row.every(v => v === '' || v === null)
}

function readAccounts_() {
  const t = readTable_(SHEET_NAMES.accounts)
  return t.values
    .filter(row => !isBlankRow_(row))
    .map((row, i) => normalizeAccount_(rowToObject_(t.headers, row), i))
    .filter(a => a.nama)
}

function readCategories_() {
  const t = readTable_(SHEET_NAMES.categories)
  return t.values
    .filter(row => !isBlankRow_(row))
    .map((row, i) => normalizeCategory_(rowToObject_(t.headers, row), i))
    .filter(c => c.nama)
}

/** Membaca transaksi. Baris yang diketik manual di sheet tanpa id akan diberi id otomatis. */
function readTransactions_() {
  const t = readTable_(SHEET_NAMES.transactions)
  const idCol = t.headers.indexOf('id')
  let filled = false
  const list = []
  t.values.forEach(row => {
    if (isBlankRow_(row)) return
    if (idCol > -1 && !row[idCol]) {
      row[idCol] = 'm-' + Utilities.getUuid()
      filled = true
    }
    list.push(normalizeTransaction_(rowToObject_(t.headers, row)))
  })
  if (filled) t.sheet.getRange(2, idCol + 1, t.values.length, 1).setValues(t.values.map(r => [r[idCol]]))
  return list
}

function normalizeAccount_(o, index) {
  const jenis = String(o.jenis || '').trim().toLowerCase()
  return {
    nama: String(o.nama || '').trim(),
    jenis: ACCOUNT_KINDS.indexOf(jenis) > -1 ? jenis : 'bank',
    saldo_awal: toNumber_(o.saldo_awal) || 0,
    urutan: toNumber_(o.urutan) || index + 1,
    aktif: toBool_(o.aktif),
  }
}

function normalizeCategory_(o, index) {
  const tipe = String(o.tipe || '').trim().toLowerCase()
  const budget = toNumber_(o.budget_bulanan)
  return {
    nama: String(o.nama || '').trim(),
    tipe: CATEGORY_TYPES.indexOf(tipe) > -1 ? tipe : 'keluar',
    grup: String(o.grup || '').trim() || 'Lainnya',
    ikon: String(o.ikon || '').trim(),
    budget_bulanan: budget > 0 ? budget : null,
    kata_kunci: String(o.kata_kunci || '').split(',').map(k => k.trim().toLowerCase()).filter(Boolean),
    urutan: toNumber_(o.urutan) || index + 1,
    aktif: toBool_(o.aktif),
  }
}

function normalizeTransaction_(o) {
  return {
    id: String(o.id || ''),
    tanggal: toIsoDate_(o.tanggal),
    tipe: String(o.tipe || '').trim().toLowerCase(),
    nominal: Math.abs(toNumber_(o.nominal)) || 0,
    akun: String(o.akun || '').trim(),
    akun_tujuan: String(o.akun_tujuan || '').trim(),
    kategori: String(o.kategori || '').trim(),
    keterangan: String(o.keterangan || '').trim(),
    sumber: String(o.sumber || '').trim() || 'manual',
    dibuat: toIsoTimestamp_(o.dibuat),
    diubah: toIsoTimestamp_(o.diubah),
  }
}

/** Menyusun satu baris sheet dari objek transaksi. Kolom tambahan buatanmu sendiri dipertahankan. */
function transactionToRow_(headers, tx, existingRow) {
  return headers.map((h, i) => {
    switch (h) {
      case 'tanggal': return Utilities.parseDate(tx.tanggal, Session.getScriptTimeZone(), 'yyyy-MM-dd')
      case 'nominal': return tx.nominal
      case 'id':
      case 'tipe':
      case 'akun':
      case 'akun_tujuan':
      case 'kategori':
      case 'keterangan':
      case 'sumber':
      case 'dibuat':
      case 'diubah':
        return safeText_(tx[h])
      default:
        return existingRow ? existingRow[i] : ''
    }
  })
}

/** Menambah baris transaksi di bawah data terakhir; baris sheet ditambah kalau tidak cukup. */
function appendTransactionRows_(sheet, headers, rows) {
  if (!rows.length) return
  const start = sheet.getLastRow() + 1
  const missing = start + rows.length - 1 - sheet.getMaxRows()
  if (missing > 0) sheet.insertRowsAfter(sheet.getMaxRows(), missing)
  formatTransactionRange_(sheet, headers, start, rows.length)
  sheet.getRange(start, 1, rows.length, headers.length).setValues(rows)
}

function formatTransactionRange_(sheet, headers, startRow, numRows) {
  if (numRows < 1) return
  headers.forEach((h, i) => {
    const format = TRANSACTION_FORMATS[h]
    if (format) sheet.getRange(startRow, i + 1, numRows, 1).setNumberFormat(format)
  })
}

/** Tanggal (Date atau teks) → 'yyyy-MM-dd'. Menerima juga format Indonesia dd/mm/yyyy. */
function toIsoDate_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    if (typeof Utilities !== 'undefined') return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd')
    return value.getFullYear() + '-' + pad2_(value.getMonth() + 1) + '-' + pad2_(value.getDate())
  }
  const s = String(value || '').trim()
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (m) return m[1] + '-' + pad2_(m[2]) + '-' + pad2_(m[3])
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/)
  if (m) return m[3] + '-' + pad2_(m[2]) + '-' + pad2_(m[1])
  return ''
}

function toIsoTimestamp_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) return value.toISOString()
  return String(value || '')
}

/** Angka atau teks seperti "Rp 25.000", "-25000", "1,5" → number (NaN kalau tidak terbaca). */
function toNumber_(value) {
  if (typeof value === 'number') return value
  if (value === null || value === undefined) return NaN
  let s = String(value).replace(/rp/gi, '').replace(/\s/g, '')
  if (s === '') return NaN
  const negative = /^-/.test(s) || /^\(.*\)$/.test(s)
  s = s.replace(/[()+-]/g, '')
  const lastDot = s.lastIndexOf('.')
  const lastComma = s.lastIndexOf(',')
  if (lastDot > -1 && lastComma > -1) {
    const decimal = lastDot > lastComma ? '.' : ','
    const thousands = decimal === '.' ? ',' : '.'
    s = s.split(thousands).join('').replace(decimal, '.')
  } else if (lastDot > -1 || lastComma > -1) {
    const parts = s.split(lastDot > -1 ? '.' : ',')
    const isThousands = parts.slice(1).every(p => p.length === 3)
    s = isThousands ? parts.join('') : parts.join('.')
  }
  const n = Number(s)
  return negative ? -n : n
}

/** Kosong dianggap aktif; FALSE / tidak / no / 0 dianggap tidak aktif. */
function toBool_(value) {
  if (value === false || value === 0) return false
  const s = String(value === undefined || value === null ? '' : value).trim().toLowerCase()
  return ['false', 'tidak', 'no', '0', 'n'].indexOf(s) === -1
}

/** Mencegah teks diperlakukan sebagai rumus oleh Google Sheets (misal keterangan "=..."). */
function safeText_(value) {
  const s = value === undefined || value === null ? '' : String(value)
  return s.charAt(0) === '=' ? "'" + s : s
}

function pad2_(n) {
  return ('0' + n).slice(-2)
}

function withLock_(fn) {
  const lock = LockService.getScriptLock()
  lock.waitLock(20000)
  try {
    return fn()
  } finally {
    SpreadsheetApp.flush()
    lock.releaseLock()
  }
}
