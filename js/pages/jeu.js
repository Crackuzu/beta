// js/pages/jeu.js
// CrackUZU — Fiche détaillée du jeu

function getGameId() {
  return window._spaGameId || null;
}

async function loadGame() {
  const gameId = getGameId();

  try {
    let games = [];
    const localData = localStorage.getItem('crackuzu_games');
    if (localData) {
      games = JSON.parse(localData);
    } else {
      const res = await fetch('data.json?t=' + Date.now());
      if (!res.ok) throw new Error('Failed to load');
      games = await res.json();
    }

    let game;
    if (gameId) {
      game = games.find(g => (g.id && g.id === gameId) || (g.title && g.title === gameId));
    } else {
      game = games[0];
    }

    if (!game) {
      showNotFound();
      return;
    }

    renderGame(game);
  } catch (e) {
    console.error('Erreur chargement jeu:', e);
    const loadingEl = document.getElementById('loading');
    if (loadingEl) loadingEl.style.display = 'none';
    const heroEl = document.getElementById('hero');
    if (heroEl) heroEl.style.display = 'none';
    const viewEl = document.getElementById('spa-view');
    if (viewEl) {
      viewEl.innerHTML = '<div class="error" style="padding:4rem 2rem;text-align:center"><h2>Erreur de chargement</h2><p>Impossible de charger les données du jeu.</p></div>';
    }
  }
}

function renderGame(game) {
  document.getElementById('loading')?.style.setProperty('display', 'none');
  const content = document.getElementById('content');
  if (content) content.style.display = 'block';
  const actions = document.getElementById('actions');
  if (actions) actions.style.display = 'flex';
  const infoGrid = document.getElementById('infoGrid');
  if (infoGrid) infoGrid.style.display = 'grid';
  window.scrollTo({ top: 0, behavior: 'instant' });

  // Titre & Logo
  const titleEl = document.getElementById('gameTitle');
  const titleImgEl = document.getElementById('gameTitleImg');
  if (game.title_img) {
    if (titleEl) titleEl.style.display = 'none';
    if (titleImgEl) {
      titleImgEl.src = game.title_img;
      titleImgEl.alt = game.title || game.name || '';
      titleImgEl.style.display = '';
      titleImgEl.style.maxWidth = '600px';
      titleImgEl.style.maxHeight = '400px';
      titleImgEl.style.objectFit = 'contain';
      titleImgEl.style.objectPosition = 'left center';
      titleImgEl.onload = function() {
        const ratio = this.naturalWidth / this.naturalHeight;
        if (ratio < 0.8) this.style.maxHeight = '480px';
        else if (ratio > 1.5) this.style.maxHeight = '300px';
        else this.style.maxHeight = '400px';
      };
    }
  } else {
    if (titleEl) {
      titleEl.textContent = game.title || game.name || '';
      titleEl.style.display = '';
    }
    if (titleImgEl) titleImgEl.style.display = 'none';
  }
  document.title = `CRACKUZU – ${game.title || game.name}`;

  // Image d'arrière-plan
  const heroImg = document.getElementById('heroImg');
  if (heroImg) {
    if (game.banner_url) {
      heroImg.src = game.banner_url;
      heroImg.alt = game.title || game.name || '';
      heroImg.style.display = '';
    } else if (game.portrait_url) {
      heroImg.src = game.portrait_url;
      heroImg.alt = game.title || game.name || '';
      heroImg.style.display = '';
    } else {
      const heroBg = document.getElementById('heroBg');
      if (heroBg) heroBg.style.background = 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)';
      heroImg.style.display = 'none';
    }
  }

  // Genres
  const genresContainer = document.getElementById('genres');
  if (genresContainer && game.categories && Array.isArray(game.categories)) {
    genresContainer.innerHTML = game.categories.map(c =>
      `<span class="genre">${esc(c)}</span>`
    ).join('');
  }

  // Métadonnées
  if (game.year) {
    const yVal = document.getElementById('yearValue');
    if (yVal) yVal.textContent = game.year;
    const yItem = document.getElementById('yearItem');
    if (yItem) yItem.style.display = 'flex';
  }
  if (game.categories?.length) {
    const catVal = document.getElementById('catValue');
    if (catVal) catVal.textContent = game.categories.join(', ');
    const catItem = document.getElementById('catItem');
    if (catItem) catItem.style.display = 'flex';
    const typeVal = document.getElementById('typeValue');
    if (typeVal) typeVal.textContent = game.categories[0];
  }
  if (game.rating) {
    const rVal = document.getElementById('ratingValue');
    if (rVal) rVal.textContent = game.rating;
    const rEl = document.getElementById('rating');
    if (rEl) rEl.style.display = 'flex';
  }

  // Description
  const descEl = document.getElementById('descText');
  if (descEl) descEl.textContent = game.description || 'Aucune description disponible pour ce jeu.';

  // Magnets & Sources
  const magnets = game.magnets || game.sources || [];
  window.currentMagnets = magnets;

  const downloadBtn = document.getElementById('downloadBtn');
  if (downloadBtn) {
    if (magnets.length > 0) {
      downloadBtn.style.display = 'flex';
      downloadBtn.onclick = () => openDownloadMenu(game);

      const firstSource = magnets[0];
      const isObject = typeof firstSource === 'object' && firstSource !== null;
      const sourceName = isObject ? (firstSource.source || firstSource.name || 'Source') : 'Torrent';
      const srcVal = document.getElementById('sourceValue');
      if (srcVal) srcVal.textContent = sourceName.length > 15 ? sourceName.substring(0, 15) + '...' : sourceName;

      const size = isObject ? (firstSource.size || '-') : '-';
      const sizeVal = document.getElementById('sizeValue');
      if (sizeVal) sizeVal.textContent = size;

      const label1 = document.getElementById('label1');
      if (label1) {
        const url = isObject ? (firstSource.url || firstSource.magnet || '') : firstSource;
        if (url.startsWith('magnet')) label1.textContent = 'Magnet';
        else if (isObject && firstSource.type === 'torrent') label1.textContent = 'Torrent';
        else label1.textContent = 'Source';
      }
    } else {
      downloadBtn.style.display = 'none';
    }
  }

  // Bouton Bande-annonce
  const trailerBtn = document.getElementById('trailerBtn');
  if (trailerBtn) {
    if (game.ytb_id) {
      trailerBtn.style.display = 'flex';
      trailerBtn.onclick = () => openJeuTrailer(game.ytb_id);
      window.currentYtbId = game.ytb_id;
    } else {
      trailerBtn.style.display = 'none';
    }
  }
}

