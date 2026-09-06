// scripts/update.js
// CrackUZU — Script de mise à jour de data.json v3
// FIXES:
//   - Sauvegarde checkpoint toutes les 100 jeux (résistant aux crashes/timeouts)
//   - Logs forcés (flush immédiat) pour voir la progression en temps réel
//   - sleep réduit à 200ms (était 600ms → 3x plus rapide)
//   - Déduplication correctement appliquée à existingBySlug
//   - Concurrence x3 pour les appels API (3 jeux en parallèle)

const fs    = require('fs');
const path  = require('path');
const https = require('https');
const http  = require('http');

// ─────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────
const DATA_FILE        = path.join(__dirname, '..', 'data.json');
const AMBIGUOUS_FILE   = path.join(__dirname, '..', 'ambiguous.json');
const CHECKPOINT_FILE  = path.join(__dirname, '..', 'checkpoint.json');

const SOURCES = {
  onlinefix: 'https://raw.githubusercontent.com/ArnamentGames/HydraLinks/refs/heads/main/onlinefix.json',
  fitgirl:   'https://raw.githubusercontent.com/ArnamentGames/HydraLinks/refs/heads/main/fitgirl.json',
  dodi:      'https://raw.githubusercontent.com/ArnamentGames/HydraLinks/refs/heads/main/dodi.json',
  xatab:     'https://raw.githubusercontent.com/ArnamentGames/HydraLinks/refs/heads/main/xatab.json',
  steamrip:  'https://raw.githubusercontent.com/ArnamentGames/HydraLinks/refs/heads/main/steamrip.json',
};

const STEAMGRIDDB_KEY    = process.env.STEAMGRIDDB_API_KEY  || '';
const IGDB_CLIENT_ID     = process.env.IGDB_CLIENT_ID       || '';
const IGDB_CLIENT_SECRET = process.env.IGDB_CLIENT_SECRET   || '';

const DEDUP_MERGE_THRESHOLD    = 5;
const DEDUP_AMBIGUOUS_THRESHOLD = 15;

const SLEEP_MS        = 200;   // réduit de 600 → 200ms
const CONCURRENCY     = 3;     // 3 jeux enrichis en parallèle
const CHECKPOINT_EVERY = 100;  // sauvegarde toutes les 100 jeux

// ─────────────────────────────────────────────
// LOG FORCÉ (flush immédiat dans GitHub Actions)
// ─────────────────────────────────────────────
function log(...args) {
  process.stdout.write(args.join(' ') + '\n');
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
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
    }
  }
  return dp[m][n];
}

// ─────────────────────────────────────────────
// HTTP FETCH HELPER
// ─────────────────────────────────────────────
function fetchJSON(url, headers = {}, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 5) return reject(new Error('Too many redirects'));
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 CrackuzuBot/3.0', ...headers }
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
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// ─────────────────────────────────────────────
// PARSE ITEM
// ─────────────────────────────────────────────
function parseItem(item, sourceName) {
  const rawTitle = item.title || '';
  const cleanedName = cleanName(rawTitle);
  const versionMatch = rawTitle.match(/\bv?(\d+\.\d+[\d.a-zA-Z]*)/);
  return {
    name:       cleanedName || rawTitle,
    version:    versionMatch ? versionMatch[1] : null,
    size:       item.fileSize || null,
    magnet:     (item.uris && item.uris[0]) || null,
    uploadDate: item.uploadDate || null,
    source:     sourceName,
  };
}

// ─────────────────────────────────────────────
// STEAM COVERS
// ─────────────────────────────────────────────
async function fetchSteamCovers(gameName) {
  try {
    const encoded = encodeURIComponent(gameName);
    const data = await fetchJSON(`https://store.steampowered.com/api/storesearch/?term=${encoded}&l=en&cc=US`);
    const items = data.items || [];
    if (!items.length) return null;
    let best = null, bestScore = Infinity;
    for (const item of items) {
      const score = levenshtein(gameName, item.name);
      if (score < bestScore) { bestScore = score; best = item; }
    }
    if (!best || bestScore > 10) return null;
    return {
      portrait:  `https://shared.steamstatic.com/store_item_assets/steam/apps/${best.id}/library_600x900.jpg`,
      landscape: `https://shared.steamstatic.com/store_item_assets/steam/apps/${best.id}/capsule_616x353.jpg`,
    };
  } catch(e) { return null; }
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
    const portrait  = (portraitData.data || [])[0]?.url || null;
    const landscape = (heroData.data     || [])[0]?.url || null;
    return (portrait || landscape) ? { portrait, landscape } : null;
  } catch(e) { return null; }
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
      hostname: 'id.twitch.tv', path: '/oauth2/token', method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(postData) }
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
        } catch(e) { reject(e); }
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
        hostname: 'api.igdb.com', path: '/v4/games', method: 'POST',
        headers: {
          'Client-ID': IGDB_CLIENT_ID, 'Authorization': `Bearer ${token}`,
          'Content-Type': 'text/plain', 'Content-Length': Buffer.byteLength(body),
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
            resolve((!best || bestScore > 10) ? null : best.id);
          } catch(e) { resolve(null); }
        });
      });
      req.on('error', () => resolve(null));
      req.setTimeout(10000, () => { req.destroy(); resolve(null); });
      req.write(body);
      req.end();
    });
  } catch(e) { return null; }
}

