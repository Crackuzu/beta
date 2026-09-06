// js/pages/demande.js
// CrackUZU — Page de demandes de jeux

let _reqSelected = null;
let _reqTimer = null;
let _reqSearchId = 0;

function initDemande() {
  _reqSelected = null;
  const s = document.getElementById('reqSearch');
  if (s) { s.value = ''; s.focus(); }
  const r = document.getElementById('reqResults');
  if (r) { r.innerHTML = ''; r.classList.remove('open'); }
  const p = document.getElementById('reqPreview');
  if (p) p.classList.remove('show');
  const btn = document.getElementById('reqSubmit');
  if (btn) { btn.disabled = true; btn.classList.remove('sending'); btn.textContent = 'Envoyer la demande'; }
  document.getElementById('reqForm')?.classList.remove('hide');
  document.getElementById('reqSuccess')?.classList.remove('show');

  reqLoadStats();
}

async function reqLoadStats() {
  try {
    let games = [];
    const localData = localStorage.getItem('crackuzu_games');
    if (localData) {
      games = JSON.parse(localData);
    } else {
      const r = await fetch('data.json?t=' + Date.now());
      if (r.ok) games = await r.json();
    }

    const elGames = document.getElementById('reqStatGames');
    if (elGames) animateCount(elGames, Array.isArray(games) ? games.length : (games.games?.length || 0));

    try {
      const rr = await fetch(`${CONFIG.WORKER_URL}/api/github-requests`);
      if (rr.ok) {
        const reqs = await rr.json();
        const elPending = document.getElementById('reqStatPending');
        if (elPending) animateCount(elPending, Array.isArray(reqs) ? reqs.length : 0);
      }
    } catch (e) {}

    const elAdded = document.getElementById('reqStatAdded');
    if (elAdded) animateCount(elAdded, Math.max(0, Array.isArray(games) ? games.length : 0));
  } catch (e) {
    console.error('reqLoadStats error:', e);
  }
}

function animateCount(el, target) {
  let current = 0;
  const step = Math.max(1, Math.ceil(target / 20));
  const interval = setInterval(() => {
    current += step;
    if (current >= target) { current = target; clearInterval(interval); }
    el.textContent = current;
  }, 30);
}

function showReqPopup(type, icon, title, sub, actionHtml) {
  const popup = document.getElementById('reqPopup');
  const box = document.getElementById('reqPopupBox');
  if (!popup || !box) return;
  box.className = 'req-popup-box ' + type;
  const iconEl = document.getElementById('reqPopupIcon');
  if (iconEl) iconEl.textContent = icon;
  const ttlEl = document.getElementById('reqPopupTitle');
  if (ttlEl) ttlEl.textContent = title;
  const subEl = document.getElementById('reqPopupSub');
  if (subEl) subEl.textContent = sub;
  const actEl = document.getElementById('reqPopupAction');
  if (actEl) actEl.innerHTML = actionHtml || '';

  const pc = document.getElementById('reqPopupParticles');
  if (pc) {
    pc.innerHTML = '';
    for (let i = 0; i < 8; i++) {
      const p = document.createElement('div');
      p.className = 'req-popup-particle';
      p.style.left = (10 + Math.random() * 80) + '%';
      p.style.bottom = (Math.random() * 30) + '%';
      p.style.animationDelay = (Math.random() * 3) + 's';
      p.style.animationDuration = (3 + Math.random() * 2) + 's';
      p.style.width = p.style.height = (2 + Math.random() * 3) + 'px';
      pc.appendChild(p);
    }
  }
  popup.classList.add('open');
}

function closeReqPopup() {
  const popup = document.getElementById('reqPopup');
  if (popup) popup.classList.remove('open');
}

