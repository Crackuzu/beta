// scripts/update.js
// CrackUZU — Script de mise à jour de data.json
// - Récupère TOUS les jeux de chaque source (pas de filtre date au premier run)
// - Nettoie les noms (logique clean.js intégrée)
// - Résout coverPortrait (600x900) + coverLandscape (616x353) via Steam → SteamGridDB
// - Récupère l'igdbId via l'API IGDB
// - Déduplique les jeux inter-sources (Levenshtein ≤ 5 → fusionné, 6-15 → ambiguous.json)
// - Structure data.json : liste globale de jeux avec tableau de sources

const fs   = require('fs');
const path = require('path');
const https = require('https');
const http  = require('http');

// ─────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────
const DATA_FILE      = path.join(__dirname, '..', 'data.json');
const AMBIGUOUS_FILE = path.join(__dirname, '..', 'ambiguous.json');

const SOURCES = {
  onlinefix: 'https://raw.githubusercontent.com/ArnamentGames/HydraLinks/refs/heads/main/onlinefix.json',
  fitgirl:   'https://raw.githubusercontent.com/ArnamentGames/HydraLinks/refs/heads/main/fitgirl.json',
  dodi:      'https://raw.githubusercontent.com/ArnamentGames/HydraLinks/refs/heads/main/dodi.json',
  xatab:     'https://raw.githubusercontent.com/ArnamentGames/HydraLinks/refs/heads/main/xatab.json',
  steamrip:  'https://raw.githubusercontent.com/ArnamentGames/HydraLinks/refs/heads/main/steamrip.json',
};

const STEAMGRIDDB_KEY  = process.env.STEAMGRIDDB_API_KEY || '';
const IGDB_CLIENT_ID   = process.env.IGDB_CLIENT_ID     || '';
const IGDB_CLIENT_SECRET = process.env.IGDB_CLIENT_SECRET || '';

// Seuils Levenshtein pour la déduplication
const DEDUP_MERGE_THRESHOLD    = 5;  // ≤ 5  → même jeu, on fusionne
const DEDUP_AMBIGUOUS_THRESHOLD = 15; // 6-15 → incertain, on écrit dans ambiguous.json

// ─────────────────────────────────────────────
// LEVENSHTEIN
// ─────────────────────────────────────────────
function levenshtein(a, b) {
  a = a.toLowerCase();
  b = b.toLowerCase();
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
    }
  }
  return dp[m][n];
}

// ─────────────────────────────────────────────
// HTTP FETCH HELPER (pas de dépendances externes)
// ─────────────────────────────────────────────
function fetchJSON(url, headers = {}, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 5) return reject(new Error('Too many redirects'));
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 CrackuzuBot/2.0', ...headers }
    }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchJSON(res.headers.location, headers, redirectCount + 1)
          .then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(new Error(`JSON parse error for ${url}: ${e.message}`)); }
      });
    });
    req.on('error', reject);
    req.setTimeout(20000, () => { req.destroy(); reject(new Error(`Timeout for ${url}`)); });
  });
}

