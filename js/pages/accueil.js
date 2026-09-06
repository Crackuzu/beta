// js/pages/accueil.js
// CrackUZU — Logique de la page d'accueil

let ALL = [], hidx = 0, hsl = [], htmr = null;

// ── CHARGEMENT ──────────────────────────────────────────────────────────────
async function initAccueil() {
  clearInterval(htmr);
  htmr = null;
  hidx = 0;
  hsl = [];

  try {
    let games = [];
    const localData = localStorage.getItem('crackuzu_games');
    if (localData) {
      games = JSON.parse(localData);
    }

    if (!games || games.length === 0) {
      const r = await fetch('data.json?t=' + Date.now());
      if (!r.ok) throw new Error(r.status);
      games = await r.json();
    }

    proc(games);
  } catch (err) {
    console.error('Load error:', err);
    const titleEl = document.getElementById('htitle');
    if (titleEl) titleEl.textContent = 'Aucun jeu disponible';
    const rowEl = document.getElementById('rrow');
    if (rowEl) rowEl.innerHTML = '<div class="ldr"><span class="ltxt">data.json introuvable</span></div>';
  }
}

// ── NORMALISATION DES DONNÉES ───────────────────────────────────────────────
function proc(raw) {
  const arr = Array.isArray(raw) ? raw : (raw.games || []);
  ALL = arr.map((g, i) => ({
    _idx: i,
    id: g.id || g.title || String(i),
    name: g.title || g.name || 'Sans titre',
    year: g.year || '',
    categories: Array.isArray(g.categories) ? g.categories : [],
    description: g.description || '',
    portrait_url: g.portrait_url || g.coverPortrait || null,
    banner_url: g.banner_url || g.coverLandscape || null,
    title_img: g.title_img || null,
    magnets: Array.isArray(g.magnets) ? g.magnets : (Array.isArray(g.sources) ? g.sources : []),
    ytb_id: g.ytb_id || null,
    added_at: g.added_at || g.uploadDate || null,
    added_by: g.added_by || null,
  }));

  // Tri : plus récent en premier
  ALL.sort((a, b) => new Date(b.added_at || 0) - new Date(a.added_at || 0));

  buildHero();
  buildRecent();
  buildCatRows();
}

// ── IMAGES ──────────────────────────────────────────────────────────────────
function portraitImg(g) { return g.portrait_url || null; }
function landscapeImg(g) { return g.banner_url || g.portrait_url || null; }
function heroImg(g) { return g.banner_url || g.portrait_url || null; }
function steamImg(g) {
  const m = (g.portrait_url || g.banner_url || '').match(/steam\/apps\/(\d+)/);
  if (!m) return null;
  return `https://cdn.cloudflare.steamstatic.com/steam/apps/${m[1]}/library_600x900.jpg`;
}

// ── HERO CAROUSEL ───────────────────────────────────────────────────────────
function buildHero() {
  hsl = ALL.filter(g => heroImg(g)).slice(0, 6);
  if (!hsl.length) hsl = ALL.slice(0, 6);
  if (!hsl.length) return;

  const slidesEl = document.getElementById('hslides');
  if (slidesEl) {
    slidesEl.innerHTML = hsl.map((g, i) => `
      <div class="slide ${i === 0 ? 'active' : ''}" id="hs${i}">
        ${heroImg(g)
          ? `<img src="${heroImg(g)}" alt="${e(g.name)}" draggable="false" loading="${i === 0 ? 'eager' : 'lazy'}">`
          : `<div style="width:100%;height:100%;background:linear-gradient(135deg,#1a1a2e,#16213e,#0f3460)"></div>`}
      </div>`).join('');
  }

  const dotsEl = document.getElementById('hdots');
  if (dotsEl) {
    dotsEl.innerHTML = hsl.map((_, i) => `
      <button class="dot" onclick="gs(${i})"><div class="dot-bar ${i === 0 ? 'run' : ''}" id="db${i}"></div></button>`).join('');
  }

  setHI(0);
  if (hsl.length > 1) htmr = setInterval(() => gs((hidx + 1) % hsl.length), 8000);
}

function setHI(i) {
  const g = hsl[i];
  if (!g) return;
  const el = document.getElementById('htitle');
  if (!el) return;

  if (g.title_img) {
    el.innerHTML = `<img src="${g.title_img}" alt="${e(g.name)}" class="hero-title-img">`;
  } else {
    el.textContent = g.name;
  }

  const badgeEl = document.getElementById('hbsrc');
  if (badgeEl) badgeEl.textContent = g.categories?.[0] || g.year || '—';

  const ve = document.getElementById('hver');
  const sep = document.getElementById('hvsep');
  if (ve && sep) {
    if (g.year) { ve.textContent = g.year; sep.style.display = ''; }
    else { ve.textContent = ''; sep.style.display = 'none'; }
  }

  const hsz = document.getElementById('hsz');
  if (hsz) hsz.textContent = g.categories?.[0] || '';

  const hdt = document.getElementById('hdt');
  if (hdt) hdt.textContent = fd(g.added_at);

  const hmag = document.getElementById('hmag');
  if (hmag) {
    const firstMagnet = g.magnets?.[0];
    const url = typeof firstMagnet === 'object' && firstMagnet !== null ? (firstMagnet.url || firstMagnet.magnet || '#') : (firstMagnet || '#');
    hmag.href = url;
  }
}

