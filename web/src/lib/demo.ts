// Data contoh untuk mode demo. Hanya tersimpan di perangkat, tidak pernah dikirim ke mana pun.

import type { Akun, DataKeuangan, Kategori, Transaksi } from '../types.ts'
import { addDays, parseIso, todayIso } from './format.ts'

const ACCOUNTS: Akun[] = [
  { nama: 'BCA', jenis: 'bank', saldo_awal: 4_000_000, urutan: 1, aktif: true },
  { nama: 'Bank Jago', jenis: 'bank', saldo_awal: 1_500_000, urutan: 2, aktif: true },
  { nama: 'Tunai', jenis: 'tunai', saldo_awal: 250_000, urutan: 3, aktif: true },
  { nama: 'GoPay', jenis: 'ewallet', saldo_awal: 60_000, urutan: 4, aktif: true },
  { nama: 'ShopeePay', jenis: 'ewallet', saldo_awal: 80_000, urutan: 5, aktif: true },
  { nama: 'Bibit', jenis: 'investasi', saldo_awal: 3_000_000, urutan: 6, aktif: true },
  { nama: 'Budi (contoh)', jenis: 'orang', saldo_awal: 0, urutan: 7, aktif: true },
]

type CategoryRow = [string, Kategori['tipe'], string, string, number | null, string]

// Sama dengan kategori bawaan di Apps Script (Config.js), ditambah contoh budget.
const CATEGORY_ROWS: CategoryRow[] = [
  ['Makan', 'keluar', 'Kebutuhan', '🍚', 1_500_000, 'nasi, mie, bakso, soto, ayam, bubur, pecel, warteg, kedai, warung'],
  ['Jajan & Ngopi', 'keluar', 'Keinginan', '☕', 400_000, 'kopi, fore, boba, jus, es teh, snack'],
  ['Belanja Harian', 'keluar', 'Kebutuhan', '🛒', 600_000, 'indomaret, alfamart, sayur, susu'],
  ['Transport', 'keluar', 'Kebutuhan', '🛵', 350_000, 'gocar, gojek, grab, bensin, parkir'],
  ['Tagihan & Langganan', 'keluar', 'Kebutuhan', '📱', null, 'pulsa, kuota, wifi, listrik, langganan'],
  ['Kesehatan', 'keluar', 'Kebutuhan', '💊', null, 'bpjs, apotek, obat'],
  ['Pendidikan', 'keluar', 'Kebutuhan', '🎓', null, 'kuliah, buku kuliah'],
  ['Hiburan & Hobi', 'keluar', 'Keinginan', '🎬', 250_000, 'nonton, xxi, buku, game'],
  ['Belanja Barang', 'keluar', 'Keinginan', '🛍️', null, 'tokopedia, shopee'],
  ['Orang Tua', 'keluar', 'Memberi', '👪', null, 'papa, mama'],
  ['Sedekah', 'keluar', 'Memberi', '🤲', null, 'sedekah, donasi'],
  ['Biaya Admin', 'keluar', 'Kebutuhan', '🏦', null, 'biaya admin'],
  ['Lainnya', 'keluar', 'Lainnya', '📦', null, ''],
  ['Gaji', 'masuk', 'Pemasukan', '💼', null, 'gaji'],
  ['Freelance', 'masuk', 'Pemasukan', '💻', null, 'freelance, proyek'],
  ['Beasiswa', 'masuk', 'Pemasukan', '🎓', null, 'beasiswa'],
  ['Pemasukan Lain', 'masuk', 'Pemasukan', '💰', null, 'refund, cashback'],
]

