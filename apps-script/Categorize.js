/**
 * Menebak kategori dari teks (keterangan / nama merchant) memakai kolom kata_kunci di tab Kategori.
 * Kata kunci terpanjang yang cocok menang (lebih spesifik). Kalau preferGroup diisi,
 * kategori dengan grup itu didahulukan.
 */

function normalizeText_(text) {
  return ' ' + String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() + ' '
}

function guessCategory_(text, categories, tipe, preferGroup) {
  const haystack = normalizeText_(text)
  if (!haystack.trim()) return ''
  let candidates = []
  categories.forEach(c => {
    if (c.tipe !== tipe || !c.aktif) return
    let score = 0
    c.kata_kunci.forEach(keyword => {
      const needle = normalizeText_(keyword)
      if (needle.trim() && haystack.indexOf(needle) > -1) score = Math.max(score, needle.trim().length)
    })
    if (score > 0) candidates.push({ category: c, score: score })
  })
  if (!candidates.length) return ''
  if (preferGroup) {
    const preferred = candidates.filter(x => x.category.grup === preferGroup)
    if (preferred.length) candidates = preferred
  }
  candidates.sort((a, b) => b.score - a.score || a.category.urutan - b.category.urutan)
  return candidates[0].category.nama
}