// ─────────────────────────────────────────────
// DÉDUPLICATION
// ─────────────────────────────────────────────
function deduplicateGames(games) {
  const merged = [], ambiguous = [];
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
      if (!sourceAlreadyPresent) bestMatch.sources.push(...game.sources);
      if (game.name.length < bestMatch.name.length) {
        bestMatch.name = game.name;
        bestMatch.id   = slugify(game.name);
      }
    } else if (bestMatch && bestScore <= DEDUP_AMBIGUOUS_THRESHOLD) {
      ambiguous.push({ game1: bestMatch.name, game2: game.name, score: bestScore, action: 'to_review' });
      merged.push(game);
    } else {
      merged.push(game);
    }
  }
  return { merged, ambiguous };
}

// ─────────────────────────────────────────────
// CHECKPOINT : sauvegarde partielle
// ─────────────────────────────────────────────
function saveCheckpoint(processedIds) {
  try {
    fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify({ processedIds, ts: Date.now() }), 'utf8');
  } catch(e) { log('⚠️  Impossible de sauvegarder le checkpoint:', e.message); }
}

function loadCheckpoint() {
  try {
    if (fs.existsSync(CHECKPOINT_FILE)) {
      const c = JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf8'));
      // Checkpoint périmé si > 23h (on repart de zéro chaque jour)
      if (Date.now() - c.ts < 23 * 60 * 60 * 1000) {
        log(`♻️  Checkpoint trouvé: ${c.processedIds.length} jeux déjà traités`);
        return new Set(c.processedIds);
      }
    }
  } catch(e) {}
  return new Set();
}

// ─────────────────────────────────────────────
// CHARGEMENT data.json
// ─────────────────────────────────────────────
function loadExistingData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      if (raw.sources && !raw.games) {
        log('  ⚠️  Ancien format détecté, on repart de zéro');
        return { lastUpdated: null, games: [] };
      }
      return raw;
    }
  } catch(e) { log('Impossible de charger data.json:', e.message); }
  return { lastUpdated: null, games: [] };
}

// ─────────────────────────────────────────────
// CONCURRENCE : traite N jeux en parallèle
// ─────────────────────────────────────────────
async function enrichWithConcurrency(games, concurrency, alreadyProcessed, onSave) {
  let i = 0;
  let done = 0;
  const total = games.length;

  async function worker() {
    while (i < total) {
      const idx = i++;
      const game = games[idx];

      // Skip si déjà traité (checkpoint)
      if (alreadyProcessed.has(game.id)) {
        done++;
        log(`  [${done}/${total}] ⏭️  "${game.name}" (déjà traité, skip)`);
        continue;
      }

      const covers = await resolveCovers(game.name);
      game.coverPortrait  = covers.portrait  || null;
      game.coverLandscape = covers.landscape || null;
      game.igdbId = await fetchIGDBId(game.name);

      done++;
      log(
        `  [${done}/${total}] "${game.name}" | ` +
        `portrait: ${game.coverPortrait ? '✅' : '❌'} | ` +
        `landscape: ${game.coverLandscape ? '✅' : '❌'} | ` +
        `IGDB: ${game.igdbId || '❌'}`
      );

      alreadyProcessed.add(game.id);

      // Checkpoint toutes les N jeux
      if (done % CHECKPOINT_EVERY === 0) {
        saveCheckpoint([...alreadyProcessed]);
        onSave(games.slice(0, idx + 1)); // sauvegarde partielle de data.json
        log(`  💾 Checkpoint sauvegardé (${done}/${total})`);
      }

      if (idx < total - 1) await sleep(SLEEP_MS);
    }
  }

  // Lance N workers en parallèle
  await Promise.all(Array.from({ length: concurrency }, worker));
}

