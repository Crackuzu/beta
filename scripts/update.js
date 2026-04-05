// scripts/update.js
// GitHub Actions script — runs every hour to update data.json
// Fetches 5 Hydra sources, resolves Steam covers (+ SteamGridDB fallback)

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// ─────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────
const DATA_FILE = path.join(__dirname, '..', 'data.json');

const SOURCES = {
  onlinefix: 'https://raw.githubusercontent.com/ArnamentGames/HydraLinks/refs/heads/main/onlinefix.json',
  fitgirl:   'https://raw.githubusercontent.com/ArnamentGames/HydraLinks/refs/heads/main/fitgirl.json',
  dodi:      'https://raw.githubusercontent.com/ArnamentGames/HydraLinks/refs/heads/main/dodi.json',
  kaoskrew:  'https://raw.githubusercontent.com/ArnamentGames/HydraLinks/refs/heads/main/kaoskrew.json',
  xatab:     'https://raw.githubusercontent.com/ArnamentGames/HydraLinks/refs/heads/main/xatab.json',
};

const STEAMGRIDDB_KEY = process.env.STEAMGRIDDB_API_KEY || '';
const LEVENSHTEIN_THRESHOLD = 10; // max distance to accept a Steam match

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
// HTTP FETCH HELPER (no external deps)
// ─────────────────────────────────────────────
function fetchJSON(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 CrackuzuBot/1.0', ...headers } }, res => {
      // Follow redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchJSON(res.headers.location, headers).then(resolve).catch(reject);
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
    req.setTimeout(15000, () => { req.destroy(); reject(new Error(`Timeout for ${url}`)); });
  });
}

// ─────────────────────────────────────────────
// PARSE HYDRA ITEM
// ─────────────────────────────────────────────
function parseItem(item) {
  const rawTitle = item.title || '';
  // Clean name: remove version numbers, build tags, extra spaces
  const gameName = rawTitle
    .replace(/\bv?\d+[\d.]*[a-zA-Z0-9]*/g, '')
    .replace(/\bBuild\s*\w+/gi, '')
    .replace(/\bEarly\s*Access\b/gi, '')
    .replace(/[_\-]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  // Extract version
  const versionMatch = rawTitle.match(/v?(\d[\d.]*[a-zA-Z0-9]*)/);
  const version = versionMatch ? versionMatch[1] : null;

  return {
    name:       gameName || rawTitle,
    version:    version,
    size:       item.fileSize || null,
    magnet:     (item.uris && item.uris[0]) || null,
    uploadDate: item.uploadDate || null,
    cover:      null,
  };
}

// ─────────────────────────────────────────────
// STEAM COVER SEARCH
// ─────────────────────────────────────────────
async function fetchSteamCover(gameName) {
  try {
    const encoded = encodeURIComponent(gameName);
    const data = await fetchJSON(
      `https://store.steampowered.com/api/storesearch/?term=${encoded}&l=en&cc=US`
    );
    const items = (data.items || []);
    if (!items.length) return null;

    // Find best match by Levenshtein
    let best = null;
    let bestScore = Infinity;
    for (const item of items) {
      const score = levenshtein(gameName, item.name);
      if (score < bestScore) {
        bestScore = score;
        best = item;
      }
    }

    if (!best || bestScore > LEVENSHTEIN_THRESHOLD) {
      console.log(`  Steam: no close match for "${gameName}" (best: "${best?.name}", score: ${bestScore})`);
      return null;
    }

    console.log(`  Steam: matched "${gameName}" → "${best.name}" (score: ${bestScore}, appId: ${best.id})`);
    return `https://shared.steamstatic.com/store_item_assets/steam/apps/${best.id}/capsule_616x353.jpg`;
  } catch(e) {
    console.error(`  Steam search error for "${gameName}":`, e.message);
    return null;
  }
}

// ─────────────────────────────────────────────
// STEAMGRIDDB FALLBACK
// ─────────────────────────────────────────────
async function fetchSteamGridDBCover(gameName) {
  if (!STEAMGRIDDB_KEY) return null;
  try {
    const encoded = encodeURIComponent(gameName);
    // Search for game
    const searchData = await fetchJSON(
      `https://www.steamgriddb.com/api/v2/search/autocomplete/${encoded}`,
      { Authorization: `Bearer ${STEAMGRIDDB_KEY}` }
    );
    const games = searchData.data || [];
    if (!games.length) return null;

    // Find best match
    let best = null;
    let bestScore = Infinity;
    for (const g of games) {
      const score = levenshtein(gameName, g.name);
      if (score < bestScore) { bestScore = score; best = g; }
    }
    if (!best || bestScore > LEVENSHTEIN_THRESHOLD + 5) return null;

    // Fetch grid (cover) for this game
    const gridsData = await fetchJSON(
      `https://www.steamgriddb.com/api/v2/grids/game/${best.id}?dimensions=600x900`,
      { Authorization: `Bearer ${STEAMGRIDDB_KEY}` }
    );
    const grids = gridsData.data || [];
    if (!grids.length) return null;

    console.log(`  SteamGridDB: matched "${gameName}" → "${best.name}" (score: ${bestScore})`);
    return grids[0].url;
  } catch(e) {
    console.error(`  SteamGridDB error for "${gameName}":`, e.message);
    return null;
  }
}

// ─────────────────────────────────────────────
// RESOLVE COVER (Steam → SteamGridDB)
// ─────────────────────────────────────────────
async function resolveCover(gameName) {
  const steamCover = await fetchSteamCover(gameName);
  if (steamCover) return steamCover;
  const sgdbCover = await fetchSteamGridDBCover(gameName);
  return sgdbCover;
}

// ─────────────────────────────────────────────
// SLEEP HELPER (avoid rate limiting)
// ─────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─────────────────────────────────────────────
// LOAD EXISTING DATA
// ─────────────────────────────────────────────
function loadExistingData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
  } catch(e) {
    console.warn('Could not load existing data.json:', e.message);
  }
  return { sources: {} };
}

