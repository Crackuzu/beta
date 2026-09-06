// js/core/search.js
// CrackUZU — Moteur de recherche floue (Fuzzy Search)

const SearchEngine = {
  // Dictionnaire d'acronymes courants dans le gaming
  acronyms: {
    'gta': 'Grand Theft Auto',
    'gta5': 'Grand Theft Auto V',
    'gta 5': 'Grand Theft Auto V',
    'gta4': 'Grand Theft Auto IV',
    'cod': 'Call of Duty',
    'dmc': 'Devil May Cry',
    'dmc5': 'Devil May Cry 5',
    'dbz': 'Dragon Ball Z',
    'mgr': 'Metal Gear Rising',
    'mgs': 'Metal Gear Solid',
    'rdr': 'Red Dead Redemption',
    'rdr2': 'Red Dead Redemption 2',
    'tarkov': 'Escape from Tarkov',
    'ac': 'Assassins Creed',
    'cp2077': 'Cyberpunk 2077',
    'hl': 'Half Life',
    're': 'Resident Evil',
    're4': 'Resident Evil 4',
    'gow': 'God of War',
    'botw': 'Breath of the Wild',
    'totk': 'Tears of the Kingdom',
    'smash': 'Super Smash Bros',
    'mario kart': 'Mario Kart'
  },

  // Normalisation : retire accents, ponctuation, minuscules
  normalize(str) {
    if (!str) return '';
    return str
      .toString()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // retire accents
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')     // ponctuation -> espace
      .replace(/\s+/g, ' ')
      .trim();
  },

  // Distance de Levenshtein (optimisée)
  levenshtein(a, b) {
    if (a === b) return 0;
    const la = a.length, lb = b.length;
    if (la === 0) return lb;
    if (lb === 0) return la;

    const row = Array.from({ length: lb + 1 }, (_, i) => i);
    for (let i = 1; i <= la; i++) {
      let prev = i;
      for (let j = 1; j <= lb; j++) {
        const val = a[i - 1] === b[j - 1] ? row[j - 1] : 1 + Math.min(row[j - 1], row[j], prev);
        row[j - 1] = prev;
        prev = val;
      }
      row[lb] = prev;
    }
    return row[lb];
  },

  // Calcule un score de pertinence entre query et texte (0 = aucun match)
  scoreMatch(queryNorm, textNorm) {
    if (!queryNorm || !textNorm) return 0;

    // 1. Match exact
    if (textNorm === queryNorm) return 1000;

    // 2. Début du titre (préfixe)
    if (textNorm.startsWith(queryNorm)) {
      return 800 + Math.round((queryNorm.length / textNorm.length) * 100);
    }

    // 3. Contient la séquence exacte
    const subIdx = textNorm.indexOf(queryNorm);
    if (subIdx !== -1) {
      return Math.max(200, 600 - subIdx * 5);
    }

    // 4. Correspondance par mots (tokens)
    const qTokens = queryNorm.split(' ').filter(Boolean);
    const tTokens = textNorm.split(' ').filter(Boolean);

    let tokenScore = 0;
    let matchedCount = 0;

    for (const qToken of qTokens) {
      let bestTokenScore = 0;

      for (const tToken of tTokens) {
        // Mot identique
        if (tToken === qToken) {
          bestTokenScore = Math.max(bestTokenScore, 100);
          continue;
        }
        // Préfixe de mot ("pal" -> "palworld")
        if (tToken.startsWith(qToken)) {
          bestTokenScore = Math.max(bestTokenScore, 80);
          continue;
        }
        // Mot contient le token
        if (tToken.includes(qToken)) {
          bestTokenScore = Math.max(bestTokenScore, 60);
          continue;
        }
        // Fautes de frappe (Levenshtein pour mots >= 4 lettres)
        if (qToken.length >= 4) {
          const maxDist = qToken.length >= 7 ? 2 : 1;
          if (Math.abs(tToken.length - qToken.length) <= maxDist) {
            const dist = this.levenshtein(qToken, tToken);
            if (dist <= maxDist) {
              bestTokenScore = Math.max(bestTokenScore, 50 - dist * 10);
            }
          }
        }
      }

      if (bestTokenScore > 0) {
        tokenScore += bestTokenScore;
        matchedCount++;
      }
    }

    // Doit avoir fait correspondre au moins 60% des mots cherchés
    if (matchedCount >= Math.ceil(qTokens.length * 0.6)) {
      return tokenScore * (matchedCount / qTokens.length);
    }

    return 0;
  },

  // Recherche principale dans une liste de jeux
  search(games, query, limit = 24) {
    if (!query || !query.trim()) return games.slice(0, limit);

    const qNorm = this.normalize(query);
    if (!qNorm) return [];

    // Vérifie acronymes
    const expandedAcronym = this.acronyms[qNorm];
    const expandedNorm = expandedAcronym ? this.normalize(expandedAcronym) : null;

    const scored = [];

    for (const game of games) {
      const name = game.name || game.title || '';
      const nameNorm = this.normalize(name);
      const catNorm = (game.categories || []).map(c => this.normalize(c)).join(' ');

      let score = this.scoreMatch(qNorm, nameNorm);

      // Si un acronyme match
      if (expandedNorm) {
        const acScore = this.scoreMatch(expandedNorm, nameNorm) * 0.95;
        if (acScore > score) score = acScore;
      }

      // Bonus si match sur la catégorie
      if (catNorm && catNorm.includes(qNorm)) {
        score += 40;
      }

      if (score > 0) {
        scored.push({ game, score });
      }
    }

    // Tri par score décroissant
    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, limit).map(s => s.game);
  }
};
