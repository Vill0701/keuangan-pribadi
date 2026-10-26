/**
 * API untuk aplikasi web. Semua permintaan memakai POST dengan body JSON:
 *   { token, action: 'bootstrap' }            → ambil semua data
 *   { token, action: 'sync', ops: [...] }     → simpan perubahan, lalu kembalikan semua data
 * Setiap op: { op: 'upsert', tx: {...} } atau { op: 'delete', id }.
 */

/** Dibuka langsung di browser: hanya tanda bahwa backend aktif (aplikasi memakai POST). */
function doGet() {
  return jsonOutput_({
    ok: true,
    app: 'keuangan-pribadi',
    version: APP_VERSION,
    pesan: 'Backend aktif ✅. Ini bukan tampilan aplikasi: salin URL halaman ini ke Pengaturan di aplikasi.',
  })
}

function doPost(e) {
  let body
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || '{}')
  } catch (err) {
    return jsonOutput_({ ok: false, error: 'Body permintaan bukan JSON' })
  }
  if (!isValidToken_(body.token)) return jsonOutput_({ ok: false, error: 'Token tidak valid' })

  try {
    switch (body.action) {
      case 'bootstrap':
        return jsonOutput_({ ok: true, data: readAllData_() })
      case 'sync': {
        const results = applyOperations_(Array.isArray(body.ops) ? body.ops : [])
        return jsonOutput_({ ok: true, results: results, data: readAllData_() })
      }
      default:
        return jsonOutput_({ ok: false, error: 'Aksi tidak dikenal: ' + body.action })
    }
  } catch (err) {
    console.error(err)
    return jsonOutput_({ ok: false, error: String((err && err.message) || err) })
  }
}

function readAllData_() {
  return {
    akun: readAccounts_(),
    kategori: readCategories_(),
    transaksi: readTransactions_(),
    versi: APP_VERSION,
    waktu_server: new Date().toISOString(),
  }
}

/** Menerapkan daftar operasi dalam satu kunci (lock) supaya aman dari penulisan bersamaan. */
function applyOperations_(ops) {
  return withLock_(() => {
    const accounts = readAccounts_()
    const categories = readCategories_()
    const table = readTable_(SHEET_NAMES.transactions)
    const headers = table.headers
    const idCol = headers.indexOf('id')
    if (idCol === -1) throw new Error('Kolom "id" tidak ada di tab Transaksi')

    const rowIndexById = {}
    table.values.forEach((row, i) => { if (row[idCol]) rowIndexById[String(row[idCol])] = i })

    const updatedRows = {}   // indeks baris → nilai baru
    const appends = []       // baris baru (null = batal karena dihapus di batch yang sama)
    const appendIndexById = {}
    const deleteRows = []
    const now = new Date().toISOString()

    const results = ops.map(op => {
      try {
        if (!op || typeof op !== 'object') throw new Error('Operasi tidak valid')
        if (op.op === 'delete') {
          const id = String(op.id || '')
          if (appendIndexById[id] !== undefined) {
            appends[appendIndexById[id]] = null
            delete appendIndexById[id]
          } else if (rowIndexById[id] !== undefined) {
            deleteRows.push(rowIndexById[id])
            delete updatedRows[rowIndexById[id]]
            delete rowIndexById[id]
          }
          return { id: id, ok: true }
        }
        if (op.op === 'upsert') {
          const tx = validateTransaction_(op.tx, accounts, categories)
          const i = rowIndexById[tx.id]
          if (i !== undefined) {
            const existing = rowToObject_(headers, table.values[i])
            tx.dibuat = toIsoTimestamp_(existing.dibuat) || now
            tx.diubah = now
            updatedRows[i] = transactionToRow_(headers, tx, table.values[i])
          } else {
            tx.dibuat = tx.dibuat || now
            tx.diubah = now
            const row = transactionToRow_(headers, tx, null)
            if (appendIndexById[tx.id] !== undefined) appends[appendIndexById[tx.id]] = row
            else appendIndexById[tx.id] = appends.push(row) - 1
          }
          return { id: tx.id, ok: true }
        }
        throw new Error('Jenis operasi tidak dikenal: ' + op.op)
      } catch (err) {
        const id = op && (op.id || (op.tx && op.tx.id))
        return { id: id ? String(id) : '', ok: false, error: String((err && err.message) || err) }
      }
    })

    // Urutan penting: ubah baris lama → tambah baris baru di bawah → hapus dari bawah ke atas.
    Object.keys(updatedRows).forEach(i => {
      table.sheet.getRange(Number(i) + 2, 1, 1, headers.length).setValues([updatedRows[i]])
    })
    appendTransactionRows_(table.sheet, headers, appends.filter(Boolean))
    deleteRows.sort((a, b) => b - a).forEach(i => table.sheet.deleteRow(i + 2))
    return results
  })
}

function validateTransaction_(raw, accounts, categories) {
  if (!raw || typeof raw !== 'object') throw new Error('Data transaksi kosong')
  const tx = {
    id: String(raw.id || '').trim(),
    tanggal: String(raw.tanggal || '').trim(),
    tipe: String(raw.tipe || '').trim(),
    nominal: Number(raw.nominal),
    akun: String(raw.akun || '').trim(),
    akun_tujuan: String(raw.akun_tujuan || '').trim(),
    kategori: String(raw.kategori || '').trim(),
    keterangan: String(raw.keterangan || '').trim().slice(0, 200),
    sumber: String(raw.sumber || '').trim(),
    dibuat: raw.dibuat ? String(raw.dibuat) : '',
    diubah: '',
  }
  if (!/^[\w-]{6,64}$/.test(tx.id)) throw new Error('ID transaksi tidak valid')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tx.tanggal)) throw new Error('Tanggal harus berformat yyyy-mm-dd')
  if (TRANSACTION_TYPES.indexOf(tx.tipe) === -1) throw new Error('Tipe harus keluar, masuk, atau transfer')
  if (!isFinite(tx.nominal) || tx.nominal <= 0 || tx.nominal > 1e13) throw new Error('Nominal harus lebih dari 0')

  const accountNames = accounts.map(a => a.nama)
  if (accountNames.indexOf(tx.akun) === -1) throw new Error('Akun "' + tx.akun + '" tidak ada di tab Akun')
  if (tx.tipe === 'transfer') {
    if (accountNames.indexOf(tx.akun_tujuan) === -1) throw new Error('Akun tujuan "' + tx.akun_tujuan + '" tidak ada di tab Akun')
    if (tx.akun_tujuan === tx.akun) throw new Error('Akun asal dan tujuan tidak boleh sama')
    tx.kategori = ''
  } else {
    const category = categories.find(c => c.nama === tx.kategori)
    if (!category) throw new Error('Kategori "' + tx.kategori + '" tidak ada di tab Kategori')
    if (category.tipe !== tx.tipe) throw new Error('Kategori "' + tx.kategori + '" bukan kategori ' + tx.tipe)
    tx.akun_tujuan = ''
  }
  if (SOURCES.indexOf(tx.sumber) === -1) tx.sumber = 'manual'
  return tx
}

function isValidToken_(token) {
  const expected = getApiToken_()
  if (!expected || typeof token !== 'string' || token.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ token.charCodeAt(i)
  return diff === 0
}

function jsonOutput_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON)
}
