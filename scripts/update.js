// scripts/update.js
// CrackUZU — Script de mise à jour de data.json
// Version optimisée pour GitHub Actions avec logs temps réel

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// ─────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────
const DATA_FILE = path.join(__dirname, '..', 'data.json');
const AMBIGUOUS_FILE = path.join(__dirname, '..', 'ambiguous.json');
const PROGRESS_FILE = path.join(__dirname, '..', 'progress.json'); // pour reprendre

const SOURCES = {
  onlinefix: 'https://raw.githubusercontent.com/ArnamentGames/HydraLinks/refs/heads/main/onlinefix.json',
  fitgirl: 'https://raw.githubusercontent.com/ArnamentGames/HydraLinks/refs/heads/main/fitgirl.json',
  dodi: 'https://raw.githubusercontent.com/ArnamentGames/HydraLinks/refs/heads/main/dodi.json',
  xatab: 'https://raw.githubusercontent.com/ArnamentGames/HydraLinks/refs/heads/main/xatab.json',
  steamrip: 'https://raw.githubusercontent.com/ArnamentGames/HydraLinks/refs/heads/main/steamrip.json',
};

const STEAMGRIDDB_KEY = process.env.STEAMGRIDDB_API_KEY || '';
const IGDB_CLIENT_ID = process.env.IGDB_CLIENT_ID || '';
const IGDB_CLIENT_SECRET = process.env.IGDB_CLIENT_SECRET || '';

// Seuils Levenshtein
const DEDUP_MERGE_THRESHOLD = 5;
const DEDUP_AMBIGUOUS_THRESHOLD = 15;

// Limites pour GitHub Actions (timeout 6h, on peut tout traiter)
const BATCH_SIZE = 50;        // Nombre de jeux par batch
const BATCH_DELAY_MS = 2000;  // Pause entre les batches

// ─────────────────────────────────────────────
// LOGS temps réel (flush immédiat pour GHA)
// ─────────────────────────────────────────────
function log(message, level = 'info') {
  const timestamp = new Date().toISOString();
  const output = `[${timestamp}] ${message}`;
  if (level === 'error') {
    console.error(output);
  } else {
    console.log(output);
  }
  // Force flush sur GitHub Actions
  if (process.stdout.flush) process.stdout.flush();
}

function logProgress(current, total, gameName, status) {
  const percent = ((current / total) * 100).toFixed(1);
  log(`[${current}/${total}] (${percent}%) ${gameName}: ${status}`);
}

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
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

// ─────────────────────────────────────────────
// HTTP FETCH
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
        catch (e) { reject(new Error(`JSON parse error for ${url}: ${e.message}`)); }
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error(`Timeout for ${url}`)); });
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─────────────────────────────────────────────
// NETTOYAGE DU NOM
// ─────────────────────────────────────────────
function cleanName(raw) {
  if (!raw) return '';

  let name = raw
    .replace(/\./g, ' ')
    .replace(/\[.*?\]/g, '')
    .replace(/\(.*?\)/g, '')
    .replace(/\b(KaOs|DODI|FitGirl|Decepticon|RG\s*Mechanics|xatab|SteamRip|ElAmigos|Masquerade|Chovka|R\.G\.\s*\w+)\b.*$/i, '')
    .replace(/\bRepack\b.*$/i, '')
    .replace(/\bFrom\s+\w+\b/gi, '')
    .replace(/\+\s*(All\s+)?DLCs?.*/i, '')
    .replace(/\bBuild\s*[\d\w]*/gi, '')
    .replace(/\bPatch\s*[\d\w]*/gi, '')
    .replace(/\bv\s*\d[\d\s.]*/gi, '')
    .replace(/\bMULTi\d+\b/gi, '')
    .replace(/–.*/g, '')
    .replace(/[,:;\-\/\\|]+$/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return name;
}

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// ─────────────────────────────────────────────
// PARSE ITEM
// ─────────────────────────────────────────────
function parseItem(item, sourceName) {
  const rawTitle = item.title || '';
  const cleanedName = cleanName(rawTitle);
  const versionMatch = rawTitle.match(/\bv?(\d+\.\d+[\d.a-zA-Z]*)/);
  const version = versionMatch ? versionMatch[1] : null;

  return {
    name: cleanedName || rawTitle,
    version: version,
    size: item.fileSize || null,
    magnet: (item.uris && item.uris[0]) || null,
    uploadDate: item.uploadDate || null,
    source: sourceName,
  };
}

// ─────────────────────────────────────────────
// STEAM COVERS
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

    if (!best || bestScore > 10) return null;

    return {
      portrait: `https://shared.steamstatic.com/store_item_assets/steam/apps/${best.id}/library_600x900.jpg`,
      landscape: `https://shared.steamstatic.com/store_item_assets/steam/apps/${best.id}/capsule_616x353.jpg`,
    };
  } catch (e) {
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

    const portraitData = await fetchJSON(
      `https://www.steamgriddb.com/api/v2/grids/game/${best.id}?dimensions=600x900,342x482,660x930`,
      { Authorization: `Bearer ${STEAMGRIDDB_KEY}` }
    );
    const heroData = await fetchJSON(
      `https://www.steamgriddb.com/api/v2/heroes/game/${best.id}`,
      { Authorization: `Bearer ${STEAMGRIDDB_KEY}` }
    );

    const portrait = (portraitData.data || [])[0]?.url || null;
    const landscape = (heroData.data || [])[0]?.url || null;

    return (portrait || landscape) ? { portrait, landscape } : null;
  } catch (e) {
    return null;
  }
}

