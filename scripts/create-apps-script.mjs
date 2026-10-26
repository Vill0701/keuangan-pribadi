// Membuat Google Sheet "Keuangan Pribadi" + Apps Script yang menempel padanya, memakai clasp.
// `clasp create-script` selalu menarik file bawaan Google (appsscript.json dan Code.js) ke folder lokal
// dan menimpa file yang ada, jadi manifest kita disimpan dulu lalu dikembalikan.

import { execSync } from 'node:child_process'
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'

const MANIFEST = 'apps-script/appsscript.json'
const DEFAULT_STUBS = ['apps-script/Code.js', 'apps-script/Code.gs']

if (existsSync('.clasp.json')) {
  console.error('Project Apps Script sudah pernah dibuat (.clasp.json sudah ada). Cukup jalankan: npm run as:push')
  process.exit(1)
}

const manifest = readFileSync(MANIFEST, 'utf8')
const existingStubs = DEFAULT_STUBS.filter(file => existsSync(file))
let failed = false

try {
  execSync('npx clasp create-script --type sheets --title "Keuangan Pribadi" --rootDir apps-script', { stdio: 'inherit' })
} catch {
  failed = true
} finally {
  writeFileSync(MANIFEST, manifest)
  DEFAULT_STUBS.filter(file => !existingStubs.includes(file) && existsSync(file)).forEach(file => rmSync(file))
}

if (failed) {
  console.error('\nGagal membuat project. Pastikan sudah menjalankan "npm run as:login" dan Apps Script API sudah ON di')
  console.error('https://script.google.com/home/usersettings (tunggu beberapa menit setelah mengaktifkannya).')
  process.exit(1)
}
console.log('\nBerhasil. Langkah berikutnya: npm run as:push')
