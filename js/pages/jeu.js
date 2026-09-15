// js/pages/jeu.js
// CrackUZU â€” Fiche dÃ©taillÃ©e du jeu avec Particules HarmonyOS, Specs PC & Galerie HD

let _logoParticleRaf = null;
let _currentScreenshots = [];
let _activeScreenshotIdx = 0;
const _steamDetailsCache = new Map();

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
      viewEl.innerHTML = '<div class="error" style="padding:4rem 2rem;text-align:center"><h2>Erreur de chargement</h2><p>Impossible de charger les donnÃ©es du jeu.</p></div>';
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

  // Titre & Logo avec animation de particules HarmonyOS
  const titleEl = document.getElementById('gameTitle');
  const titleImgEl = document.getElementById('gameTitleImg');
  
  // ArrÃªter toute animation de particule prÃ©cÃ©dente
  stopLogoParticleAnimation();

  if (game.title_img) {
    if (titleEl) titleEl.style.display = 'none';
    if (titleImgEl) {
      titleImgEl.src = game.title_img;
      titleImgEl.alt = game.title || game.name || '';
      titleImgEl.style.display = '';
      titleImgEl.style.opacity = '0'; // CachÃ© pendant l'assemblage des particules
      titleImgEl.style.maxWidth = '600px';
      titleImgEl.style.maxHeight = '400px';
      titleImgEl.style.objectFit = 'contain';
      titleImgEl.style.objectPosition = 'left center';

      const startParticleEffect = () => {
        const ratio = titleImgEl.naturalWidth / titleImgEl.naturalHeight;
        if (ratio < 0.8) titleImgEl.style.maxHeight = '480px';
        else if (ratio > 1.5) titleImgEl.style.maxHeight = '300px';
        else titleImgEl.style.maxHeight = '400px';

        // Lancer l'animation de particules style HarmonyOS
        runLogoParticleAnimation(game.title_img, titleImgEl);
      };

      if (titleImgEl.complete && titleImgEl.naturalWidth > 0) {
        startParticleEffect();
      } else {
        titleImgEl.onload = startParticleEffect;
        titleImgEl.onerror = () => {
          titleImgEl.style.opacity = '1';
        };
      }
    }
  } else {
    if (titleEl) {
      titleEl.textContent = game.title || game.name || '';
      titleEl.style.display = '';
      titleEl.style.opacity = '1';
    }
    if (titleImgEl) titleImgEl.style.display = 'none';
  }
  document.title = `CRACKUZU - ${game.title || game.name}`;

  // Image d'arrière-plan avec préchargement instantané
  const heroImg = document.getElementById('heroImg');
  const heroBg = document.getElementById('heroBg');
  const targetImgSrc = game.banner_url || game.portrait_url || null;

  if (heroBg) {
    heroBg.classList.remove('loaded');
  }

  if (targetImgSrc && heroImg) {
    heroImg.alt = game.title || game.name || '';
    heroImg.style.display = '';

    const preloader = new Image();
    preloader.src = targetImgSrc;

    const onReady = () => {
      heroImg.src = targetImgSrc;
      if (heroBg) heroBg.classList.add('loaded');
      triggerGameAnimations();
    };

    if (preloader.complete && preloader.naturalWidth > 0) {
      onReady();
    } else {
      preloader.onload = onReady;
      preloader.onerror = () => {
        heroImg.src = targetImgSrc;
        if (heroBg) heroBg.classList.add('loaded');
        triggerGameAnimations();
      };
      setTimeout(() => {
        if (heroBg && !heroBg.classList.contains('loaded')) {
          onReady();
        }
      }, 600);
    }
  } else {
    if (heroBg) {
      heroBg.style.background = 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)';
      heroBg.classList.add('loaded');
    }
    if (heroImg) heroImg.style.display = 'none';
    triggerGameAnimations();
  }

  // Genres
  const genresContainer = document.getElementById('genres');
  if (genresContainer && game.categories && Array.isArray(game.categories)) {
    genresContainer.innerHTML = game.categories.map(c =>
      `<span class="genre">${esc(c)}</span>`
    ).join('');
  }

  // MÃ©tadonnÃ©es
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

  // Bouton Partager / Copier le lien
  const shareBtn = document.getElementById('shareBtn');
  if (shareBtn) {
    shareBtn.style.display = 'flex';
    shareBtn.onclick = () => copyJeuLink();
  }

  // Chargement asynchrone des mÃ©tadonnÃ©es Ã©tendues Steam (Captures d'Ã©cran + Configuration)
  loadSteamMediaAndSpecs(game);
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// ANIMATION DE PARTICULES HARMONYOS (LOGO CONVERGENCE)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function runLogoParticleAnimation(imgSrc, targetImgEl) {
  const canvas = document.getElementById('logoParticleCanvas');
  if (!canvas) {
    if (targetImgEl) targetImgEl.style.opacity = '1';
    return;
  }

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    if (targetImgEl) targetImgEl.style.opacity = '1';
    return;
  }

  const offImg = new Image();
  offImg.crossOrigin = 'anonymous';
  offImg.src = imgSrc;

  offImg.onload = () => {
    try {
      const displayW = targetImgEl.offsetWidth || 340;
      const displayH = targetImgEl.offsetHeight || 160;

      if (displayW === 0 || displayH === 0) {
        targetImgEl.style.opacity = '1';
        return;
      }

      // Haute rÃ©solution pour particules ultra-nettes
      canvas.width = displayW;
      canvas.height = displayH;
      canvas.style.width = displayW + 'px';
      canvas.style.height = displayH + 'px';
      canvas.style.opacity = '1';

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        targetImgEl.style.opacity = '1';
        return;
      }

      // Ã‰chantillonnage Ã  rÃ©solution fine
      const sampleW = Math.min(300, displayW);
      const sampleH = Math.round(sampleW * (displayH / displayW));
      const offCanvas = document.createElement('canvas');
      offCanvas.width = sampleW;
      offCanvas.height = sampleH;
      const offCtx = offCanvas.getContext('2d', { willReadFrequently: true });
      offCtx.drawImage(offImg, 0, 0, sampleW, sampleH);

      let imgData;
      try {
        imgData = offCtx.getImageData(0, 0, sampleW, sampleH).data;
      } catch (e) {
        canvas.style.opacity = '0';
        targetImgEl.style.opacity = '1';
        return;
      }

      const points = [];
      for (let y = 0; y < sampleH; y++) {
        for (let x = 0; x < sampleW; x++) {
          const idx = (y * sampleW + x) * 4;
          const alpha = imgData[idx + 3];
          if (alpha > 40) {
            points.push({
              x,
              y,
              r: imgData[idx],
              g: imgData[idx + 1],
              b: imgData[idx + 2],
              alpha: alpha / 255
            });
          }
        }
      }

      if (points.length < 40) {
        canvas.style.opacity = '0';
        targetImgEl.style.opacity = '1';
        return;
      }

      // SÃ©lection de 1200 particules ultra-fines avec jitter sub-pixel continu (supprime tout effet grille)
      const targetCount = Math.min(1300, points.length);
      const stepFactor = points.length / targetCount;
      const particles = [];

      for (let i = 0; i < targetCount; i++) {
        const p = points[Math.floor(i * stepFactor)];
        if (!p) continue;

        // Sub-pixel jitter alÃ©atoire : les particules ne tombent jamais sur une grille carrÃ©e
        const jitterX = (Math.random() - 0.5) * 1.8;
        const jitterY = (Math.random() - 0.5) * 1.8;
        const targetX = (p.x / sampleW) * displayW + jitterX;
        const targetY = (p.y / sampleH) * displayH + jitterY;

        // Trajectoire en spirale / flux fluide HarmonyOS
        const angle = Math.random() * Math.PI * 2;
        const dist = 70 + Math.random() * 200;
        const startX = targetX + Math.cos(angle) * dist;
        const startY = targetY + Math.sin(angle) * dist;

        // Point de contrÃ´le incurvÃ© pour un flux organique
        const perpAngle = angle + (Math.random() > 0.5 ? 1 : -1) * (Math.PI / 3);
        const ctrlDist = dist * (0.4 + Math.random() * 0.3);
        const ctrlX = (startX + targetX) / 2 + Math.cos(perpAngle) * ctrlDist;
        const ctrlY = (startY + targetY) / 2 + Math.sin(perpAngle) * ctrlDist;

        // Rayon trÃ¨s fin (0.7px Ã  1.4px) = vraie poussiÃ¨re d'Ã©toiles lumineuse
        const radius = 0.65 + Math.random() * 0.75;
        const delay = Math.random() * 0.25;

        particles.push({
          startX, startY,
          ctrlX, ctrlY,
          targetX, targetY,
          color: `rgba(${p.r},${p.g},${p.b},`,
          glowColor: `rgba(${Math.min(255, p.r + 50)},${Math.min(255, p.g + 40)},${Math.min(255, p.b + 25)},`,
          radius,
          delay
        });
      }

      const startTime = performance.now();
      const duration = 850; // 850ms fluide

      const animate = (now) => {
        const rawProgress = (now - startTime) / duration;
        ctx.clearRect(0, 0, displayW, displayH);

        let allSettled = true;

        particles.forEach(pt => {
          const adjProgress = Math.max(0, Math.min(1, (rawProgress - pt.delay) / (1 - pt.delay)));
          if (adjProgress < 1) allSettled = false;

          // Courbe quintique HarmonyOS ultra-douce
          const t = 1 - Math.pow(1 - adjProgress, 4.2);

          // Courbe quadratique de BÃ©zier (mouvement fluide en arc)
          const invT = 1 - t;
          const curX = invT * invT * pt.startX + 2 * invT * t * pt.ctrlX + t * t * pt.targetX;
          const curY = invT * invT * pt.startY + 2 * invT * t * pt.ctrlY + t * t * pt.targetY;
          const curAlpha = Math.min(1, adjProgress * 1.8);

          // Rendu point micro-particule ultra-fin
          ctx.beginPath();
          ctx.arc(curX, curY, pt.radius, 0, Math.PI * 2);
          ctx.fillStyle = pt.color + curAlpha + ')';
          ctx.shadowBlur = 6;
          ctx.shadowColor = pt.glowColor + (curAlpha * 0.6) + ')';
          ctx.fill();
        });

        if (!allSettled && rawProgress < 1.12) {
          _logoParticleRaf = requestAnimationFrame(animate);
        } else {
          // RÃ©vÃ©lation nette et cristalline du logo
          targetImgEl.style.transition = 'opacity 0.4s ease, transform 0.4s cubic-bezier(.22,1,.36,1)';
          targetImgEl.style.opacity = '1';
          targetImgEl.style.transform = 'scale(1)';

          canvas.style.transition = 'opacity 0.3s ease';
          canvas.style.opacity = '0';
          setTimeout(() => {
            ctx.clearRect(0, 0, displayW, displayH);
          }, 320);
        }
      };

      _logoParticleRaf = requestAnimationFrame(animate);

    } catch (e) {
      console.warn('Particle animation fallback:', e);
      if (targetImgEl) targetImgEl.style.opacity = '1';
      if (canvas) canvas.style.opacity = '0';
    }
  };

  offImg.onerror = () => {
    if (targetImgEl) targetImgEl.style.opacity = '1';
  };
}