async function resolveCovers(gameName) {
  const steam = await fetchSteamCovers(gameName);
  if (steam) return steam;
  const sgdb = await fetchSteamGridDBCovers(gameName);
  return sgdb || { portrait: null, landscape: null };
}

// ─────────────────────────────────────────────
// IGDB
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
          igdbTokenExpiry = Date.now() + (j.expires_in - 300) * 1000;
          resolve(igdbToken);
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function fetchIGDBId(gameName) {
  if (!IGDB_CLIENT_ID || !IGDB_CLIENT_SECRET) return null;
  try {
    const token = await getIGDBToken();
    const body = `search "${gameName}"; fields id,name; limit 5;`;

    return new Promise((resolve) => {
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
            let best = null, bestScore = Infinity;
            for (const r of results) {
              const score = levenshtein(gameName, r.name);
              if (score < bestScore) { bestScore = score; best = r; }
            }
            if (!best || bestScore > 10) return resolve(null);
            resolve(best.id);
          } catch (e) { resolve(null); }
        });
      });
      req.on('error', () => resolve(null));
      req.setTimeout(10000, () => { req.destroy(); resolve(null); });
      req.write(body);
      req.end();
    });
  } catch (e) {
    return null;
  }
}

// ─────────────────────────────────────────────
// DÉDUPLICATION
// ─────────────────────────────────────────────
function deduplicateGames(games) {
  const merged = [];
  const ambiguous = [];

  for (const game of games) {
    const nameLower = game.name.toLowerCase();
    let bestMatch = null, bestScore = Infinity;
    for (const existing of merged) {
      const score = levenshtein(nameLower, existing.name.toLowerCase());
      if (score < bestScore) { bestScore = score; bestMatch = existing; }
    }

    if (bestMatch && bestScore <= DEDUP_MERGE_THRESHOLD) {
      const sourceAlreadyPresent = bestMatch.sources.some(
        s => s.source === game.sources[0].source && s.magnet === game.sources[0].magnet
      );
      if (!sourceAlreadyPresent) {
        bestMatch.sources.push(...game.sources);
      }
      if (game.name.length < bestMatch.name.length) {
        bestMatch.name = game.name;
        bestMatch.id = slugify(game.name);
      }
    } else if (bestMatch && bestScore <= DEDUP_AMBIGUOUS_THRESHOLD) {
      ambiguous.push({
        game1: bestMatch.name,
        game2: game.name,
        score: bestScore,
        action: 'to_review',
      });
      merged.push(game);
    } else {
      merged.push(game);
    }
  }

  return { merged, ambiguous };
}

// ─────────────────────────────────────────────
// CHARGEMENT DATA
// ─────────────────────────────────────────────
function loadExistingData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      if (raw.sources && !raw.games) {
        log('⚠️ Ancien format détecté, on repart de zéro');
        return { lastUpdated: null, games: [] };
      }
      return raw;
    }
  } catch (e) {
    log(`Impossible de charger data.json: ${e.message}`, 'error');
  }
  return { lastUpdated: null, games: [] };
}

// ─────────────────────────────────────────────
// SAUVEGARDE PROGRESS
// ─────────────────────────────────────────────
function saveProgress(processedGames) {
  try {
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify({
      lastUpdated: new Date().toISOString(),
      processedCount: processedGames.length,
      processedIds: processedGames.map(g => g.id)
    }, null, 2));
  } catch (e) {
    log(`Impossible de sauvegarder progress: ${e.message}`, 'error');
  }
}