// ─────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────
async function main() {
  console.log('🎮 CrackUZU — Update script starting');
  console.log(`📅 ${new Date().toISOString()}`);

  const data = loadExistingData();

  let totalNew = 0;
  let totalUpdated = 0;

  for (const [sourceKey, sourceUrl] of Object.entries(SOURCES)) {
    console.log(`\n📦 Processing source: ${sourceKey}`);

    // Ensure source entry exists
    if (!data.sources[sourceKey]) {
      data.sources[sourceKey] = { lastChecked: null, games: [] };
    }

    const srcData = data.sources[sourceKey];
    const lastChecked = srcData.lastChecked ? new Date(srcData.lastChecked) : null;

    // Build lookup by name for existing games
    const existingByName = {};
    for (const g of srcData.games) {
      existingByName[g.name] = g;
    }

    // Fetch source
    let items;
    try {
      const raw = await fetchJSON(sourceUrl);
      items = raw.downloads || raw.games || raw || [];
      console.log(`  Fetched ${items.length} items`);
    } catch(e) {
      console.error(`  ❌ Failed to fetch ${sourceKey}:`, e.message);
      continue;
    }

    // Filter new items (uploadDate > lastChecked)
    const newItems = [];
    for (const item of items) {
      const parsed = parseItem(item);
      if (!parsed.name) continue;

      const itemDate = parsed.uploadDate ? new Date(parsed.uploadDate) : null;
      const isNew = !lastChecked || !itemDate || itemDate > lastChecked;

      if (isNew && !existingByName[parsed.name]) {
        newItems.push(parsed);
      }
    }

    console.log(`  ${newItems.length} new games to process`);

    // Resolve covers for new items
    for (let i = 0; i < newItems.length; i++) {
      const game = newItems[i];
      console.log(`  [${i+1}/${newItems.length}] Resolving cover: "${game.name}"`);
      game.cover = await resolveCover(game.name);
      if (!game.cover) console.log(`  ⚠️  No cover found for "${game.name}"`);
      // Throttle: 500ms between requests to avoid rate limiting
      if (i < newItems.length - 1) await sleep(500);
      totalNew++;
    }

    // Merge new games at front (most recent first)
    srcData.games = [
      ...newItems,
      ...srcData.games,
    ];

    // Cap at 500 games per source to keep data.json manageable
    if (srcData.games.length > 500) {
      srcData.games = srcData.games.slice(0, 500);
    }

    // Update lastChecked
    srcData.lastChecked = new Date().toISOString();
    console.log(`  ✅ Done. Total games in source: ${srcData.games.length}`);
  }

  // Write updated data.json
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  console.log(`\n✅ data.json updated — ${totalNew} new games added`);
  console.log(`📊 Total games across all sources: ${Object.values(data.sources).reduce((a,s) => a + s.games.length, 0)}`);
}

main().catch(e => {
  console.error('💥 Fatal error:', e);
  process.exit(1);
});
