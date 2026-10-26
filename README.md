# 💰 Keuangan Pribadi

Pencatat keuangan pribadi yang cepat dipakai dari HP dan laptop. Datanya tersimpan di **Google Sheet milikmu sendiri**, jadi tidak perlu server sewaan, Telegram, atau AI, dan semuanya gratis.

```
HP / laptop ── app "Keuangan" (PWA) ──HTTPS──▶ Google Apps Script ──▶ Google Sheet
                 │                            (di akun Google-mu)      (Transaksi, Akun, Kategori)
                 └─ salinan data + antrean offline di perangkat
```

- **Catat ±5 detik:** nominal lewat keypad (ada tombol `000`), kategori ditebak dari keterangan, lalu Simpan.
- **Rekap otomatis:** saldo per akun, total bulanan, per kategori, budget vs realisasi, tren 6 bulan.
- **Utang-piutang per orang:** "bayarin teman" tidak tercampur dengan pengeluaran pribadi.
- **Bisa offline:** catatan disimpan di perangkat dan dikirim otomatis saat online.

## Isi folder

| Folder | Isi |
|---|---|
| `apps-script/` | Backend Google Apps Script yang menempel di Google Sheet (API, setup sheet, impor data lama) |
| `web/` | Aplikasi web React + TypeScript + Vite yang bisa dipasang di HP seperti aplikasi (PWA) |
| `.github/workflows/` | Deploy otomatis aplikasi web ke GitHub Pages |

## Coba tampilannya dulu (tanpa Google)

```bash
cd web
npm install
npm run dev
```

Buka <http://localhost:5173>, lalu pilih **Coba mode demo**. Data contoh hanya tersimpan di browser itu.

## Setup (sekali saja)

### 1. Buat Google Sheet + Apps Script

**Pilihan A: pakai `clasp` (disarankan, kode Apps Script bisa diperbarui dari VS Code)**

Semua perintah di bawah dijalankan di **terminal laptop** (VS Code: *Terminal → New Terminal*), di folder utama project. Perintah ini **tidak** dijalankan di editor Apps Script, karena Apps Script sendiri tidak memakai npm. `clasp` adalah alat resmi Google untuk mengunggah kode dari laptop ke Apps Script.

1. Aktifkan **Google Apps Script API** di <https://script.google.com/home/usersettings> (cukup sekali).
2. Jalankan:
   ```bash
   npm install         # memasang clasp (cukup sekali)
   npm run as:login    # login Google di browser
   npm run as:create   # membuat Google Sheet "Keuangan Pribadi" beserta script-nya (cukup sekali)
   npm run as:push     # mengunggah kode dari folder apps-script/
   ```
   `as:create` membuat file `.clasp.json` yang berisi ID script (sudah masuk `.gitignore`). Perintah ini juga menjaga `appsscript.json` milik project agar tidak tertimpa versi bawaan Google.
3. Buka Google Sheet "Keuangan Pribadi" lewat link `Created new document` yang muncul di terminal, atau cari di Google Drive.

**Pilihan B: salin-tempel manual**

1. Buat Google Sheet baru, lalu buka **Ekstensi → Apps Script**.
2. Buat satu file untuk setiap file `.js` di `apps-script/` (nama boleh sama), lalu salin isinya.
3. Di **Project Settings ⚙️**, centang *Show "appsscript.json" manifest file in editor*, lalu salin isi `apps-script/appsscript.json`.

### 2. Siapkan sheet

Muat ulang Google Sheet, lalu buka menu **💰 Keuangan → Siapkan sheet**. Tab `Transaksi`, `Akun`, `Kategori`, dan `Impor` akan dibuat. Google akan meminta izin:

- **Google Sheets (lihat & ubah):** web app perlu membuka sheet ini lewat ID-nya, karena saat berjalan sebagai web app Apps Script tidak punya "sheet aktif". Kodenya hanya membuka satu sheet, yaitu yang ID-nya disimpan saat setup.
- **Menampilkan konten di dialog:** untuk menu dan dialog token.

Karena ini script buatanmu sendiri, Google akan menampilkan *"Google hasn't verified this app"*. Klik **Advanced → Go to … (unsafe)** untuk melanjutkan.

### 3. Isi saldo awal

Di tab **Akun**, isi kolom `saldo_awal`, yaitu saldo tiap akun sebelum transaksi pertama yang akan kamu catat atau impor. Untuk akun berjenis `orang`, angka positif berarti dia berutang ke kamu.

### 4. Deploy web app

Di editor Apps Script, pilih **Deploy → New deployment → Web app**:

- *Execute as*: **Me**
- *Who has access*: **Anyone**

Lalu salin **Web app URL** (berakhiran `/exec`). Kalau pakai clasp, cukup jalankan `npm run as:deploy`. URL-nya adalah `https://script.google.com/macros/s/<deploymentId>/exec`.

> Akses "Anyone" diperlukan supaya aplikasi bisa mengirim data tanpa login Google di setiap permintaan. Permintaan tanpa **token rahasia** selalu ditolak.

### 5. Buka aplikasi & hubungkan