// ─────────────────────────────────────────────
// SLEEP
// ─────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─────────────────────────────────────────────
// NETTOYAGE DU NOM (clean.js intégré + amélioré)
// ─────────────────────────────────────────────
function cleanName(raw) {
  if (!raw) return '';

  let name = raw
    // Points → espaces (fitgirl style : "Elden.Ring.v1.2")
    .replace(/\./g, ' ')

    // Supprimer les blocs entre crochets/parenthèses
    .replace(/\[.*?\]/g, '')
    .replace(/\(.*?\)/g, '')

    // Repackers connus — supprime tout ce qui suit
    .replace(/\b(KaOs|DODI|FitGirl|Decepticon|RG\s*Mechanics|xatab|SteamRip|ElAmigos|Masquerade|Chovka|R\.G\.\s*\w+)\b.*$/i, '')
    .replace(/\bRepack\b.*$/i, '')
    .replace(/\bFrom\s+\w+\b/gi, '')

    // DLC
    .replace(/\+\s*(All\s+)?DLCs?.*/i, '')

    // Build / Patch
    .replace(/\bBuild\s*[\d\w]*/gi, '')
    .replace(/\bPatch\s*[\d\w]*/gi, '')

    // Versions (v1.2.3 etc.) — les points ont déjà été remplacés par des espaces
    // donc on matche "v1 09", "v2 12", "v1 0 5" etc.
    .replace(/\bv\s*\d[\d\s.]*/gi, '')

    // Éditions (on garde le nom du jeu, supprime tout ce qui suit le mot d'édition)
    // On ne supprime PAS le mot d'édition pour conserver "Deluxe Edition" dans le nom
    // La dédup Levenshtein s'occupera de regrouper "Elden Ring" et "Elden Ring Deluxe Edition"

    // MULTiXX
    .replace(/\bMULTi\d+\b/gi, '')

    // Tirets longs
    .replace(/–.*/g, '')

    // Ponctuation traînante
    .replace(/[,:;\-\/\\|]+$/, '')

    // Espaces multiples + trim
    .replace(/\s{2,}/g, ' ')
    .trim();

  return name;
}

// Génère un ID slug à partir du nom
function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// ─────────────────────────────────────────────
// PARSE ITEM HYDRA
// ─────────────────────────────────────────────
function parseItem(item, sourceName) {
  const rawTitle = item.title || '';
  const cleanedName = cleanName(rawTitle);

  // Extraction version depuis le titre brut
  const versionMatch = rawTitle.match(/\bv?(\d+\.\d+[\d.a-zA-Z]*)/);
  const version = versionMatch ? versionMatch[1] : null;

  return {
    name:       cleanedName || rawTitle,
    version:    version,
    size:       item.fileSize || null,
    magnet:     (item.uris && item.uris[0]) || null,
    uploadDate: item.uploadDate || null,
    source:     sourceName,
  };
}

// ─────────────────────────────────────────────
// STEAM : coverPortrait + coverLandscape
// ─────────────────────────────────────────────
async function fetchSteamCovers(gameName) {
  try {
    const encoded = encodeURIComponent(gameName);
    const data = await fetchJSON(
      `https://store.steampowered.com/api/storesearch/?term=${encoded}&l=en&cc=US`
    );
    const items = data.items || [];
    if (!items.length) return null;

    let best = null, bestScore = Infinity;
    for (const item of items) {
      const score = levenshtein(gameName, item.name);
      if (score < bestScore) { bestScore = score; best = item; }
    }

    // Seuil assez strict pour la cover Steam (on ne veut pas matcher un mauvais jeu)
    if (!best || bestScore > 10) {
      console.log(`  Steam: pas de match proche pour "${gameName}" (best: "${best?.name}", score: ${bestScore})`);
      return null;
    }

    console.log(`  Steam: "${gameName}" → "${best.name}" (score: ${bestScore}, appId: ${best.id})`);
    return {
      portrait:  `https://shared.steamstatic.com/store_item_assets/steam/apps/${best.id}/library_600x900.jpg`,
      landscape: `https://shared.steamstatic.com/store_item_assets/steam/apps/${best.id}/capsule_616x353.jpg`,
    };
  } catch(e) {
    console.error(`  Steam error pour "${gameName}":`, e.message);
    return null;
  }
}

