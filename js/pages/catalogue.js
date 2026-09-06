// js/pages/catalogue.js
// CrackUZU — Logique du catalogue

const PPG = 60;
let CAT_ALL = [], FIL = [], pg = 1, aGenre = 'all', aSort = 'new', _cur = null;

async function initCatalogue() {
  try {
    const localData = localStorage.getItem('crackuzu_games');
    if (localData) {
      const games = JSON.parse(localData);
      catProc(games);
      return;
    }

    const r = await fetch('data.json?t=' + Date.now());
    if (!r.ok) throw new Error(r.status);
    catProc(await r.json());
  } catch (err) {
    console.error('Erreur chargement catalogue:', err);
    const gridEl = document.getElementById('grid');
    if (gridEl) {
      gridEl.innerHTML = `
        <div class="empty">
          <div class="empty-ico">😶</div>
          <div class="empty-ttl">data.json introuvable</div>
          <div class="empty-sub">Vérifie que le fichier est bien à la racine du repo.</div>
        </div>`;
    }
  }
}

function catProc(raw) {
  const arr = Array.isArray(raw) ? raw : (raw.games || []);
  CAT_ALL = arr.map((g, i) => ({
    _idx: i,
    id: g.id || g.title || String(i),
    name: g.title || g.name || 'Sans titre',
    year: g.year || '',
    categories: Array.isArray(g.categories) ? g.categories : [],
    description: g.description || '',
    portrait_url: g.portrait_url || g.coverPortrait || null,
    banner_url: g.banner_url || g.coverLandscape || null,
    magnets: Array.isArray(g.magnets) ? g.magnets : (Array.isArray(g.sources) ? g.sources : []),
    ytb_id: g.ytb_id || null,
    added_at: g.added_at || g.uploadDate || null,
  }));
  buildGenres();
  applyFilters();
}

function pImg(g) { return g.portrait_url || null; }
function bImg(g) { return g.banner_url || g.portrait_url || null; }

/* ── GENRES & FILTRES ──────────────────────────────────────────────────────── */
function buildGenres() {
  const cats = new Set();
  CAT_ALL.forEach(g => {
    if (g.categories?.length) {
      g.categories.forEach(c => cats.add(c));
    }
  });
  let h = `<button class="filter-cat-btn active" id="fc_all" onclick="selectCatFromDropdown('all')">Tous</button>`;
  cats.forEach(k => {
    h += `<button class="filter-cat-btn" id="fc_${sid(k)}" onclick="selectCatFromDropdown('${e(k)}')">${e(k)}</button>`;
  });
  const filterCatsEl = document.getElementById('filterCats');
  if (filterCatsEl) filterCatsEl.innerHTML = h;
}

function setGenre(g) {
  aGenre = g;
  document.querySelectorAll('.filter-cat-btn').forEach(b => b.classList.remove('active'));
  if (g === 'all') {
    document.getElementById('fc_all')?.classList.add('active');
  } else {
    document.getElementById('fc_' + sid(g))?.classList.add('active');
  }
  pg = 1;
  applyFilters();
}

function toggleFilterDropdown() {
  document.getElementById('filterDropdown')?.classList.toggle('open');
}

function closeFilterDropdown() {
  document.getElementById('filterDropdown')?.classList.remove('open');
}

function clearCategoryFilter() {
  selectCatFromDropdown('all');
}

function selectCatFromDropdown(cat) {
  aGenre = cat;
  document.querySelectorAll('.filter-cat-btn').forEach(b => b.classList.remove('active'));
  if (cat === 'all') {
    document.getElementById('fc_all')?.classList.add('active');
  } else {
    document.getElementById('fc_' + sid(cat))?.classList.add('active');
  }
  pg = 1;
  applyFilters();
}

function setSort(s) {
  aSort = s;
  document.querySelectorAll('.stab').forEach(b => b.classList.remove('on'));
  document.getElementById('sort-' + s)?.classList.add('on');
  pg = 1;
  applyFilters();
}

