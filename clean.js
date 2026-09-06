// clean.js
// CrackUZU — Nettoyage automatique des noms et métadonnées de data.json
const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, 'data.json');
if (!fs.existsSync(dataPath)) {
  console.log('data.json introuvable.');
  process.exit(0);
}

try {
  const content = fs.readFileSync(dataPath, 'utf8');
  const raw = JSON.parse(content);
  const games = Array.isArray(raw) ? raw : (raw.games || []);

  function cleanString(str) {
    if (!str) return '';
    return str
      .replace(/[\u00ae\u2122\u00a9]/g, '')
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2013\u2014]/g, '-')
      .replace(/\u2026/g, '...')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  let modifiedCount = 0;
  for (const game of games) {
    const origTitle = game.title || game.name || '';
    const cleanedTitle = cleanString(origTitle);
    if (cleanedTitle !== origTitle) {
      if (game.title) game.title = cleanedTitle;
      if (game.name) game.name = cleanedTitle;
      modifiedCount++;
    }
  }

  fs.writeFileSync(dataPath, JSON.stringify(raw, null, 2), 'utf8');
  console.log(`✅ Nettoyage terminé : ${modifiedCount} jeux nettoyés sur ${games.length}.`);
} catch (e) {
  console.error('Erreur lors du nettoyage :', e);
  process.exit(1);
}
