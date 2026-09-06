// js/core/router.js
// CrackUZU — Routeur SPA & Transitions Morph

let _currentPage = '';
let _prevPage = 'accueil';
let _currentParam = null;
let _prevParam = null;
let _pageCleanup = null;  // fonction de nettoyage de la page courante
let _morphing = false;    // flag pour empêcher nav() de gérer l'opacité pendant un morph
let _gamesCache = null;   // cache des jeux pour préchargement

function nav(page, param) {
  if (page === _currentPage && !param) return;

  // Fermer la recherche si ouverte
  if (typeof closeSrch === 'function') closeSrch();

  const view = document.getElementById('spa-view');
  if (!_morphing && view) view.style.opacity = '0';

  setTimeout(() => {
    // Nettoyage de l'ancienne page (timers, intervals...)
    if (_pageCleanup) {
      _pageCleanup();
      _pageCleanup = null;
    }

    // Reset scroll
    window.scrollTo(0, 0);

    // Charger le template
    const tpl = document.getElementById('tpl-' + (page === 'jeu' ? 'jeu' : page));
    if (!tpl) {
      console.error('Template introuvable:', page);
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
    if (page === 'accueil' && typeof initAccueil === 'function') { initAccueil(); }
    if (page === 'catalogue' && typeof initCatalogue === 'function') { initCatalogue(); }
    if (page === 'jeu' && typeof initJeu === 'function') { initJeu(param); }
    if (page === 'admin' && typeof initAdmin === 'function') { initAdmin(); }
    if (page === 'demande' && typeof initDemande === 'function') { initDemande(); }

    if (!_morphing && view) view.style.opacity = '1';
  }, 120);
}

// ── TRANSITION MORPH ENTRE LA CARTE ET LA FICHE DU JEU ───────────────────────
function morphToJeu(el, gameId, imgSrc) {
  if (_currentPage === 'jeu') {
    nav('jeu', gameId);
    return;
  }

  const img = el.querySelector('img');
  if (!img && !imgSrc) {
    nav('jeu', gameId);
    return;
  }

  _morphing = true;

  const morphImgSrc = imgSrc || img.src;
  const morphImgRect = img ? img.getBoundingClientRect() : el.getBoundingClientRect();

  if (typeof closeSrch === 'function') closeSrch();

  // Précharger l'image hero depuis le cache
  if (!_gamesCache) {
    try {
      const d = localStorage.getItem('crackuzu_games');
      if (d) _gamesCache = JSON.parse(d);
    } catch (e) {}
  }
  let heroUrl = null;
  if (_gamesCache) {
    const game = _gamesCache.find(g => (g.id || g.title) == gameId);
    if (game) heroUrl = game.banner_url || game.portrait_url || null;
  }

  const rect = morphImgRect;
  const clone = document.createElement('div');
  clone.className = 'morph-clone';
  const br = (img && getComputedStyle(img).borderRadius) || '0.75rem';
  clone.style.cssText = `left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;border-radius:${br};`;

  const cloneImg = document.createElement('img');
  cloneImg.src = morphImgSrc;
  cloneImg.alt = '';
  cloneImg.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;transition:opacity .5s ease;-webkit-transition:opacity .5s ease;';
  clone.appendChild(cloneImg);
  document.body.appendChild(clone);

  void clone.offsetWidth;

  document.body.classList.add('morph-active');
  nav('jeu', gameId);

  const targetW = window.innerWidth;
  const targetH = window.innerHeight;

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      clone.classList.add('morphing');
      clone.style.left = '0';
      clone.style.top = '0';
      clone.style.width = targetW + 'px';
      clone.style.height = targetH + 'px';
      clone.style.borderRadius = '0';
    });
  });

  setTimeout(() => {
    const els = document.querySelectorAll('.genre,.jeu-hero-title,.jeu-hero-title-img,.meta,.synopsis,.info-item,.actions,.back-btn');
    els.forEach((el, i) => {
      setTimeout(() => el.classList.add('visible'), i * 35);
    });
  }, 400);

  const crossfadeHero = () => {
    const heroImg = document.getElementById('heroImg');
    if (heroImg && heroImg.src && heroImg.complete && heroImg.naturalWidth > 0) {
      clearInterval(checkImg);
      heroImg.style.visibility = 'hidden';
      cloneImg.style.opacity = '0';
      const heroCloneImg = document.createElement('img');
      heroCloneImg.src = heroImg.src;
      heroCloneImg.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;opacity:0;transition:opacity .5s ease;-webkit-transition:opacity .5s ease;position:absolute;top:0;left:0;';
      clone.appendChild(heroCloneImg);
      requestAnimationFrame(() => { heroCloneImg.style.opacity = '1'; });
    }
  };
  const checkImg = setInterval(crossfadeHero, 50);
  crossfadeHero();

  const onEnd = () => {
    clone.removeEventListener('transitionend', onEnd);
    clearTimeout(endTimer);
    clearInterval(checkImg);
    clone.remove();
    const heroImg = document.getElementById('heroImg');
    if (heroImg) heroImg.style.visibility = 'visible';
    document.body.classList.remove('morph-active');
    _morphing = false;
  };
  clone.addEventListener('transitionend', onEnd);
  const endTimer = setTimeout(onEnd, 900);
}