function openDownloadMenu(game) {
  const overlay = document.getElementById('downloadModal');
  const box = document.getElementById('downloadBox');
  const list = document.getElementById('downloadList');
  if (!overlay || !box || !list) return;

  const sources = game.magnets || game.sources || [];

  if (sources.length === 0) {
    list.innerHTML = '<div style="padding:2rem;text-align:center;color:#94a3b8">Aucune source de téléchargement disponible</div>';
  } else {
    list.innerHTML = sources.map((source, i) => {
      const isObject = typeof source === 'object' && source !== null;
      const url = isObject ? (source.url || source.magnet || '') : source;
      const size = isObject ? (source.size || '') : '';
      const sourceName = isObject ? (source.source || 'Source') : 'Magnet';
      const displayName = isObject ? (source.name || '') : '';

      let extractedName = '';
      if (url.startsWith('magnet:')) {
        const nameMatch = url.match(/dn=([^&]+)/);
        if (nameMatch) {
          try {
            extractedName = decodeURIComponent(nameMatch[1].replace(/\+/g, ' ')).replace(/\.torrent$/i, '');
          } catch(e) {}
        }
      }

      const finalName = displayName || extractedName || `Source ${i + 1}`;

      let sourceType = sourceName;
      if (sourceType === 'Source' || sourceType === 'Custom') {
        if (finalName.includes('FitGirl')) sourceType = 'FitGirl Repack';
        else if (finalName.includes('DODI')) sourceType = 'DODI Repack';
        else if (finalName.includes('OnlineFix')) sourceType = 'OnlineFix';
        else if (finalName.includes('SteamRIP')) sourceType = 'SteamRIP';
        else sourceType = 'Source de téléchargement';
      }

      const iconSvg = url.startsWith('magnet')
        ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>'
        : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/></svg>';

      return `
        <div style="background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:1rem;padding:1.25rem;margin-bottom:1rem;transition:all .2s" onmouseover="this.style.borderColor='rgba(249,115,22,.5)';this.style.background='rgba(249,115,22,.05)'" onmouseout="this.style.borderColor='rgba(255,255,255,.1)';this.style.background='rgba(255,255,255,.05)'">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:.75rem">
            <div style="flex:1;min-width:0;padding-right:.5rem">
              <div style="font-weight:700;color:#fff;font-size:1rem;word-break:break-word;line-height:1.3">${esc(finalName)}</div>
              <div style="font-size:.85rem;color:#94a3b8;margin-top:.25rem">${esc(sourceType)}</div>
              ${size ? `<div style="font-size:.8rem;color:#64748b;margin-top:.5rem"><span style="color:#f97316">📦 Taille:</span> ${esc(size)}</div>` : ''}
            </div>
            ${size ? `<div style="background:rgba(249,115,22,.2);color:#f97316;padding:.35rem .75rem;border-radius:.5rem;font-size:.75rem;font-weight:600;flex-shrink:0">${esc(size)}</div>` : ''}
          </div>
          <button onclick="window.open('${esc(url)}', '_blank')" style="width:100%;padding:.875rem;background:linear-gradient(135deg,#f97316 0%,#ea580c 100%);color:#fff;border:none;border-radius:.75rem;font-weight:600;cursor:pointer;transition:all .2s;display:flex;align-items:center;justify-content:center;gap:.5rem;box-shadow:0 10px 20px rgba(249,115,22,.3)" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform=''">
            ${iconSvg}
            Télécharger
          </button>
        </div>
      `;
    }).join('');
  }

  overlay.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  overlay.offsetHeight;
  overlay.style.opacity = '1';
  box.style.transform = 'scale(1)';
  box.style.opacity = '1';
}