// ─────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────
async function main() {
  log('🎮 CrackUZU — Update script v3 (optimisé GHA)');
  log(`📅 ${new Date().toISOString()}`);

  const data = loadExistingData();
  const existingBySlug = new Map();
  for (const g of data.games) {
    existingBySlug.set(g.id, g);
  }

  // ── 1. FETCH TOUTES LES SOURCES ──────────────
  const allParsedGames = [];
  let totalFetched = 0;

  for (const [sourceKey, sourceUrl] of Object.entries(SOURCES)) {
    log(`📦 Source: ${sourceKey}`);
    try {
      const raw = await fetchJSON(sourceUrl);
      const items = raw.downloads || raw.games || (Array.isArray(raw) ? raw : []);
      log(`  ✅ ${items.length} items récupérés`);
      for (const item of items) {
        const parsed = parseItem(item, sourceKey);
        if (parsed.name) {
          allParsedGames.push(parsed);
          totalFetched++;
        }
      }
    } catch (e) {
      log(`  ❌ Échec fetch ${sourceKey}: ${e.message}`, 'error');
    }
  }

  log(`\n📊 Total items parsés: ${totalFetched}`);

  // ── 2. IDENTIFIER NOUVEAUX JEUX ──────────────
  const toEnrich = [];

  for (const parsed of allParsedGames) {
    const slug = slugify(parsed.name);

    if (existingBySlug.has(slug)) {
      const existing = existingBySlug.get(slug);
      const sourceExists = existing.sources.some(
        s => s.source === parsed.source && s.magnet === parsed.magnet
      );
      if (!sourceExists) {
        existing.sources.push({
          source: parsed.source,
          magnet: parsed.magnet,
          size: parsed.size,
          uploadDate: parsed.uploadDate,
          version: parsed.version,
        });
      }
    } else {
      const newGame = {
        id: slug,
        name: parsed.name,
        igdbId: null,
        coverPortrait: null,
        coverLandscape: null,
        sources: [{
          source: parsed.source,
          magnet: parsed.magnet,
          size: parsed.size,
          uploadDate: parsed.uploadDate,
          version: parsed.version,
        }],
      };
      existingBySlug.set(slug, newGame);
      toEnrich.push(newGame);
    }
  }

  log(`\n🆕 ${toEnrich.length} nouveaux jeux à enrichir`);

  // ── 3. DÉDUPLICATION ─────────────────────────
  const { merged: deduped, ambiguous } = deduplicateGames(toEnrich);
  log(`📊 Après dédup: ${deduped.length} jeux uniques, ${ambiguous.length} hésitations`);

  if (ambiguous.length > 0) {
    fs.writeFileSync(AMBIGUOUS_FILE, JSON.stringify(ambiguous, null, 2));
    log(`📝 ${ambiguous.length} hésitations écrites dans ambiguous.json`);
  }

  // ── 4. ENRICHISSEMENT PAR BATCHES ────────────
  if (deduped.length === 0) {
    log('✅ Aucun nouveau jeu à enrichir');
  } else {
    log(`\n🖼️ Enrichissement de ${deduped.length} jeux (par batches de ${BATCH_SIZE})...`);

    for (let i = 0; i < deduped.length; i++) {
      const game = deduped[i];

      logProgress(i + 1, deduped.length, game.name, 'récupération covers...');

      // Covers
      const covers = await resolveCovers(game.name);
      game.coverPortrait = covers.portrait || null;
      game.coverLandscape = covers.landscape || null;

      logProgress(i + 1, deduped.length, game.name,
        `covers: ${game.coverPortrait ? '✅' : '❌'}/${game.coverLandscape ? '✅' : '❌'}, recherche IGDB...`);

      // IGDB
      game.igdbId = await fetchIGDBId(game.name);

      logProgress(i + 1, deduped.length, game.name,
        `IGDB: ${game.igdbId || '❌'} | terminé`);

      // Pause entre les requêtes (mais pas après le dernier)
      if ((i + 1) % BATCH_SIZE === 0 && i < deduped.length - 1) {
        log(`⏸️ Pause de ${BATCH_DELAY_MS / 1000}s après batch ${Math.floor((i + 1) / BATCH_SIZE)}...`);
        await sleep(BATCH_DELAY_MS);
      }

      // Sauvegarde progress toutes les 10 entrées
      if ((i + 1) % 10 === 0) {
        saveProgress(deduped.slice(0, i + 1));
      }
    }
  }

  // ── 5. FINALISATION ──────────────────────────
  const existingGamesMap = new Map();
  for (const g of data.games) {
    existingGamesMap.set(g.id, g);
  }

  for (const [slug, game] of existingBySlug) {
    existingGamesMap.set(slug, game);
  }

  const finalGames = Array.from(existingGamesMap.values())
    .sort((a, b) => a.name.localeCompare(b.name));

  data.games = finalGames;
  data.lastUpdated = new Date().toISOString();

  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

  log(`\n✅ data.json mis à jour`);
  log(`📊 Total jeux: ${finalGames.length}`);
  log(`🆕 Nouveaux enrichis ce run: ${deduped.length}`);

  // Cleanup progress file
  if (fs.existsSync(PROGRESS_FILE)) {
    fs.unlinkSync(PROGRESS_FILE);
  }
}

main().catch(e => {
  log(`💥 Erreur fatale: ${e.message}`, 'error');
  console.error(e.stack);
  process.exit(1);
});