// ─────────────────────────────────────────────
// STEAMGRIDDB FALLBACK
// ─────────────────────────────────────────────
async function fetchSteamGridDBCovers(gameName) {
  if (!STEAMGRIDDB_KEY) return null;
  try {
    const encoded = encodeURIComponent(gameName);
    const searchData = await fetchJSON(
      `https://www.steamgriddb.com/api/v2/search/autocomplete/${encoded}`,
      { Authorization: `Bearer ${STEAMGRIDDB_KEY}` }
    );
    const games = searchData.data || [];
    if (!games.length) return null;

    let best = null, bestScore = Infinity;
    for (const g of games) {
      const score = levenshtein(gameName, g.name);
      if (score < bestScore) { bestScore = score; best = g; }
    }
    if (!best || bestScore > 15) return null;

    console.log(`  SteamGridDB: "${gameName}" → "${best.name}" (score: ${bestScore})`);

    // Portrait (600x900 ou 342x482 ou 660x930)
    const portraitData = await fetchJSON(
      `https://www.steamgriddb.com/api/v2/grids/game/${best.id}?dimensions=600x900,342x482,660x930`,
      { Authorization: `Bearer ${STEAMGRIDDB_KEY}` }
    );
    // Landscape via heroes (3840x1240, 1920x620)
    const heroData = await fetchJSON(
      `https://www.steamgriddb.com/api/v2/heroes/game/${best.id}`,
      { Authorization: `Bearer ${STEAMGRIDDB_KEY}` }
    );

    const portrait  = (portraitData.data || [])[0]?.url || null;
    const landscape = (heroData.data     || [])[0]?.url || null;

    return (portrait || landscape) ? { portrait, landscape } : null;
  } catch(e) {
    console.error(`  SteamGridDB error pour "${gameName}":`, e.message);
    return null;
  }
}

// ─────────────────────────────────────────────
// RESOLVE COVERS (Steam → SteamGridDB)
// ─────────────────────────────────────────────
async function resolveCovers(gameName) {
  const steam = await fetchSteamCovers(gameName);
  if (steam) return steam;
  const sgdb = await fetchSteamGridDBCovers(gameName);
  return sgdb || { portrait: null, landscape: null };
}

// ─────────────────────────────────────────────
// IGDB AUTH (token OAuth2 Twitch)
// ─────────────────────────────────────────────
let igdbToken = null;
let igdbTokenExpiry = 0;

async function getIGDBToken() {
  if (igdbToken && Date.now() < igdbTokenExpiry) return igdbToken;

  return new Promise((resolve, reject) => {
    const postData = `client_id=${IGDB_CLIENT_ID}&client_secret=${IGDB_CLIENT_SECRET}&grant_type=client_credentials`;
    const options = {
      hostname: 'id.twitch.tv',
      path: '/oauth2/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
      }
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const j = JSON.parse(data);
          igdbToken = j.access_token;
          igdbTokenExpiry = Date.now() + (j.expires_in - 300) * 1000; // refresh 5min avant expiry
          resolve(igdbToken);
        } catch(e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// ─────────────────────────────────────────────
// IGDB — Recherche par nom → retourne igdbId
// ─────────────────────────────────────────────
async function fetchIGDBId(gameName) {
  if (!IGDB_CLIENT_ID || !IGDB_CLIENT_SECRET) return null;
  try {
    const token = await getIGDBToken();
    const body = `search "${gameName}"; fields id,name; limit 5;`;

    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.igdb.com',
        path: '/v4/games',
        method: 'POST',
        headers: {
          'Client-ID': IGDB_CLIENT_ID,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'text/plain',
          'Content-Length': Buffer.byteLength(body),
        }
      };
      const req = https.request(options, res => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
          try {
            const results = JSON.parse(data);
            if (!results.length) return resolve(null);

            // Meilleur match Levenshtein
            let best = null, bestScore = Infinity;
            for (const r of results) {
              const score = levenshtein(gameName, r.name);
              if (score < bestScore) { bestScore = score; best = r; }
            }
            if (!best || bestScore > 10) return resolve(null);

            console.log(`  IGDB: "${gameName}" → "${best.name}" (id: ${best.id}, score: ${bestScore})`);
            resolve(best.id);
          } catch(e) { resolve(null); }
        });
      });
      req.on('error', () => resolve(null));
      req.setTimeout(10000, () => { req.destroy(); resolve(null); });
      req.write(body);
      req.end();
    });
  } catch(e) {
    console.error(`  IGDB error pour "${gameName}":`, e.message);
    return null;
  }
}