function morphFromPopup(cardEl, gameId, imgSrc) {
  const img = cardEl.querySelector('img');
  const rect = img ? img.getBoundingClientRect() : cardEl.getBoundingClientRect();
  const src = imgSrc || (img ? img.src : '');

  closeReqPopup();
  if (!src) { nav('jeu', gameId); return; }

  _morphing = true;
  const clone = document.createElement('div');
  clone.className = 'morph-clone';
  const br = img ? getComputedStyle(img).borderRadius : '0.75rem';
  clone.style.cssText = `left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;border-radius:${br};`;

  const cloneImg = document.createElement('img');
  cloneImg.src = src;
  cloneImg.alt = '';
  cloneImg.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;transition:opacity .5s ease;';
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
    document.querySelectorAll('.genre,.jeu-hero-title,.jeu-hero-title-img,.meta,.synopsis,.info-item,.actions,.back-btn').forEach((el, i) => {
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
      heroCloneImg.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;opacity:0;transition:opacity .5s ease;position:absolute;top:0;left:0;';
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

function reqDebounce(q) {
  clearTimeout(_reqTimer);
  if (!q.trim()) {
    const sres = document.getElementById('sres');
    if (sres) sres.innerHTML = '';
    return;
  }
  _reqTimer = setTimeout(() => reqSteamSearch(q), 350);
}

function reqOpenOverlay() {
  openSrchSteam();
}

function reqSyncSearch(val) {
  openSrchSteam();
  const sinput = document.getElementById('sinput');
  if (sinput) sinput.value = val;
  reqDebounce(val);
}

async function reqSteamSearch(q) {
  const grid = document.getElementById('sres');
  if (!grid) return;
  const thisId = ++_reqSearchId;
  grid.innerHTML = '<div class="sempty">Recherche en cours…</div>';

  try {
    const url = `https://steamcommunity.com/actions/SearchApps/${encodeURIComponent(q)}`;
    const data = await fetchWithProxy(url);
    if (thisId !== _reqSearchId) return;

    if (!data || !data.length) {
      grid.innerHTML = '<div class="sempty">Aucun résultat</div>';
      return;
    }

    grid.innerHTML = data.slice(0, 8).map(it => {
      const img = `https://cdn.cloudflare.steamstatic.com/steam/apps/${it.appid}/library_600x900.jpg`;
      const imgH = `https://cdn.cloudflare.steamstatic.com/steam/apps/${it.appid}/header.jpg`;
      const imgSm = `https://cdn.cloudflare.steamstatic.com/steam/apps/${it.appid}/capsule_sm_120.jpg`;
      const name = esc(cleanText(it.name));
      return `<div class="card" onclick="reqSelect(${it.appid})" style="cursor:pointer;opacity:1!important;transform:none!important;animation:none!important">
        <div class="card-img">
          <img src="${img}" alt="${name}" loading="lazy" onerror="this.onerror=null;this.src='${imgH}';this.onerror=function(){this.onerror=null;this.src='${imgSm}'}">
          <div style="position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,.9) 0%,rgba(0,0,0,.4) 40%,transparent 70%);z-index:5"></div>
          <div style="position:absolute;left:0;right:0;bottom:0;padding:.6rem .75rem;z-index:10;font-size:10px;font-weight:900;color:#fff;text-transform:uppercase;letter-spacing:-.01em;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${name}</div>
        </div>
      </div>`;
    }).join('');
  } catch (e) {
    if (thisId === _reqSearchId) {
      grid.innerHTML = '<div class="sempty">Erreur: ' + esc(e.message) + '</div>';
    }
  }
}

async function reqSelect(appId) {
  closeSrch();

  try {
    const d = await fetchWithProxy(`https://store.steampowered.com/api/appdetails?appids=${appId}&l=french&cc=FR`);
    const info = d[appId]?.data;
    if (!info) throw new Error('no data');

    _reqSelected = {
      name: cleanText(info.name),
      appId: appId,
      img: info.header_image || `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/header.jpg`,
      portrait: `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/library_600x900.jpg`,
      developers: cleanText((info.developers || []).join(', ')),
      publishers: cleanText((info.publishers || []).join(', ')),
      genres: cleanText((info.genres || []).map(g => g.description).join(', ')),
      release: info.release_date?.date || '',
      price: info.is_free ? 'Gratuit' : (info.price_overview?.final_formatted || ''),
      desc: cleanText(info.short_description || '').slice(0, 350),
      url: `https://store.steampowered.com/app/${appId}`
    };

    document.getElementById('reqPreviewImg').src = _reqSelected.portrait;
    document.getElementById('reqPreviewTitle').textContent = _reqSelected.name;
    const priceClass = (!_reqSelected.price || _reqSelected.price === '0') ? 'free' : '';
    const priceText = (!_reqSelected.price || _reqSelected.price === '0') ? 'Gratuit' : _reqSelected.price;
    const genres = (_reqSelected.genres || '').split(',').map(g => g.trim()).filter(Boolean);

    document.getElementById('reqPreviewMeta').innerHTML = [
      _reqSelected.developers ? `<span>${esc(_reqSelected.developers)}</span>` : '',
      _reqSelected.release ? `<span>${esc(_reqSelected.release)}</span>` : '',
      `<span class="req-preview-price ${priceClass}">${esc(priceText)}</span>`
    ].filter(Boolean).join('');

    const existingGenres = document.getElementById('reqPreviewGenres');
    if (existingGenres) existingGenres.remove();
    if (genres.length) {
      const genreDiv = document.createElement('div');
      genreDiv.className = 'req-preview-genres';
      genreDiv.id = 'reqPreviewGenres';
      genreDiv.innerHTML = genres.slice(0, 5).map(g => `<span class="req-preview-genre">${esc(g)}</span>`).join('');
      document.getElementById('reqPreviewMeta').after(genreDiv);
    }
    document.getElementById('reqPreviewDesc').textContent = _reqSelected.desc;
    document.getElementById('reqPreview').classList.add('show');

    let duplicateFound = false;

    // 1. Vérifier si déjà au catalogue
    try {
      let catalogGames = [];
      const localData = localStorage.getItem('crackuzu_games');
      if (localData) {
        catalogGames = JSON.parse(localData);
      } else {
        const cr = await fetch('data.json?t=' + Date.now());
        if (cr.ok) catalogGames = await cr.json();
      }
      const match = catalogGames.find(g =>
        g.appId === appId ||
        (g.title && _reqSelected.name && cleanText(g.title).toLowerCase() === _reqSelected.name.toLowerCase())
      );
      if (match) {
        duplicateFound = true;
        const cardImg = match.portrait_url || match.banner_url || '';
        const gameId = match.id || match.title || '';
        const cardHtml = `<div class="req-popup-card clickable" onclick="morphFromPopup(this,'${e2(gameId)}','${e2(cardImg)}')">
          <img class="req-popup-card-img" src="${esc(cardImg)}" onerror="this.style.display='none'" loading="lazy">
          <div class="req-popup-card-info">
            <div class="req-popup-card-name">${esc(match.title || '???')}</div>
            <div class="req-popup-card-meta">${esc(match.year || '')}</div>
            <div class="req-popup-card-badge">✅ Disponible</div>
          </div>
          <div class="req-popup-card-arrow">→</div>
        </div>`;
        showReqPopup('exists', '✅', 'Déjà sur le site !', 'Ce jeu est déjà dans le catalogue. Clique pour y accéder.', cardHtml);
      }
    } catch (e) {}

    // 2. Vérifier si déjà demandé
    if (!duplicateFound) {
      try {
        const rr = await fetch(`${CONFIG.WORKER_URL}/api/github-requests`);
        if (rr.ok) {
          const reqs = await rr.json();
          if (Array.isArray(reqs)) {
            const matchReq = reqs.find(r =>
              r.appId === appId ||
              (r.name && _reqSelected.name && cleanText(r.name).toLowerCase() === _reqSelected.name.toLowerCase())
            );
            if (matchReq) {
              duplicateFound = true;
              const cardImg = matchReq.img || '';
              const cardHtml = `<div class="req-popup-card">
                <img class="req-popup-card-img" src="${esc(cardImg)}" onerror="this.style.display='none'" loading="lazy">
                <div class="req-popup-card-info">
                  <div class="req-popup-card-name">${esc(matchReq.name || '???')}</div>
                  <div class="req-popup-card-meta">${esc(matchReq.release || '')}</div>
                  <div class="req-popup-card-badge">⏳ En attente</div>
                </div>
              </div>`;
              showReqPopup('pending', '⏳', 'Déjà demandé !', "On s'en occupe déjà, pas besoin de redemander 👍", cardHtml);
            }
          }
        }
      } catch (e) {}
    }

    document.getElementById('reqSubmit').disabled = duplicateFound;
  } catch (e) {
    console.error('Steam detail error:', e);
  }
}

// ── ENVOI DE LA DEMANDE SÉCURISÉ & ASSAINI ────────────────────────────────────
async function reqSend() {
  if (!_reqSelected) return;
  const btn = document.getElementById('reqSubmit');
  btn.classList.add('sending');
  btn.textContent = 'Envoi en cours…';

  const g = _reqSelected;

  // Assainissement strict pour éviter les boucles d'encodage
  const requestData = {
    name: cleanText(g.name).normalize('NFC'),
    appId: Number(g.appId),
    url: g.url,
    img: g.img,
    desc: cleanText(g.desc || '').slice(0, 350).normalize('NFC'),
    developers: cleanText(g.developers || '').normalize('NFC'),
    genres: cleanText(g.genres || '').normalize('NFC'),
    release: cleanText(g.release || '').normalize('NFC'),
    price: cleanText(g.price || '').normalize('NFC')
  };

  try {
    const r = await fetch(`${CONFIG.WORKER_URL}/api/save-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestData)
    });
    if (!r.ok) throw new Error(r.status);

    document.getElementById('reqForm')?.classList.add('hide');
    document.getElementById('reqSuccess')?.classList.add('show');
  } catch (e) {
    console.error('Request save error:', e);
    btn.classList.remove('sending');
    btn.textContent = 'Erreur — Réessayer';
    setTimeout(() => {
      btn.textContent = 'Envoyer la demande';
      btn.disabled = false;
    }, 2000);
  }
}

function reqReset() {
  initDemande();
}