// ── RECHERCHE & FILTRAGE AVEC MOTEUR FLOU ───────────────────────────────────
function applyFilters() {
  const q = (document.getElementById('cq')?.value || '').trim();

  // 1. Filtrer par genre
  let pool = CAT_ALL;
  if (aGenre !== 'all') {
    pool = pool.filter(g => g.categories?.includes(aGenre));
  }

  // 2. Recherche textuelle (Fuzzy search si requête présente)
  if (q) {
    FIL = SearchEngine.search(pool, q, 1000);
  } else {
    FIL = [...pool];
    // Tri seulement si pas de recherche active (la recherche trie par pertinence)
    if (aSort === 'new') {
      FIL.sort((a, b) => new Date(b.added_at || 0) - new Date(a.added_at || 0));
    } else {
      FIL.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    }
  }

  pg = 1;
  renderGrid();
  renderPag();

  const countEl = document.getElementById('res-count');
  if (countEl) countEl.textContent = FIL.length + ' jeu' + (FIL.length > 1 ? 'x' : '');
}

// ── GRILLE & CARTES ─────────────────────────────────────────────────────────
function renderGrid() {
  const slice = FIL.slice((pg - 1) * PPG, pg * PPG);
  const gr = document.getElementById('grid');
  if (!gr) return;

  if (!slice.length) {
    gr.innerHTML = `
      <div class="empty">
        <div class="empty-ico">🎮</div>
        <div class="empty-ttl">Aucun jeu trouvé</div>
        <div class="empty-sub">Essaie un autre genre ou vérifie l'orthographe.</div>
      </div>`;
    return;
  }

  gr.innerHTML = slice.map((g, i) => catCard(g, i < 12 ? i : -1)).join('');
}

function catCard(g, i = 0) {
  const img = pImg(g);
  const sImg = steamImg(g);
  const animStyle = i >= 0 ? `animation-delay:${i * 0.05}s` : 'opacity:1;transform:none';
  const m = (g.portrait_url || g.banner_url || '').match(/steam\/apps\/(\d+)/);
  const sid = m ? m[1] : null;
  const hImg = sid ? `https://cdn.cloudflare.steamstatic.com/steam/apps/${sid}/header.jpg` : '';
  const onerr = sImg ? ` onerror="this.onerror=null;this.src='${hImg}'"` : '';

  return `<div class="card" onclick="morphToJeu(this,'${e2(g.id)}','${e2(img || sImg || '')}')" style="cursor:pointer;${animStyle}">
    <div class="card-img">
      ${img
        ? `<img src="${e(img)}" alt="${e(g.name)}" loading="lazy">`
        : (sImg ? `<img src="${sImg}" alt="${e(g.name)}" loading="lazy"${onerr}>` : `<div class="card-noimg">🎮</div>`)}
      ${g.year ? `<div class="card-yr">${e(g.year)}</div>` : ''}
      ${g.categories?.length ? `<div class="card-cat">${e(g.categories[0])}${g.categories.length > 1 ? '+' : ''}</div>` : ''}
    </div>
  </div>`;
}

// ── PAGINATION ──────────────────────────────────────────────────────────────
function renderPag() {
  const t = Math.ceil(FIL.length / PPG);
  const el = document.getElementById('pag');
  if (!el) return;
  if (t <= 1) { el.innerHTML = ''; return; }

  let h = `<button class="pb ${pg === 1 ? 'off' : ''}" onclick="gp(${pg - 1})"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg></button>`;
  pr(pg, t).forEach(p => {
    p === '…'
      ? h += `<span class="pb" style="cursor:default;opacity:.3">…</span>`
      : h += `<button class="pb ${p === pg ? 'cur' : ''}" onclick="gp(${p})">${p}</button>`;
  });
  h += `<button class="pb ${pg === t ? 'off' : ''}" onclick="gp(${pg + 1})"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg></button>`;
  el.innerHTML = h;
}

function pr(c, t) {
  if (t <= 7) return Array.from({ length: t }, (_, i) => i + 1);
  const r = [];
  if (c > 3) { r.push(1); if (c > 4) r.push('…'); }
  for (let i = Math.max(1, c - 2); i <= Math.min(t, c + 2); i++) r.push(i);
  if (c < t - 2) { if (c < t - 3) r.push('…'); r.push(t); }
  return r;
}

