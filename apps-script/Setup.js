/**
 * Menyiapkan spreadsheet: tab, header, akun & kategori awal, format kolom, dan token API.
 * Aman dijalankan berulang kali: data yang sudah ada tidak ditimpa.
 */
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet()
  // Web app tidak punya "active spreadsheet", jadi ID-nya disimpan di sini (diperbarui setiap setup dijalankan).
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', ss.getId())
  ss.setSpreadsheetTimeZone(Session.getScriptTimeZone())

  const transactions = ensureSheet_(ss, SHEET_NAMES.transactions, HEADERS.Transaksi, [])
  formatTransactionRange_(transactions, readHeaders_(transactions), 2, transactions.getMaxRows() - 1)
  setColumnWidth_(transactions, 'keterangan', 260)

  const accounts = ensureSheet_(ss, SHEET_NAMES.accounts, HEADERS.Akun, DEFAULT_ACCOUNTS)
  setColumnFormat_(accounts, 'saldo_awal', '#,##0')
  setColumnChoices_(accounts, 'jenis', ACCOUNT_KINDS)

  const categories = ensureSheet_(ss, SHEET_NAMES.categories, HEADERS.Kategori, DEFAULT_CATEGORIES)
  setColumnFormat_(categories, 'budget_bulanan', '#,##0')
  setColumnChoices_(categories, 'tipe', CATEGORY_TYPES)
  setColumnWidth_(categories, 'kata_kunci', 420)

  ensureSheet_(ss, SHEET_NAMES.legacyImport, HEADERS.Impor, [])
  removeEmptyDefaultSheet_(ss)

  if (!getApiToken_()) setApiToken_(generateToken_())

  notify_('Sheet siap ✅',
    'Langkah berikutnya:\n' +
    '1. Isi kolom saldo_awal di tab Akun.\n' +
    '2. Deploy → New deployment → Web app (Execute as: Me, Who has access: Anyone).\n' +
    '3. Menu 💰 Keuangan → Tampilkan token API, lalu salin URL & token ke aplikasi.')
}

function ensureSheet_(ss, name, headers, defaultRows) {
  let sheet = ss.getSheetByName(name)
  if (!sheet) sheet = ss.insertSheet(name)

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers])
    if (defaultRows.length) sheet.getRange(2, 1, defaultRows.length, headers.length).setValues(defaultRows)
  } else {
    // Tambahkan kolom yang belum ada di kanan, tanpa menyentuh data lama.
    const lastCol = sheet.getLastColumn()
    const existing = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h).trim())
    const missing = headers.filter(h => existing.indexOf(h) === -1)
    if (missing.length) sheet.getRange(1, lastCol + 1, 1, missing.length).setValues([missing])
  }

  sheet.setFrozenRows(1)
  sheet.getRange(1, 1, 1, sheet.getLastColumn()).setFontWeight('bold').setBackground('#e6f4f1')
  return sheet
}

function readHeaders_(sheet) {
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h).trim())
}

function headerColumn_(sheet, header) {
  return readHeaders_(sheet).indexOf(header) + 1
}

function setColumnFormat_(sheet, header, format) {
  const col = headerColumn_(sheet, header)
  if (col > 0) sheet.getRange(2, col, Math.max(sheet.getMaxRows() - 1, 1), 1).setNumberFormat(format)
}

function setColumnChoices_(sheet, header, choices) {
  const col = headerColumn_(sheet, header)
  if (col < 1) return
  const rule = SpreadsheetApp.newDataValidation().requireValueInList(choices, true).setAllowInvalid(true).build()
  sheet.getRange(2, col, Math.max(sheet.getMaxRows() - 1, 1), 1).setDataValidation(rule)
}

function setColumnWidth_(sheet, header, width) {
  const col = headerColumn_(sheet, header)
  if (col > 0) sheet.setColumnWidth(col, width)
}

/** Menghapus tab bawaan ("Sheet1" / "Lembar1") kalau masih kosong. */
function removeEmptyDefaultSheet_(ss) {
  ss.getSheets().forEach(sheet => {
    const isDefaultName = /^(sheet|lembar)\s?1$/i.test(sheet.getName())
    if (isDefaultName && sheet.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(sheet)
  })
}

function getApiToken_() {
  return PropertiesService.getScriptProperties().getProperty('API_TOKEN')
}

function setApiToken_(token) {
  PropertiesService.getScriptProperties().setProperty('API_TOKEN', token)
}

function generateToken_() {
  return (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '')
}
