// js/core/router.js
// CrackUZU — Routeur SPA avec liens partageables par jeu

let _currentPage = '';
let _prevPage = 'accueil';
let _currentParam = null;
let _prevParam = null;
let _pageCleanup = null;  // fonction de nettoyage de la page courante

// ── GESTION DU HASH (liens partageables) ─────────────────────────────────────
// Format : #jeu/GAME_ID  |  #catalogue  |  #demande  |  #accueil (défaut)

function _updateHash(page, param) {
  if (page === 'jeu' && param) {
    history.replaceState(null, '', '#jeu/' + encodeURIComponent(param));
  } else if (page === 'accueil') {
    history.replaceState(null, '', window.location.pathname + window.location.search);
  } else {
    history.replaceState(null, '', '#' + page);
  }
}

function _readHash() {
  const hash = window.location.hash.slice(1); // retire le '#'
  if (!hash) return { page: 'accueil', param: null };
  if (hash.startsWith('jeu/')) {
    const id = decodeURIComponent(hash.slice(4));
    return { page: 'jeu', param: id };
  }
  const known = ['accueil', 'catalogue', 'demande', 'admin'];
  if (known.includes(hash)) return { page: hash, param: null };
  return { page: 'accueil', param: null };
}

// ── ROUTEUR PRINCIPAL ─────────────────────────────────────────────────────────
function nav(page, param) {
  if (page === _currentPage && param === _currentParam && !param) return;

  // Fermer la recherche si ouverte
  if (typeof closeSrch === 'function') closeSrch();

  const view = document.getElementById('spa-view');
  if (view) view.style.opacity = '0';

  setTimeout(() => {
    // Nettoyage de l'ancienne page (timers, intervals...)
    if (_pageCleanup) {
      _pageCleanup();
      _pageCleanup = null;
    }

    // Reset scroll
    window.scrollTo(0, 0);

    // Charger le template
    const tplId = 'tpl-' + (page === 'jeu' ? 'jeu' : page);
    const tpl = document.getElementById(tplId);
    if (!tpl) {
      console.error('Template introuvable:', tplId);
      return;
    }
    if (view) {
      view.innerHTML = '';
      view.appendChild(tpl.content.cloneNode(true));
    }

    _prevPage = _currentPage;
    _prevParam = _currentParam;
    _currentPage = page;
    _currentParam = param || null;

    // Mettre à jour l'URL (hash partageable)
    _updateHash(page, param);

    // Mettre à jour le lien actif dans le header
    document.querySelectorAll('.nav-a').forEach(el => el.classList.remove('active'));
    const activeNav = document.getElementById('nav-' + page);
    if (activeNav) activeNav.classList.add('active');

    document.querySelectorAll('.mob-nav-a').forEach(el => el.classList.remove('active'));
    const activeMobNav = document.getElementById('mnav-' + page);
    if (activeMobNav) activeMobNav.classList.add('active');

    // Cacher/montrer footer sur admin
    const footer = document.getElementById('site-footer');
    if (footer) footer.style.display = page === 'admin' ? 'none' : '';

    // Lancer l'init de la page
    if (page !== 'jeu') document.title = 'CRACKUZU';
    if (page === 'accueil'  && typeof initAccueil  === 'function') { initAccueil(); }
    if (page === 'catalogue' && typeof initCatalogue === 'function') { initCatalogue(); }
    if (page === 'jeu'      && typeof initJeu       === 'function') { initJeu(param); }
    if (page === 'admin'    && typeof initAdmin     === 'function') { initAdmin(); }
    if (page === 'demande'  && typeof initDemande   === 'function') { initDemande(); }

    if (view) view.style.opacity = '1';
  }, 120);
}

// ── NAVIGATION & PRÉCHARGEMENT VERS UN JEU ──────────────────────────────────
const _preloadedImages = new Set();
function preloadGameImg(url) {
  if (!url || _preloadedImages.has(url)) return;
  _preloadedImages.add(url);
  const img = new Image();
  img.src = url;
}

// Préchargement au survol des cartes
document.addEventListener('mouseover', (e) => {
  const card = e.target.closest('.pc, .wc, .card');
  if (!card) return;
  const onclickStr = card.getAttribute('onclick') || '';
  const match = onclickStr.match(/morphToJeu\(this,\s*'([^']+)'(?:,\s*'([^']+)')?/);
  if (match) {
    const gameId = match[1];
    const imgSrc = match[2];
    if (imgSrc) preloadGameImg(imgSrc);
    // Précharger aussi depuis la liste de jeux en mémoire
    const pool = (typeof ALL !== 'undefined' && ALL.length) ? ALL : ((typeof CAT_ALL !== 'undefined' && CAT_ALL.length) ? CAT_ALL : []);
    const g = pool.find(item => (item.id || item.title) == gameId);
    if (g) {
      if (g.banner_url) preloadGameImg(g.banner_url);
      if (g.portrait_url) preloadGameImg(g.portrait_url);
      if (g.title_img) preloadGameImg(g.title_img);
    }
  }
}, { passive: true });

function morphToJeu(el, gameId, imgSrc) {
  if (imgSrc) preloadGameImg(imgSrc);
  nav('jeu', gameId);
}

// ── BOUTON « COPIER LE LIEN » sur la fiche jeu ────────────────────────────────
function _expandShareBtn() {
  const btn = document.getElementById('shareBtn');
  const label = document.getElementById('shareBtnLabel');
  if (!btn || !label) return;

  label.textContent = 'Lien copie !';
  btn.classList.add('copied');

  clearTimeout(btn._shareTimer);
  btn._shareTimer = setTimeout(() => {
    btn.classList.remove('copied');
  }, 3000);
}

function copyJeuLink() {
  const base = window.location.origin + window.location.pathname;
  const url  = base + '#jeu/' + encodeURIComponent(_currentParam || '');

  // Fallback textarea silencieux
  function fallback() {
    try {
      const ta = document.createElement('textarea');
      ta.value = url;
      ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      _expandShareBtn();
    } catch(e) { console.warn('copy failed', e); }
  }

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(() => {
      _expandShareBtn();
    }).catch(fallback);
  } else {
    fallback();
  }
}
