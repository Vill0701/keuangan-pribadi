/** Menu "💰 Keuangan" di Google Sheet, plus dialog token. */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('💰 Keuangan')
    .addItem('Siapkan sheet', 'setup')
    .addItem('Tampilkan token API', 'showApiToken')
    .addSeparator()
    .addItem('Impor data lama (dari tab Impor)', 'importLegacy')
    .addSeparator()
    .addItem('Buat token API baru', 'rotateApiToken')
    .addToUi()
}

function showApiToken() {
  const token = getApiToken_()
  if (!token) {
    notify_('Token belum ada', 'Jalankan menu 💰 Keuangan → Siapkan sheet terlebih dahulu.')
    return
  }
  // Token hanya berisi huruf a-f dan angka, jadi aman disisipkan ke HTML.
  const html = HtmlService.createHtmlOutput(
    '<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5">' +
    '<p>Salin token ini ke halaman <b>Pengaturan</b> di aplikasi. Jangan bagikan ke siapa pun.</p>' +
    '<input id="t" readonly value="' + token + '" style="width:100%;padding:8px;font-family:monospace;box-sizing:border-box">' +
    '<p><button id="b" style="padding:6px 14px">Salin</button></p>' +
    '<script>' +
    'document.getElementById("b").onclick = function () {' +
    '  var t = document.getElementById("t"); t.select(); document.execCommand("copy"); this.textContent = "Tersalin ✓";' +
    '};' +
    '</script></div>'
  ).setWidth(480).setHeight(200)
  SpreadsheetApp.getUi().showModalDialog(html, 'Token API')
}

function rotateApiToken() {
  const ui = SpreadsheetApp.getUi()
  const answer = ui.alert('Buat token baru?',
    'Token lama langsung tidak berlaku. Semua perangkat (HP & laptop) perlu diisi token baru.',
    ui.ButtonSet.YES_NO)
  if (answer !== ui.Button.YES) return
  setApiToken_(generateToken_())
  showApiToken()
}

/** Menampilkan pesan di Sheet; kalau dijalankan dari editor Apps Script, tulis ke log. */
function notify_(title, message) {
  try {
    SpreadsheetApp.getUi().alert(title, message, SpreadsheetApp.getUi().ButtonSet.OK)
  } catch (err) {
    console.log(title + '\n' + message)
  }
}
