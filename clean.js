const fs = require('fs');

// Lire le fichier
const data = JSON.parse(fs.readFileSync('data.json', 'utf-8'));

function cleanName(name) {
  if (!name) return name;

  return name
    // 🔥 Remplacer les points par des espaces
    .replace(/\./g, ' ')

    // Supprimer [ ... ] et ( ... )
    .replace(/\[.*?\]/g, '')
    .replace(/\(.*?\)/g, '')

    // 🔥 Supprimer noms de repackers connus
    .replace(/\b(KaOs|DODI|FitGirl|Decepticon|RG Mechanics|xatab)\b.*$/i, '')

    // Repack / sources
    .replace(/\b(Repack|REPACK)\b.*$/i, '')
    .replace(/\bFrom\s+\w+\b/i, '')

    // DLC / bonus
    .replace(/\+\s*(All\s+)?DLCs?.*/i, '')

    // Build / Patch / version parasites
    .replace(/\b(Build|Patch)\s*[\d\w]*/i, '')
    .replace(/\bv\.\s*$/i, '')     // supprime "v."
    .replace(/\bv\s*$/i, '')       // supprime "v"

    // Editions (supprime tout le bloc proprement)
    .replace(/\b(Complete|Digital|Deluxe|Super|Ultimate|Gold)\b.*$/i, '')

    // MULTiXX
    .replace(/\bMULTi\d+\b/i, '')

    // Tirets longs
    .replace(/–.*/g, '')

    // 🔥 Nettoyage ponctuation restante
    .replace(/[,:;\-\/\\]+$/g, '')

    // 🔥 Corriger espaces multiples
    .replace(/\s{2,}/g, ' ')

    // 🔥 Trim final
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