// ─────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────
async function main() {
  log('🎮 CrackUZU — Update script v3');
  log(`📅 ${new Date().toISOString()}`);

  const data = loadExistingData();
  const alreadyProcessed = loadCheckpoint();

  const existingBySlug = new Map();
  for (const g of data.games) existingBySlug.set(g.id, g);

  // ── 1. FETCH SOURCES ─────────────────────────────
  const allParsedGames = [];
  let totalFetched = 0;

  for (const [sourceKey, sourceUrl] of Object.entries(SOURCES)) {
    log(`\n📦 Source: ${sourceKey}`);
    let items;
    try {
      const raw = await fetchJSON(sourceUrl);
      items = raw.downloads || raw.games || (Array.isArray(raw) ? raw : []);
      log(`  ${items.length} items récupérés`);
    } catch(e) {
      log(`  ❌ Échec fetch ${sourceKey}: ${e.message}`);
      continue;
    }
    for (const item of items) {
      const parsed = parseItem(item, sourceKey);
      if (!parsed.name) continue;
      allParsedGames.push(parsed);
      totalFetched++;
    }
  }

  log(`\n📊 Total items parsés: ${totalFetched}`);

  // ── 2. SÉPARER nouveaux vs connus ────────────────
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
          source: parsed.source, magnet: parsed.magnet,
          size: parsed.size, uploadDate: parsed.uploadDate, version: parsed.version,
        });
      }
    } else {
      const newGame = {
        id: slug, name: parsed.name, igdbId: null,
        coverPortrait: null, coverLandscape: null,
        sources: [{
          source: parsed.source, magnet: parsed.magnet,
          size: parsed.size, uploadDate: parsed.uploadDate, version: parsed.version,
        }],
      };
      existingBySlug.set(slug, newGame);
      toEnrich.push(newGame);
    }
  }

  log(`\n🆕 ${toEnrich.length} nouveaux jeux à enrichir (covers + IGDB)`);

  // ── 3. DÉDUPLICATION ─────────────────────────────
  const { merged: deduped, ambiguous } = deduplicateGames(toEnrich);
  log(`  Après dédup: ${deduped.length} jeux uniques, ${ambiguous.length} hésitations`);

  // FIX: mettre à jour existingBySlug avec les jeux dédupliqués
  for (const game of deduped) {
    existingBySlug.set(game.id, game);
  }

  if (ambiguous.length > 0) {
    fs.writeFileSync(AMBIGUOUS_FILE, JSON.stringify(ambiguous, null, 2), 'utf8');
    log(`  📝 ${ambiguous.length} hésitations écrites dans ambiguous.json`);
  }

  // Estimation du temps
  const estimatedMinutes = Math.ceil((deduped.length * SLEEP_MS) / 1000 / 60 / CONCURRENCY);
  log(`\n⏱️  Estimation: ~${estimatedMinutes} min pour enrichir ${deduped.length} jeux (x${CONCURRENCY} parallel)`);

  // ── 4. ENRICHISSEMENT ────────────────────────────
  log(`\n🖼️  Enrichissement en cours...`);

  // Fonction de sauvegarde partielle pendant l'enrichissement
  function savePartial(processedGames) {
    const existingGamesMap = new Map();
    for (const g of data.games) existingGamesMap.set(g.id, g);
    for (const [slug, game] of existingBySlug) existingGamesMap.set(slug, game);
    const finalGames = Array.from(existingGamesMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    const partial = { ...data, games: finalGames, lastUpdated: new Date().toISOString() };
    fs.writeFileSync(DATA_FILE, JSON.stringify(partial, null, 2), 'utf8');
    log(`  💾 data.json partiellement sauvegardé (${finalGames.length} jeux total)`);
  }

  await enrichWithConcurrency(deduped, CONCURRENCY, alreadyProcessed, savePartial);

  // ── 5. SAUVEGARDE FINALE ──────────────────────────
  const existingGamesMap = new Map();
  for (const g of data.games) existingGamesMap.set(g.id, g);
  for (const [slug, game] of existingBySlug) existingGamesMap.set(slug, game);

  const finalGames = Array.from(existingGamesMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  data.games       = finalGames;
  data.lastUpdated = new Date().toISOString();

  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');

  // Nettoyage checkpoint
  if (fs.existsSync(CHECKPOINT_FILE)) fs.unlinkSync(CHECKPOINT_FILE);

  log(`\n✅ data.json mis à jour`);
  log(`📊 Total jeux: ${finalGames.length}`);
  log(`🆕 Nouveaux enrichis ce run: ${deduped.length}`);
}

main().catch(e => {
  console.error('💥 Erreur fatale:', e);
  process.exit(1);
});