function gp(p) {
  const t = Math.ceil(FIL.length / PPG);
  if (p < 1 || p > t) return;
  pg = p;
  renderGrid();
  renderPag();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── MODAL RAPIDE DU CATALOGUE ───────────────────────────────────────────────
function openMod(id) {
  const g = CAT_ALL.find(g => g.id === id);
  if (!g) return;
  _cur = g;
  document.getElementById('m-title').textContent = g.name;

  let pills = '';
  if (g.year) pills += `<span class="mp-yr">${e(g.year)}</span>`;
  if (g.categories?.length) pills += g.categories.map(c => `<span class="mp-cat">${e(c)}</span>`).join('');
  if (g.added_at) pills += `<span class="m-sep">·</span><span class="mp-date">Ajouté ${fd(g.added_at)}</span>`;
  document.getElementById('m-pills').innerHTML = pills;
  document.getElementById('m-desc').textContent = g.description || 'Aucune description disponible.';

  const mi = document.getElementById('m-img');
  const mn = document.getElementById('m-noimg');
  const mt = document.getElementById('m-trailer');
  const mb = document.getElementById('m-ytbtn');

  if (mt) { mt.innerHTML = ''; mt.style.display = 'none'; }
  if (bImg(g)) {
    if (mi) { mi.src = bImg(g); mi.style.display = 'block'; }
    if (mn) mn.style.display = 'none';
  } else {
    if (mi) mi.style.display = 'none';
    if (mn) mn.style.display = 'flex';
  }
  if (mb) mb.style.display = g.ytb_id ? 'flex' : 'none';

  let acts = '';
  if (g.ytb_id) {
    acts += `<button class="btn-w" onclick="openTrailer()"><svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z"/></svg>Voir le trailer</button>`;
  } else {
    acts += `<span class="btn-g" style="opacity:.3;cursor:default;pointer-events:none"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m10 15 5-3-5-3z"/></svg>Pas de trailer</span>`;
  }
  if (g.magnets.length) {
    acts += `<button class="btn-p" onclick="document.getElementById('m-mag-sec')?.scrollIntoView({behavior:'smooth',block:'nearest'})"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="22"/></svg>Télécharger</button>`;
  }
  document.getElementById('m-actions').innerHTML = acts;

  const ms = document.getElementById('m-mag-sec');
  const ml = document.getElementById('m-mag-list');
  if (ms) ms.style.display = 'block';
  if (ml) {
    if (g.magnets.length) {
      ml.innerHTML = g.magnets.map((m, i) => {
        const url = typeof m === 'object' && m !== null ? (m.url || m.magnet || '#') : m;
        return `
          <a class="m-mag-item" href="${e(url)}">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="22"/></svg>
            ${g.magnets.length > 1 ? 'Source ' + (i + 1) + ' — ' : ''}Télécharger via Crackuzu
          </a>`;
      }).join('');
    } else {
      ml.innerHTML = '<div class="m-mag-empty">Aucun lien de téléchargement disponible.</div>';
    }
  }

  document.getElementById('mov')?.classList.add('open');
  document.body.style.overflow = 'hidden';
  const modalBox = document.getElementById('modal-box');
  if (modalBox) modalBox.scrollTop = 0;
}

function openTrailer() {
  if (!_cur?.ytb_id) return;
  const mi = document.getElementById('m-img');
  const mb = document.getElementById('m-ytbtn');
  const mt = document.getElementById('m-trailer');
  if (mi) mi.style.display = 'none';
  if (mb) mb.style.display = 'none';
  if (mt) {
    mt.style.display = 'block';
    mt.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${_cur.ytb_id}?autoplay=1&rel=0&modestbranding=1" allow="autoplay;encrypted-media" allowfullscreen></iframe>`;
  }
}

function closeMod() {
  const mov = document.getElementById('mov');
  if (mov) mov.classList.remove('open');
  document.body.style.overflow = '';
  const mt = document.getElementById('m-trailer');
  if (mt) {
    mt.innerHTML = '';
    mt.style.display = 'none';
  }
  _cur = null;
}

function movck(ev) {
  if (ev.target === document.getElementById('mov')) closeMod();
}

function dlQbit() {
  const a = document.createElement('a');
  a.href = 'https://sourceforge.net/projects/qbittorrent/files/latest/download';
  a.target = '_blank';
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}