function stopLogoParticleAnimation() {
  if (_logoParticleRaf) {
    cancelAnimationFrame(_logoParticleRaf);
    _logoParticleRaf = null;
  }
  const canvas = document.getElementById('logoParticleCanvas');
  if (canvas) {
    canvas.style.opacity = '0';
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// STEAM METADATA : CONFIG PC & CAPTURES D'Ã‰CRAN
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
async function loadSteamMediaAndSpecs(game) {
  const screenshotsSec = document.getElementById('gameScreenshotsSection');
  const specsSec = document.getElementById('gameSpecsSection');

  try {
    // 1. DÃ©tection de l'AppID Steam
    let appId = null;
    const urlMatch = (game.portrait_url || '' + game.banner_url || '').match(/steam\/apps\/(\d+)/);
    if (urlMatch) {
      appId = urlMatch[1];
    } else {
      // Recherche de l'AppID par le titre
      const searchRes = await fetchWithProxy(`https://steamcommunity.com/actions/SearchApps/${encodeURIComponent(game.title || game.name)}`);
      if (searchRes && searchRes.length > 0 && searchRes[0].appid) {
        appId = searchRes[0].appid;
      }
    }

    if (!appId) {
      if (screenshotsSec) screenshotsSec.style.display = 'none';
      if (specsSec) specsSec.style.display = 'none';
      return;
    }

    // 2. RÃ©cupÃ©ration des dÃ©tails de l'app (avec cache mÃ©moire)
    let details = _steamDetailsCache.get(appId);
    if (!details) {
      const apiRes = await fetchWithProxy(`https://store.steampowered.com/api/appdetails?appids=${appId}&l=french&cc=FR`);
      details = apiRes?.[appId]?.data;
      if (details) _steamDetailsCache.set(appId, details);
    }

    if (!details) return;

    // 3. Rendu des captures d'Ã©cran
    if (details.screenshots && details.screenshots.length > 0) {
      renderScreenshots(details.screenshots);
    } else if (screenshotsSec) {
      screenshotsSec.style.display = 'none';
    }

    // 4. Rendu de la configuration requise
    if (details.pc_requirements && (details.pc_requirements.minimum || details.pc_requirements.recommended)) {
      renderSpecs(details.pc_requirements);
    } else if (specsSec) {
      specsSec.style.display = 'none';
    }

  } catch (err) {
    console.warn('Impossible de charger les mÃ©dias Steam:', err.message);
    if (screenshotsSec) screenshotsSec.style.display = 'none';
    if (specsSec) specsSec.style.display = 'none';
  }
}

// // Galerie de Captures d'Écran
function renderScreenshots(screenshots) {
  const section = document.getElementById('gameScreenshotsSection');
  const mainImg = document.getElementById('screenshotMainImg');
  const track = document.getElementById('screenshotThumbsTrack');
  const counterBadge = document.getElementById('screenshotCounterBadge');
  if (!section || !mainImg || !track) return;

  _currentScreenshots = screenshots.map(s => s.path_full || s.path_thumbnail);
  _activeScreenshotIdx = 0;

  if (counterBadge) {
    counterBadge.textContent = `${_currentScreenshots.length} captures`;
  }

  // Image principale
  mainImg.src = _currentScreenshots[0];

  // Vignettes
  track.innerHTML = screenshots.map((s, idx) => `
    <div class="screenshot-thumb ${idx === 0 ? 'active' : ''}" onclick="selectScreenshot(${idx})">
      <img src="${esc(s.path_thumbnail || s.path_full)}" alt="Vignette ${idx + 1}" loading="lazy">
    </div>
  `).join('');

  section.style.display = 'block';
}

function selectScreenshot(idx) {
  if (!_currentScreenshots[idx]) return;
  _activeScreenshotIdx = idx;

  const mainImg = document.getElementById('screenshotMainImg');
  if (mainImg) {
    mainImg.style.opacity = '0.4';
    mainImg.src = _currentScreenshots[idx];
    mainImg.onload = () => { mainImg.style.opacity = '1'; };
  }

  // Active state sur les vignettes
  document.querySelectorAll('.screenshot-thumb').forEach((el, i) => {
    el.classList.toggle('active', i === idx);
  });
}

function scrollScreenshots(direction) {
  const track = document.getElementById('screenshotThumbsTrack');
  if (!track) return;
  track.scrollBy({ left: direction * 320, behavior: 'smooth' });
}

// // Lightbox Plein Écran
function openScreenshotLightbox(idx) {
  const lightbox = document.getElementById('screenshotLightbox');
  const img = document.getElementById('lightboxImg');
  const counter = document.getElementById('lightboxCounter');
  if (!lightbox || !img) return;

  const index = typeof idx === 'number' ? idx : _activeScreenshotIdx;
  _activeScreenshotIdx = index;

  img.src = _currentScreenshots[index] || '';
  if (counter) counter.textContent = `${index + 1} / ${_currentScreenshots.length}`;

  lightbox.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  lightbox.offsetHeight; // reflow
  lightbox.style.opacity = '1';
}

function closeScreenshotLightbox(e) {
  if (e && e.target && e.target.closest('.lightbox-nav')) return;
  const lightbox = document.getElementById('screenshotLightbox');
  if (!lightbox) return;

  lightbox.style.opacity = '0';
  setTimeout(() => {
    lightbox.style.display = 'none';
    document.body.style.overflow = '';
  }, 300);
}

function navigateLightbox(dir) {
  if (!_currentScreenshots.length) return;
  let nextIdx = _activeScreenshotIdx + dir;
  if (nextIdx < 0) nextIdx = _currentScreenshots.length - 1;
  if (nextIdx >= _currentScreenshots.length) nextIdx = 0;

  _activeScreenshotIdx = nextIdx;
  const img = document.getElementById('lightboxImg');
  const counter = document.getElementById('lightboxCounter');
  if (img) img.src = _currentScreenshots[nextIdx];
  if (counter) counter.textContent = `${nextIdx + 1} / ${_currentScreenshots.length}`;
}

// // Configuration Requise PC
function parseRequirementsHtml(rawHtml) {
  if (!rawHtml) return null;

  const parser = new DOMParser();
  const doc = parser.parseFromString(rawHtml, 'text/html');
  const listItems = doc.querySelectorAll('li');

  const specs = {
    os: '',
    cpu: '',
    ram: '',
    gpu: '',
    storage: '',
    directx: '',
    notes: ''
  };

  listItems.forEach(li => {
    const text = li.textContent || '';
    const lower = text.toLowerCase();

    if (lower.includes('systÃ¨me d\'exploitation') || lower.includes('os:') || lower.includes('os :')) {
      specs.os = text.replace(/^[^:]*:\s*/i, '').trim();
    } else if (lower.includes('processeur') || lower.includes('processor:')) {
      specs.cpu = text.replace(/^[^:]*:\s*/i, '').trim();
    } else if (lower.includes('mÃ©moire vive') || lower.includes('memory:')) {
      specs.ram = text.replace(/^[^:]*:\s*/i, '').trim();
    } else if (lower.includes('graphiques') || lower.includes('graphics:')) {
      specs.gpu = text.replace(/^[^:]*:\s*/i, '').trim();
    } else if (lower.includes('espace disque') || lower.includes('stockage') || lower.includes('storage:')) {
      specs.storage = text.replace(/^[^:]*:\s*/i, '').trim();
    } else if (lower.includes('directx')) {
      specs.directx = text.replace(/^[^:]*:\s*/i, '').trim();
    } else if (lower.includes('notes supplémentaires') || lower.includes('additional notes:')) {
      specs.notes = text.replace(/^[^:]*:\s*/i, '').trim();
    }
  });

  return specs;
}

function renderSpecs(pcReq) {
  const section = document.getElementById('gameSpecsSection');
  const minList = document.getElementById('specMinItems');
  const recList = document.getElementById('specRecItems');
  const recCard = document.getElementById('specCardRec');
  if (!section || !minList || !recList) return;

  const minSpecs = parseRequirementsHtml(pcReq.minimum);
  const recSpecs = parseRequirementsHtml(pcReq.recommended);

  if (!minSpecs && !recSpecs) {
    section.style.display = 'none';
    return;
  }

  const icons = {
    os: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
    cpu: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3"/></svg>',
    ram: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 19v-3"/><path d="M10 19v-3"/><path d="M14 19v-3"/><path d="M18 19v-3"/><rect x="2" y="5" width="20" height="11" rx="2"/></svg>',
    gpu: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 12h.01M10 12h.01M14 12h.01M18 12h.01"/><path d="M2 10h20"/></svg>',
    storage: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="12" x2="2" y2="12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/><line x1="6" y1="16" x2="6.01" y2="16"/><line x1="10" y1="16" x2="10.01" y2="16"/></svg>',
    directx: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="m10 8 4 8M14 8l-4 8"/></svg>'
  };

  const createSpecRows = (s) => {
    if (!s) return '<div style="color:rgba(255,255,255,.4);padding:1rem">Non spÃ©cifiÃ©e</div>';
    let html = '';
    if (s.os) html += `<div class="spec-item-row"><div class="spec-item-icon">${icons.os}</div><div class="spec-item-body"><div class="spec-item-label">Système d'exploitation</div><div class="spec-item-val">${esc(s.os)}</div></div></div>`;
    if (s.cpu) html += `<div class="spec-item-row"><div class="spec-item-icon">${icons.cpu}</div><div class="spec-item-body"><div class="spec-item-label">Processeur</div><div class="spec-item-val">${esc(s.cpu)}</div></div></div>`;
    if (s.ram) html += `<div class="spec-item-row"><div class="spec-item-icon">${icons.ram}</div><div class="spec-item-body"><div class="spec-item-label">Mémoire RAM</div><div class="spec-item-val">${esc(s.ram)}</div></div></div>`;
    if (s.gpu) html += `<div class="spec-item-row"><div class="spec-item-icon">${icons.gpu}</div><div class="spec-item-body"><div class="spec-item-label">Carte graphique</div><div class="spec-item-val">${esc(s.gpu)}</div></div></div>`;
    if (s.storage) html += `<div class="spec-item-row"><div class="spec-item-icon">${icons.storage}</div><div class="spec-item-body"><div class="spec-item-label">Espace disque</div><div class="spec-item-val">${esc(s.storage)}</div></div></div>`;
    if (s.directx) html += `<div class="spec-item-row"><div class="spec-item-icon">${icons.directx}</div><div class="spec-item-body"><div class="spec-item-label">DirectX</div><div class="spec-item-val">${esc(s.directx)}</div></div></div>`;
    if (s.notes) html += `<div class="spec-notes-box"><strong>[i] Note :</strong> ${esc(s.notes)}</div>`;
    return html;
  };

  minList.innerHTML = createSpecRows(minSpecs);

  if (recSpecs && (recSpecs.cpu || recSpecs.gpu || recSpecs.ram)) {
    recList.innerHTML = createSpecRows(recSpecs);
    if (recCard) recCard.style.display = 'block';
  } else if (recCard) {
    recCard.style.display = 'none';
  }

  section.style.display = 'block';
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// TÃ‰LÃ‰CHARGEMENT & MODALES
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function openDownloadMenu(game) {
  const overlay = document.getElementById('downloadModal');
  const box = document.getElementById('downloadBox');
  const list = document.getElementById('downloadList');
  if (!overlay || !box || !list) return;

  const sources = game.magnets || game.sources || [];

  if (sources.length === 0) {
    list.innerHTML = '<div style="padding:2rem;text-align:center;color:#94a3b8">Aucune source de tÃ©lÃ©chargement disponible</div>';
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
        else sourceType = 'Source de tÃ©lÃ©chargement';
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
              ${size ? `<div style="font-size:.8rem;color:#64748b;margin-top:.5rem"><span style="color:#f97316">📦 Taille :</span> ${esc(size)}</div>` : ''}
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
  if (e && e.target !== e.currentTarget && !e.target.closest('button')) return;
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

// // BANDE-ANNONCE (TRAILER) //////////////////////////////////
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
  if (e && e.target !== e.currentTarget && !e.target.closest('#trailerCloseBtn') && !e.target.closest('button')) return;
  const overlay = document.getElementById('trailerOverlay');
  const box = document.getElementById('trailerBox');
  const frame = document.getElementById('trailerFrame');
  if (!overlay || !box || !frame) return;

  frame.src = 'about:blank'; // Coupe le son et la vidÃ©o immÃ©diatement
  overlay.style.opacity = '0';
  box.style.transform = 'scale(.8)';
  box.style.opacity = '0';

  setTimeout(() => {
    overlay.style.display = 'none';
    frame.src = '';
    document.body.style.overflow = '';
  }, 350);
}

// Rendre accessible globalement pour les onclick HTML
window.closeTrailer = closeJeuTrailer;
window.closeJeuTrailer = closeJeuTrailer;
window.openScreenshotLightbox = openScreenshotLightbox;
window.closeScreenshotLightbox = closeScreenshotLightbox;
window.navigateLightbox = navigateLightbox;
window.selectScreenshot = selectScreenshot;
window.scrollScreenshots = scrollScreenshots;

// Ã‰couteur global pour la touche Ã‰chap
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const trailerOverlay = document.getElementById('trailerOverlay');
    if (trailerOverlay && trailerOverlay.style.display === 'flex') {
      closeJeuTrailer();
      return;
    }
    const lightbox = document.getElementById('screenshotLightbox');
    if (lightbox && lightbox.style.display === 'flex') {
      closeScreenshotLightbox();
      return;
    }
    const dlModal = document.getElementById('downloadModal');
    if (dlModal && dlModal.style.display === 'flex') {
      closeDownloadMenu();
      return;
    }
  } else if (e.key === 'ArrowLeft') {
    const lightbox = document.getElementById('screenshotLightbox');
    if (lightbox && lightbox.style.display === 'flex') {
      navigateLightbox(-1);
    }
  } else if (e.key === 'ArrowRight') {
    const lightbox = document.getElementById('screenshotLightbox');
    if (lightbox && lightbox.style.display === 'flex') {
      navigateLightbox(1);
    }
  }
});

function showNotFound() {
  document.getElementById('loading')?.style.setProperty('display', 'none');
  document.getElementById('hero')?.style.setProperty('display', 'none');
  const nf = document.getElementById('notFound');
  if (nf) nf.style.display = 'flex';
}

function triggerGameAnimations() {
  const seq = [
    { sel: '.back-btn',              delay: 40 },
    { sel: '.genre',                 delay: 100, stagger: 40 },
    { sel: '.jeu-hero-title',        delay: 180 },
    { sel: '.meta',                  delay: 260 },
    { sel: '.actions .btn-primary',  delay: 340 },
    { sel: '.actions .btn-secondary',delay: 380, stagger: 40 },
    { sel: '.synopsis',              delay: 440 },
    { sel: '.info-item',             delay: 500, stagger: 50 },
  ];

  seq.forEach(({ sel, delay, stagger = 0 }) => {
    setTimeout(() => {
      document.querySelectorAll(sel).forEach((el, i) => {
        setTimeout(() => {
          el.classList.add('visible');
          el.style.animation = 'none';
          void el.offsetWidth;
          el.style.animation = '';
        }, i * stagger);
      });
    }, delay);
  });

  // Ripple effect
  const downloadBtn = document.getElementById('downloadBtn');
  if (downloadBtn && !downloadBtn.dataset.rippleAttached) {
    downloadBtn.dataset.rippleAttached = 'true';
    downloadBtn.addEventListener('click', function(e) {
      const r = document.createElement('span');
      r.className = 'ripple-effect';
      const rect = this.getBoundingClientRect();
      r.style.left = (e.clientX - rect.left) + 'px';
      r.style.top  = (e.clientY - rect.top)  + 'px';
      this.appendChild(r);
      setTimeout(() => r.remove(), 700);
    });
  }
}

function initJeu(gameId) {
  stopLogoParticleAnimation();
  window._spaGameId = gameId;
  window.scrollTo({ top: 0, behavior: 'instant' });
  loadGame();
}