function closeDownloadMenu(e) {
  if (e && e.target !== e.currentTarget) return;
  const overlay = document.getElementById('downloadModal');
  const box = document.getElementById('downloadBox');
  if (!overlay || !box) return;

  overlay.style.opacity = '0';
  box.style.transform = 'scale(.9)';
  box.style.opacity = '0';

  setTimeout(() => {
    overlay.style.display = 'none';
    document.body.style.overflow = '';
  }, 300);
}

function openJeuTrailer(ytbId) {
  if (!ytbId) return;
  const overlay = document.getElementById('trailerOverlay');
  const box = document.getElementById('trailerBox');
  const frame = document.getElementById('trailerFrame');
  if (!overlay || !box || !frame) return;

  overlay.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  overlay.offsetHeight;
  overlay.style.opacity = '1';
  box.style.transform = 'scale(1)';
  box.style.opacity = '1';
  frame.src = `https://www.youtube-nocookie.com/embed/${ytbId}?autoplay=1&rel=0&modestbranding=1`;
}

function closeJeuTrailer(e) {
  if (e && e.target !== e.currentTarget && e.target.tagName !== 'BUTTON') return;
  const overlay = document.getElementById('trailerOverlay');
  const box = document.getElementById('trailerBox');
  const frame = document.getElementById('trailerFrame');
  if (!overlay || !box || !frame) return;

  frame.src = 'about:blank';
  overlay.style.opacity = '0';
  box.style.transform = 'scale(.8)';
  box.style.opacity = '0';

  setTimeout(() => {
    overlay.style.display = 'none';
    frame.src = '';
    document.body.style.overflow = '';
  }, 400);
}

function showNotFound() {
  document.getElementById('loading')?.style.setProperty('display', 'none');
  document.getElementById('hero')?.style.setProperty('display', 'none');
  const nf = document.getElementById('notFound');
  if (nf) nf.style.display = 'flex';
}

function initJeu(gameId) {
  window._spaGameId = gameId;
  window.scrollTo({ top: 0, behavior: 'instant' });
  loadGame();

  if (!_morphing) {
    setTimeout(() => {
      document.querySelectorAll('.genre,.jeu-hero-title,.jeu-hero-title-img,.meta,.synopsis,.info-item,.actions,.back-btn').forEach(el => {
        el.classList.add('visible');
      });
    }, 300);
  }
}