1. Di Google Sheet, buka menu **💰 Keuangan → Tampilkan token API**, lalu klik **Salin**.
2. Jalankan aplikasi di laptop. Di terminal VS Code (folder utama project), ketik:
   ```bash
   npm run web:dev
   ```
   Lalu buka <http://localhost:5173> di browser (atau Ctrl+klik link yang muncul di terminal). Biarkan terminal itu tetap berjalan selama aplikasi dipakai; tekan `Ctrl+C` untuk menghentikannya.
3. Aplikasi akan terbuka di halaman **Pengaturan**. Tempel **URL web app** dari langkah 4 dan **token**, lalu tekan **Hubungkan**.

Alamat `localhost` hanya bisa dibuka di laptop itu. Untuk HP, lanjut ke langkah 6.

### 6. Pasang di HP (GitHub Pages)

1. Push project ini ke repository GitHub. File `*.xlsx` dan data pribadi lain sudah dikecualikan lewat `.gitignore`.
2. Di repository, buka **Settings → Pages → Source: GitHub Actions**.
3. Setiap push ke `main` yang mengubah `web/` akan otomatis dipublikasikan ke `https://<username>.github.io/<nama-repo>/`.
4. Buka alamat itu di Chrome Android, ketuk **⋮ → Instal aplikasi**, lalu isi URL dan token sekali lagi (tersimpan di HP itu saja).
5. Tekan lama ikon aplikasi untuk pintasan **Catat transaksi**.

Kode aplikasi aman dipublikasikan karena tidak berisi data atau token apa pun. GitHub Pages gratis untuk repo publik. Kalau ingin repo privat, gunakan hosting statis gratis lain seperti Cloudflare Pages.

## Impor data dari sheet lama

1. Di sheet lama, salin baris transaksi kolom **Tanggal s.d. Metode Pembayaran** (6 kolom, tanpa header).
2. Tempel di tab **Impor** mulai sel `A2`.
3. Jalankan menu **💰 Keuangan → Impor data lama**.

| Data lama | Menjadi |
|---|---|
| `Kas Silang` (baris keluar + baris masuk) | 1 transfer antar akun |
| Kategori `Uang <nama>` | utang-piutang dengan akun orang `<nama>` |
| `Investasi` dan pemasukan "Bibit" | transfer ke/dari akun investasi Bibit |
| `Kebutuhan` / `Keinginan` | ditebak dari keterangan (Makan, Jajan & Ngopi, Belanja Harian, …) |
| `Kuliah`, `BPJS`, `Pendapatan Lain` | Pendidikan, Kesehatan, Pemasukan Lain |

Nominal negatif (format lama) otomatis dijadikan positif. Baris yang meragukan dilaporkan setelah impor. Impor aman diulang karena baris yang sama tidak akan masuk dua kali.

## Memperbarui kode Apps Script

```bash
npm run as:push
npm run as:deployments                 # lihat deploymentId
npx clasp update-deployment <deploymentId>
```

`update-deployment` membuat versi baru tanpa mengubah URL `/exec`. Tanpa clasp, gunakan **Deploy → Manage deployments → ✏️ → Version: New version**.

## Struktur data di Google Sheet

| Tab | Kolom |
|---|---|
| Transaksi | `id`, `tanggal`, `tipe` (keluar/masuk/transfer), `nominal` (selalu positif), `akun`, `akun_tujuan`, `kategori`, `keterangan`, `sumber`, `dibuat`, `diubah` |
| Akun | `nama`, `jenis` (bank/ewallet/tunai/investasi/orang), `saldo_awal`, `urutan`, `aktif` |
| Kategori | `nama`, `tipe` (keluar/masuk), `grup`, `ikon`, `budget_bulanan`, `kata_kunci`, `urutan`, `aktif` |

- Akun dan kategori boleh ditambah atau diubah langsung di sheet. Aplikasi membacanya ulang setiap sinkron.
- Isi `budget_bulanan` untuk melihat budget vs realisasi.
- Tambahkan `kata_kunci` (dipisah koma) supaya tebakan kategori makin tepat.
- Hindari mengganti nama akun atau kategori yang sudah dipakai transaksi, karena transaksi lama tetap memakai nama lama.

## Keamanan & privasi

- Data hanya ada di Google Sheet-mu, plus salinan di perangkat yang kamu hubungkan.
- Token API disimpan di *Script Properties* Apps Script, bukan di sheet dan bukan di kode. Ganti kapan saja lewat **💰 Keuangan → Buat token API baru**.
- Jangan bagikan URL `/exec` beserta tokennya.

## Pengembangan

```bash
cd web
npm run dev     # server pengembangan
npm run lint    # pemeriksaan kode (oxlint)
npm run build   # cek tipe TypeScript + build produksi ke web/dist
```

Logika impor data lama ada di `convertLegacyRows_` (`apps-script/LegacyImport.js`). Fungsinya murni, tanpa akses sheet, jadi bisa diuji di komputer.

## Tahapan berikutnya

- **Fase 2:** transaksi bank/e-wallet tercatat otomatis dari notifikasi HP atau email, kotak konfirmasi, pengingat malam, dan "hitung dompet" untuk tunai yang lupa dicatat.
- **Fase 3:** transaksi rutin (gaji, langganan), cek silang dengan e-Statement, laporan per orang.