// ─────────────────────────────────────────────
// DÉDUPLICATION GLOBALE
// ─────────────────────────────────────────────
// Retourne { merged: Game[], ambiguous: AmbiguousEntry[] }
function deduplicateGames(games) {
  const merged  = [];   // jeux finaux dédupliqués
  const ambiguous = []; // hésitations à review manuellement

  for (const game of games) {
    const nameLower = game.name.toLowerCase();

    // Cherche si un jeu existant dans merged est proche
    let bestMatch = null, bestScore = Infinity;
    for (const existing of merged) {
      const score = levenshtein(nameLower, existing.name.toLowerCase());
      if (score < bestScore) { bestScore = score; bestMatch = existing; }
    }

    if (bestMatch && bestScore <= DEDUP_MERGE_THRESHOLD) {
      // Même jeu → on fusionne les sources (évite les doublons de source)
      const sourceAlreadyPresent = bestMatch.sources.some(
        s => s.source === game.sources[0].source && s.magnet === game.sources[0].magnet
      );
      if (!sourceAlreadyPresent) {
        bestMatch.sources.push(...game.sources);
      }
      // Garde le nom le plus court comme nom canonique
      if (game.name.length < bestMatch.name.length) {
        bestMatch.name = game.name;
        bestMatch.id   = slugify(game.name);
      }

    } else if (bestMatch && bestScore <= DEDUP_AMBIGUOUS_THRESHOLD) {
      // Incertain → on ajoute quand même le jeu mais on log pour review
      ambiguous.push({
        game1: bestMatch.name,
        game2: game.name,
        score: bestScore,
        action: 'to_review', // l'utilisateur peut changer en "merge" ou "keep_separate"
      });
      // Par défaut on garde séparé (safe)
      merged.push(game);

    } else {
      // Nouveau jeu
      merged.push(game);
    }
  }

  return { merged, ambiguous };
}

// ─────────────────────────────────────────────
// CHARGER data.json EXISTANT
// ─────────────────────────────────────────────
function loadExistingData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      // Support ancien format (data.sources) → on repart de zéro si ancien format
      if (raw.sources && !raw.games) {
        console.log('  ⚠️  Ancien format détecté (data.sources), on repart de zéro');
        return { lastUpdated: null, games: [] };
      }
      return raw;
    }
  } catch(e) {
    console.warn('Impossible de charger data.json:', e.message);
  }
  return { lastUpdated: null, games: [] };
}

