const fs = require('fs');

// Lire le fichier
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

    // Tirets longs
    .replace(/–.*/g, '')

    // Nettoyage final
    .replace(/[,:;\-\/\\]+$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// 🔥 Boucle sur toutes les sources
for (const [sourceName, source] of Object.entries(data.sources || {})) {
  if (!source.games) continue;

  console.log(`🔧 Cleaning source: ${sourceName}`);

  source.games = source.games.map(game => {
    const cleanedName = cleanName(game.name);

    // Debug utile
    if (game.name !== cleanedName) {
      console.log('---');
      console.log('OLD:', game.name);
      console.log('NEW:', cleanedName);
    }

    return {
      ...game,
      name: cleanedName
    };
  });
}

// Sauvegarde (remplace directement)
fs.writeFileSync('data.json', JSON.stringify(data, null, 2));

console.log('✅ Nettoyage terminé et sauvegardé dans data.json');
