// Bentuk data sama persis dengan kolom di Google Sheet (tab Akun, Kategori, Transaksi).

export type JenisAkun = 'bank' | 'ewallet' | 'tunai' | 'investasi' | 'orang'
export type TipeKategori = 'keluar' | 'masuk'
export type TipeTransaksi = 'keluar' | 'masuk' | 'transfer'

export interface Akun {
  nama: string
  jenis: JenisAkun
  saldo_awal: number
  urutan: number
  aktif: boolean
}

export interface Kategori {
  nama: string
  tipe: TipeKategori
  grup: string
  ikon: string
  budget_bulanan: number | null
  kata_kunci: string[]
  urutan: number
  aktif: boolean
}

export interface Transaksi {
  id: string
  tanggal: string // yyyy-mm-dd
  tipe: TipeTransaksi
  nominal: number
  akun: string // akun yang berkurang (keluar/transfer) atau bertambah (masuk)
  akun_tujuan: string // hanya untuk transfer
  kategori: string // kosong untuk transfer
  keterangan: string
  sumber: string
  dibuat: string
  diubah: string
}

export interface DataKeuangan {
  akun: Akun[]
  kategori: Kategori[]
  transaksi: Transaksi[]
}

/** Perubahan yang menunggu dikirim ke server (antrean offline). */
export type Operasi =
  | { qid: string; op: 'upsert'; tx: Transaksi }
  | { qid: string; op: 'delete'; id: string }

export interface Koneksi {
  url: string
  token: string
}
