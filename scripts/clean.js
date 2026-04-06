const fs = require('fs');

const data = JSON.parse(fs.readFileSync('data.json', 'utf-8'));

function cleanName(name) {
  if (!name) return name;

  return name
    // Supprimer [ ... ] et ( ... )
    .replace(/\[.*?\]/g, '')
    .replace(/\(.*?\)/g, '')

    // Repack / sources
    .replace(/\b(Repack|REPACK)\b.*$/i, '')
    .replace(/\b(DODI|FitGirl|Decepticon)\b.*$/i, '')
    .replace(/\bFrom\s+\w+\b/i, '')

    // DLC / bonus
    .replace(/\+\s*(All\s+)?DLCs?.*/i, '')

    // Build / Patch
    .replace(/\b(Build|Patch)\s*[\d\w]*/i, '')

    // Editions
    .replace(/\b(Complete Edition|Digital Deluxe Edition|Deluxe Edition|Gold Edition|Ultimate Edition)\b/i, '')

    // MULTiXX
    .replace(/\bMULTi\d+\b/i, '')

    // Tirets longs qui coupent le nom
    .replace(/–.*/g, '')

    // Nettoyage final
    .replace(/[,:;\-\/\\]+$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

const cleaned = data.map(item => ({
  ...item,
  name: cleanName(item.name || item.title)
}));

fs.writeFileSync('data.cleaned.json', JSON.stringify(cleaned, null, 2));

console.log('✅ Nettoyage terminé → data.cleaned.json');