/** Angka acak yang selalu sama untuk seed yang sama, supaya demo tampil konsisten. */
function seededRandom(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function createDemoData(): DataKeuangan {
  const random = seededRandom(2026)
  const between = (min: number, max: number) => Math.round((min + random() * (max - min)) / 500) * 500
  const pick = <T,>(items: T[]): T => items[Math.floor(random() * items.length)]
  const transaksi: Transaksi[] = []
  const today = todayIso()
  let counter = 0

  const add = (tanggal: string, tx: Pick<Transaksi, 'tipe' | 'nominal' | 'akun'> & Partial<Transaksi>) => {
    counter += 1
    // Jam dibuat di awal hari itu, supaya transaksi yang kamu tambahkan sendiri selalu tampil paling atas.
    const stamp = new Date(parseIso(tanggal).getTime() + counter * 1000).toISOString()
    transaksi.push({
      id: `demo-${counter}`, tanggal, akun_tujuan: '', kategori: '', keterangan: '',
      sumber: 'manual', dibuat: stamp, diubah: stamp, ...tx,
    })
  }

  for (let back = 75; back >= 0; back--) {
    const date = addDays(today, -back)
    const day = Number(date.slice(8, 10))
    if (day === 1) add(date, { tipe: 'keluar', nominal: 750_000, akun: 'BCA', kategori: 'Orang Tua', keterangan: 'Kirim ke Mama' })
    if (day === 2) add(date, { tipe: 'masuk', nominal: 5_200_000, akun: 'BCA', kategori: 'Gaji', keterangan: 'Gaji' })
    if (day === 3) add(date, { tipe: 'transfer', nominal: 500_000, akun: 'BCA', akun_tujuan: 'Bibit', keterangan: 'Investasi rutin' })
    if (day === 5) add(date, { tipe: 'keluar', nominal: 42_000, akun: 'BCA', kategori: 'Kesehatan', keterangan: 'BPJS' })
    if (day === 6) add(date, { tipe: 'keluar', nominal: 330_000, akun: 'BCA', kategori: 'Tagihan & Langganan', keterangan: 'Langganan AI' })
    if (day === 8) add(date, { tipe: 'transfer', nominal: 150_000, akun: 'BCA', akun_tujuan: 'ShopeePay', keterangan: 'Top up ShopeePay' })
    if (day === 10 || day === 24) add(date, { tipe: 'transfer', nominal: 250_000, akun: 'BCA', akun_tujuan: 'GoPay', keterangan: 'Top up GoPay' })
    if (day === 15) add(date, { tipe: 'transfer', nominal: 300_000, akun: 'BCA', akun_tujuan: 'Tunai', keterangan: 'Tarik tunai' })
    if (day === 20) add(date, { tipe: 'transfer', nominal: 200_000, akun: 'Budi (contoh)', akun_tujuan: 'BCA', keterangan: 'Budi bayar utang' })

    add(date, { tipe: 'keluar', nominal: between(12_000, 30_000), akun: pick(['Tunai', 'BCA']), kategori: 'Makan', keterangan: pick(['Nasi Pecel', 'Bubur Ayam', 'Warteg', 'Soto Ayam']) })
    if (random() < 0.6) add(date, { tipe: 'keluar', nominal: between(18_000, 40_000), akun: 'BCA', kategori: 'Makan', keterangan: pick(['Mie Ayam', 'Kedai Djawa', 'Nasi Kuning']) })
    if (random() < 0.3) add(date, { tipe: 'keluar', nominal: between(15_000, 35_000), akun: pick(['BCA', 'ShopeePay']), kategori: 'Jajan & Ngopi', keterangan: pick(['Kopi', 'Jus Alpukat', 'Boba']) })
    if (random() < 0.35) add(date, { tipe: 'keluar', nominal: between(20_000, 45_000), akun: 'GoPay', kategori: 'Transport', keterangan: 'Gocar' })
    if (random() < 0.15) add(date, { tipe: 'keluar', nominal: between(40_000, 150_000), akun: 'BCA', kategori: 'Belanja Harian', keterangan: pick(['Indomaret', 'Alfamart']) })
    if (random() < 0.12) add(date, { tipe: 'transfer', nominal: between(20_000, 60_000), akun: 'BCA', akun_tujuan: 'Budi (contoh)', keterangan: 'Bayarin makan Budi' })
    if (random() < 0.05) add(date, { tipe: 'keluar', nominal: between(40_000, 90_000), akun: 'BCA', kategori: 'Hiburan & Hobi', keterangan: 'Nonton' })
  }

  const kategori: Kategori[] = CATEGORY_ROWS.map(([nama, tipe, grup, ikon, budget, kunci], i) => ({
    nama, tipe, grup, ikon, budget_bulanan: budget, urutan: i + 1, aktif: true,
    kata_kunci: kunci.split(',').map(k => k.trim()).filter(Boolean),
  }))
  return { akun: ACCOUNTS.map(a => ({ ...a })), kategori, transaksi }
}