function gs(i) {
  if (i === hidx) return;
  clearInterval(htmr);
  document.getElementById('hs' + hidx)?.classList.remove('active');
  const db = document.getElementById('db' + hidx);
  if (db) { db.classList.remove('run'); db.style.width = '0'; }

  hidx = i;
  document.getElementById('hs' + hidx)?.classList.add('active');
  const ndb = document.getElementById('db' + hidx);
  if (ndb) {
    ndb.style.width = '0';
    ndb.classList.remove('run');
    requestAnimationFrame(() => requestAnimationFrame(() => ndb.classList.add('run')));
  }
  setHI(hidx);
  if (hsl.length > 1) htmr = setInterval(() => gs((hidx + 1) % hsl.length), 8000);
}

// ── SECTION RÉCENTS ─────────────────────────────────────────────────────────
function buildRecent() {
  const g = ALL.slice(0, 24);
  const rcnt = document.getElementById('rcnt');
  if (rcnt) rcnt.textContent = g.length + ' jeux';
  const rrow = document.getElementById('rrow');
  if (rrow) rrow.innerHTML = g.map(wc).join('');
}

function wc(g) {
  const img = landscapeImg(g);
  return `<div class="wc" onclick="morphToJeu(this,'${e2(g.id)}','${e2(img || '')}')" style="cursor:pointer">
    <div class="wc-img">
      ${img
        ? `<img src="${img}" alt="${e(g.name)}" loading="lazy">`
        : `<div style="width:100%;height:100%;background:linear-gradient(135deg,#1a1a2e,#16213e,#0f3460);display:flex;align-items:center;justify-content:center;font-size:3rem">🎮</div>`}
      <div class="wc-grad"></div>
    </div>
    <div class="wc-body">
      <div class="wc-name">${e(g.name)}</div>
      <div class="wc-meta">
        ${g.year ? `<span>${e(g.year)}</span><span>·</span>` : ''}
        ${g.categories?.length ? g.categories.map(c => `<span class="wc-v">${e(c)}</span>`).join('') : ''}
        <span>${fd(g.added_at)}</span>
      </div>
    </div>
  </div>`;
}

// ── SECTIONS PAR CATÉGORIE ──────────────────────────────────────────────────
function buildCatRows() {
  const byCat = {};
  ALL.forEach(g => {
    const cats = g.categories?.length ? g.categories : ['Autre'];
    cats.forEach(k => {
      if (!byCat[k]) byCat[k] = [];
      byCat[k].push(g);
    });
  });

  const cats = Object.keys(byCat).sort();
  let h = '';
  cats.forEach(cat => {
    const gs = byCat[cat];
    const rid = 'row-' + cat.replace(/\s+/g, '-');
    const slice = gs.slice(0, 24);
    if (!slice.length) return;
    h += `<section class="section" style="padding-top:2.5rem">
      <div class="sw">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem">
          <h2 class="st">${e(cat)}</h2>
          <span style="font-size:11px;font-weight:700;color:rgba(255,255,255,.3);text-transform:uppercase;letter-spacing:.15em">${gs.length} jeux</span>
        </div>
        <div class="row-wrap">
          <button class="ra ra-l" onclick="sl('${rid}')"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg></button>
          <button class="ra ra-r" onclick="sr('${rid}')"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg></button>
          <div class="row-track" id="${rid}">${slice.map(pc).join('')}</div>
        </div>
      </div>
    </section>`;
  });
  const rowsEl = document.getElementById('srcrows');
  if (rowsEl) rowsEl.innerHTML = h || '';
}

function pc(g) {
  const img = portraitImg(g);
  const land = landscapeImg(g);
  return `<div class="pc" onclick="morphToJeu(this,'${e2(g.id)}','${e2(img || '')}')" style="cursor:pointer">
    <div class="pc-img">
      ${img ? `<img class="pc-port" src="${img}" alt="${e(g.name)}" loading="lazy">` : `<div class="pc-noimg">🎮</div>`}
      ${land ? `<div class="pc-land"><img src="${land}" alt="${e(g.name)}" loading="lazy"></div>` : ''}
      ${g.year ? `<span class="pc-badge">${e(g.year)}</span>` : ''}
      <div class="pc-ov"></div>
      <div class="pc-info">
        <div class="pc-name${g.title_img ? ' has-title-img' : ''}">${e(g.name)}</div>
        <div class="pc-size">${e(g.categories?.[0] || g.year || '')}</div>
      </div>
    </div>
    ${g.title_img ? `<img class="pc-title-img" src="${g.title_img}" alt="${e(g.name)}">` : ''}
  </div>`;
}

// ── NAVIGATION & SCROLL ──────────────────────────────────────────────────────
function goNew(ev) {
  if (ev) ev.preventDefault();
  setTimeout(() => document.getElementById('rrow')?.closest('.section')?.scrollIntoView({ behavior: 'smooth' }), 100);
  sn('nR');
}

function sn(id) {
  document.querySelectorAll('.nav-a').forEach(el => el.classList.remove('active'));
  document.getElementById(id)?.classList.add('active');
}

function sl(id) { document.getElementById(id)?.scrollBy({ left: -800, behavior: 'smooth' }); }
function sr(id) { document.getElementById(id)?.scrollBy({ left: 800, behavior: 'smooth' }); }

function openHeroDownload(ev) {
  ev.preventDefault();
  const g = hsl[hidx];
  if (!g) return;
  const activeSlide = document.querySelector('.slide.active');
  if (activeSlide) morphToJeu(activeSlide, g.id);
  else nav('jeu', g.id);
}