// ─────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────
async function main() {
  console.log('🎮 CrackUZU — Update script v2');
  console.log(`📅 ${new Date().toISOString()}`);

  const data = loadExistingData();

  // Index des jeux existants par nom normalisé pour lookup rapide
  const existingBySlug = new Map();
  for (const g of data.games) {
    existingBySlug.set(g.id, g);
  }

  // Tous les jeux nouvellement parsés (toutes sources)
  const allParsedGames = [];
  let totalFetched = 0;

  // ── 1. FETCH TOUTES LES SOURCES ──────────────────
  for (const [sourceKey, sourceUrl] of Object.entries(SOURCES)) {
    console.log(`\n📦 Source: ${sourceKey}`);

    let items;
    try {
      const raw = await fetchJSON(sourceUrl);
      items = raw.downloads || raw.games || (Array.isArray(raw) ? raw : []);
      console.log(`  ${items.length} items récupérés`);
    } catch(e) {
      console.error(`  ❌ Échec fetch ${sourceKey}:`, e.message);
      continue;
    }

    for (const item of items) {
      const parsed = parseItem(item, sourceKey);
      if (!parsed.name) continue;
      allParsedGames.push(parsed);
      totalFetched++;
    }
  }

  console.log(`\n📊 Total items parsés: ${totalFetched}`);

  // ── 2. SÉPARER nouveaux vs déjà connus ───────────
  // Un jeu est "connu" si son slug existe déjà dans data.json
  // ET si la source+magnet existe déjà dans ses sources
  const toEnrich = []; // jeux qui nécessitent couverture + IGDB

  for (const parsed of allParsedGames) {
    const slug = slugify(parsed.name);

    if (existingBySlug.has(slug)) {
      // Jeu connu → juste ajouter la source si elle n'existe pas
      const existing = existingBySlug.get(slug);
      const sourceExists = existing.sources.some(
        s => s.source === parsed.source && s.magnet === parsed.magnet
      );
      if (!sourceExists) {
        existing.sources.push({
          source:     parsed.source,
          magnet:     parsed.magnet,
          size:       parsed.size,
          uploadDate: parsed.uploadDate,
          version:    parsed.version,
        });
      }
    } else {
      // Nouveau jeu → à enrichir (cover + IGDB)
      const newGame = {
        id:             slug,
        name:           parsed.name,
        igdbId:         null,
        coverPortrait:  null,
        coverLandscape: null,
        sources: [{
          source:     parsed.source,
          magnet:     parsed.magnet,
          size:       parsed.size,
          uploadDate: parsed.uploadDate,
          version:    parsed.version,
        }],
      };
      existingBySlug.set(slug, newGame);
      toEnrich.push(newGame);
    }
  }

  console.log(`\n🆕 ${toEnrich.length} nouveaux jeux à enrichir (covers + IGDB)`);

  // ── 3. DÉDUPLICATION des nouveaux ────────────────
  // On déduplique uniquement les nouveaux entre eux avant enrichissement
  const { merged: deduped, ambiguous } = deduplicateGames(toEnrich);
  console.log(`  Après dédup: ${deduped.length} jeux uniques, ${ambiguous.length} hésitations`);

  if (ambiguous.length > 0) {
    fs.writeFileSync(AMBIGUOUS_FILE, JSON.stringify(ambiguous, null, 2), 'utf8');
    console.log(`  📝 ${ambiguous.length} hésitations écrites dans ambiguous.json`);
  }

  // ── 4. ENRICHISSEMENT (covers + IGDB) ────────────
  console.log(`\n🖼️  Enrichissement des covers et IGDB IDs...`);

  for (let i = 0; i < deduped.length; i++) {
    const game = deduped[i];
    process.stdout.write(`  [${i+1}/${deduped.length}] "${game.name}" ... `);

    // Covers
    const covers = await resolveCovers(game.name);
    game.coverPortrait  = covers.portrait  || null;
    game.coverLandscape = covers.landscape || null;

    // IGDB
    game.igdbId = await fetchIGDBId(game.name);

    console.log(
      `${game.coverPortrait ? '🖼️' : '❌'} portrait | ` +
      `${game.coverLandscape ? '🖼️' : '❌'} landscape | ` +
      `IGDB: ${game.igdbId || '❌'}`
    );

    // Throttle — 600ms entre chaque jeu pour ne pas se faire rate-limit
    if (i < deduped.length - 1) await sleep(600);
  }

  // ── 5. RECONSTRUCTION data.json ──────────────────
  // Fusionner les nouveaux dédupliqués avec les jeux existants
  // (les jeux existants ont déjà été mis à jour en place via existingBySlug)

  // Construire la liste finale : existants mis à jour + nouveaux
  const existingGamesMap = new Map();
  for (const g of data.games) {
    existingGamesMap.set(g.id, g);
  }

  // Appliquer les updates des jeux existants (nouvelles sources ajoutées)
  for (const [slug, game] of existingBySlug) {
    existingGamesMap.set(slug, game);
  }

  // Liste finale triée par nom
  const finalGames = Array.from(existingGamesMap.values())
    .sort((a, b) => a.name.localeCompare(b.name));

  data.games       = finalGames;
  data.lastUpdated = new Date().toISOString();

  // ── 6. ÉCRITURE ───────────────────────────────────
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');

  console.log(`\n✅ data.json mis à jour`);
  console.log(`📊 Total jeux: ${finalGames.length}`);
  console.log(`🆕 Nouveaux ajoutés ce run: ${deduped.length}`);
}

main().catch(e => {
  console.error('💥 Erreur fatale:', e);
  process.exit(1);
});
