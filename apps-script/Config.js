/**
 * Konfigurasi dan skema sheet.
 * Data pribadi (akun, kategori, transaksi) disimpan di Google Sheet, bukan di kode ini.
 */

const APP_VERSION = '0.1.0'

const SHEET_NAMES = {
  transactions: 'Transaksi',
  accounts: 'Akun',
  categories: 'Kategori',
  legacyImport: 'Impor',
}

// Kolom dibaca berdasarkan nama header, jadi menambah kolom baru di sebelah kanan aman.
const HEADERS = {
  Transaksi: ['id', 'tanggal', 'tipe', 'nominal', 'akun', 'akun_tujuan', 'kategori', 'keterangan', 'sumber', 'dibuat', 'diubah'],
  Akun: ['nama', 'jenis', 'saldo_awal', 'urutan', 'aktif'],
  Kategori: ['nama', 'tipe', 'grup', 'ikon', 'budget_bulanan', 'kata_kunci', 'urutan', 'aktif'],
  Impor: ['Tanggal', 'Keterangan', 'Kategori', 'Jenis Transaksi', 'Nominal', 'Metode Pembayaran'],
}

// Format kolom tab Transaksi. Kolom teks diset '@' (teks biasa) supaya
// keterangan seperti "10/10" tidak diubah Google Sheets menjadi tanggal.
const TRANSACTION_FORMATS = {
  id: '@',
  tanggal: 'yyyy-mm-dd',
  tipe: '@',
  nominal: '#,##0',
  akun: '@',
  akun_tujuan: '@',
  kategori: '@',
  keterangan: '@',
  sumber: '@',
  dibuat: '@',
  diubah: '@',
}

const TRANSACTION_TYPES = ['keluar', 'masuk', 'transfer']
const ACCOUNT_KINDS = ['bank', 'ewallet', 'tunai', 'investasi', 'orang']
const CATEGORY_TYPES = ['keluar', 'masuk']
const SOURCES = ['manual', 'impor', 'notifikasi', 'email', 'penyesuaian']

// nama, jenis, saldo_awal, urutan, aktif
const DEFAULT_ACCOUNTS = [
  ['BCA', 'bank', 0, 1, true],
  ['Bank Jago', 'bank', 0, 2, true],
  ['Tunai', 'tunai', 0, 3, true],
  ['GoPay', 'ewallet', 0, 4, true],
  ['ShopeePay', 'ewallet', 0, 5, true],
  ['Bibit', 'investasi', 0, 6, true],
]

// nama, tipe, grup, ikon, budget_bulanan, kata_kunci, urutan, aktif
const DEFAULT_CATEGORIES = [
  ['Makan', 'keluar', 'Kebutuhan', '🍚', '', 'nasi, nasgor, mie, bakso, soto, ayam, bebek, bubur, pecel, warteg, ketoprak, gado gado, sate, sego, kwetiaw, batagor, martabak, burger, kfc, mcd, hokben, solaria, marugame, gacoan, kedai, warung, rumah makan', 1, true],
  ['Jajan & Ngopi', 'keluar', 'Keinginan', '☕', '', 'kopi, coffee, fore, teazzi, boba, jus, es teh, esteh, popcorn, tahu walik, lekker, snack, roti, dessert', 2, true],
  ['Belanja Harian', 'keluar', 'Kebutuhan', '🛒', '', 'indomaret, alfamart, alfamidi, superindo, hypermart, pasar, sayur, buah, susu, oat, fillet, sabun, galon', 3, true],
  ['Transport', 'keluar', 'Kebutuhan', '🛵', '', 'gocar, goride, gojek, grab, maxim, bensin, pertamina, shell, parkir, tol, emoney, e money, flazz, krl, mrt, transjakarta', 4, true],
  ['Tagihan & Langganan', 'keluar', 'Kebutuhan', '📱', '', 'pulsa, kuota, paket data, telkom, indihome, wifi, listrik, pln, pdam, claude, chatgpt, netflix, spotify, youtube, seakun, langganan', 5, true],
  ['Kesehatan', 'keluar', 'Kebutuhan', '💊', '', 'bpjs, apotek, obat, dokter, klinik, rumah sakit', 6, true],
  ['Pendidikan', 'keluar', 'Kebutuhan', '🎓', '', 'kuliah, ukt, spp, kursus, fotokopi, print', 7, true],
  ['Hiburan & Hobi', 'keluar', 'Keinginan', '🎬', '', 'nonton, xxi, cgv, bioskop, buku, game, steam, konser', 8, true],
  ['Belanja Barang', 'keluar', 'Keinginan', '🛍️', '', 'azko, ace hardware, ikea, informa, uniqlo, tokopedia, shopee, lazada', 9, true],
  ['Orang Tua', 'keluar', 'Memberi', '👪', '', 'papa, mama, ortu, orang tua', 10, true],
  ['Sedekah', 'keluar', 'Memberi', '🤲', '', 'sedekah, donasi, persembahan, perpuluhan, zakat, infaq', 11, true],
  ['Biaya Admin', 'keluar', 'Kebutuhan', '🏦', '', 'biaya admin, admin bank, biaya transfer', 12, true],
  ['Lainnya', 'keluar', 'Lainnya', '📦', '', '', 13, true],
  ['Gaji', 'masuk', 'Pemasukan', '💼', '', 'gaji, salary', 14, true],
  ['Freelance', 'masuk', 'Pemasukan', '💻', '', 'freelance, proyek, project', 15, true],
  ['Beasiswa', 'masuk', 'Pemasukan', '🎓', '', 'beasiswa', 16, true],
  ['Pemasukan Lain', 'masuk', 'Pemasukan', '💰', '', 'refund, cashback, hadiah, bunga', 17, true],
]
