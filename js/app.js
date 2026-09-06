// js/app.js
// CrackUZU — Point d'entrée principal & Écouteurs globaux

let _srchMode = 'local'; // 'local' ou 'steam'

// ── RECHERCHE GLOBALE AVEC RECHERCHE FLOUE (FUZZY SEARCH) ───────────────────
function openSrch() {
  _srchMode = 'local';
  const input = document.getElementById('sinput');
  if (input) input.placeholder = 'Chercher un jeu…';
  document.getElementById('sov')?.classList.add('open');
  document.body.style.overflow = 'hidden';
  setTimeout(() => input?.focus(), 50);
}

function openSrchSteam() {
  _srchMode = 'steam';
  const input = document.getElementById('sinput');
  if (input) input.placeholder = 'Chercher un jeu sur Steam…';
  document.getElementById('sov')?.classList.add('open');
  document.body.style.overflow = 'hidden';
  setTimeout(() => input?.focus(), 50);
}

function closeSrch() {
  document.getElementById('sov')?.classList.remove('open');
  document.body.style.overflow = '';
  const input = document.getElementById('sinput');
  if (input) {
    input.value = '';
    input.placeholder = 'Chercher un jeu…';
  }
  const sres = document.getElementById('sres');
  if (sres) sres.innerHTML = '';
  _srchMode = 'local';
}

function doSrch(q) {
  if (_srchMode === 'steam') {
    if (typeof reqDebounce === 'function') reqDebounce(q);
    return;
  }

  const r = document.getElementById('sres');
  if (!r) return;
  if (!q.trim()) {
    r.innerHTML = '';
    return;
  }

  // Utilise le pool de jeux chargés (ALL ou CAT_ALL)
  const pool = (typeof ALL !== 'undefined' && ALL.length) ? ALL : ((typeof CAT_ALL !== 'undefined' && CAT_ALL.length) ? CAT_ALL : []);
  
  // Utilise le moteur de recherche floue
  const matches = SearchEngine.search(pool, q, 12);

  if (!matches.length) {
    r.innerHTML = `<div class="sempty">Aucun résultat pour « ${esc(q)} »</div>`;
    return;
  }

  r.innerHTML = matches.map((g, i) => card(g, i)).join('');
}

function card(g, i = 0) {
  const img = g.portrait_url || null;
  const sImg = steamImg ? steamImg(g) : null;
  const animStyle = i >= 0 ? `animation-delay:${i * 0.05}s` : 'opacity:1;transform:none';
  const m = (g.portrait_url || g.banner_url || '').match(/steam\/apps\/(\d+)/);
  const sid = m ? m[1] : null;
  const hImg = sid ? `https://cdn.cloudflare.steamstatic.com/steam/apps/${sid}/header.jpg` : '';
  const onerr = sImg ? ` onerror="this.onerror=null;this.src='${hImg}'"` : '';

  return `<div class="card" onclick="morphToJeu(this,'${e2(g.id)}','${e2(img || sImg || '')}')" style="cursor:pointer;${animStyle}">
    <div class="card-img">
      ${img
        ? `<img src="${esc(img)}" alt="${esc(g.name)}" loading="lazy">`
        : (sImg ? `<img src="${sImg}" alt="${esc(g.name)}" loading="lazy"${onerr}>` : `<div class="card-noimg">🎮</div>`)}
      ${g.year ? `<div class="card-yr">${esc(g.year)}</div>` : ''}
      ${g.categories?.length ? `<div class="card-cat">${esc(g.categories[0])}${g.categories.length > 1 ? '+' : ''}</div>` : ''}
    </div>
  </div>`;
}

// ── MENU MOBILE ─────────────────────────────────────────────────────────────
function toggleMobileMenu() {
  document.getElementById('mobileMenu')?.classList.toggle('open');
  document.getElementById('hamburger')?.classList.toggle('open');
}

function closeMobileMenu() {
  document.getElementById('mobileMenu')?.classList.remove('open');
  document.getElementById('hamburger')?.classList.remove('open');
}

// ── NOTIFICATIONS ───────────────────────────────────────────────────────────
function toggleNotifs(ev) {
  if (ev) ev.stopPropagation();
  const dropdown = document.getElementById('notifDropdown');
  if (dropdown) dropdown.classList.toggle('open');
}

// ── ÉCOUTEURS GLOBAUX ───────────────────────────────────────────────────────
document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape') {
    closeSrch();
    if (typeof closeMod === 'function') closeMod();
    if (typeof closeYtModal === 'function') closeYtModal();
    if (typeof closeDownloadMenu === 'function') closeDownloadMenu();
  }
});

window.addEventListener('scroll', () => {
  const hdr = document.getElementById('hdr');
  if (hdr) hdr.classList.toggle('scrolled', window.scrollY > 80);
});

document.addEventListener('click', (ev) => {
  // Ferme notifications en dehors
  const notifWrapper = document.querySelector('.notif-wrapper');
  const notifDropdown = document.getElementById('notifDropdown');
  if (notifDropdown && notifWrapper && !notifWrapper.contains(ev.target)) {
    notifDropdown.classList.remove('open');
  }

  // Ferme dropdown filtre catalogue en dehors
  const filterDropdown = document.getElementById('filterDropdown');
  const filterBtn = document.getElementById('filterBtn');
  if (filterDropdown && filterBtn && !filterDropdown.contains(ev.target) && !filterBtn.contains(ev.target)) {
    filterDropdown.classList.remove('open');
  }

  // Ferme résultats demande en dehors
  const reqResults = document.getElementById('reqResults');
  if (reqResults && !ev.target.closest('.req-search-wrap')) {
    reqResults.classList.remove('open');
  }
});

// ── INITIALISATION AU DÉMARRAGE ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const hasCode = params.get('code');

  if (hasCode) {
    if (typeof exchangeCodeForToken === 'function') {
      exchangeCodeForToken(hasCode);
      return;
    }
  }

  const discordUser = localStorage.getItem('discord_user');
  if (discordUser) {
    try {
      const user = JSON.parse(discordUser);
      if (user.id === DISCORD_CONFIG.ALLOWED_DISCORD_ID || user.username === DISCORD_CONFIG.ALLOWED_USERNAME) {
        if (sessionStorage.getItem('returnToAdmin') === 'true') {
          sessionStorage.removeItem('returnToAdmin');
          nav('admin');
          return;
        }
      }
    } catch(e) {
      localStorage.removeItem('discord_user');
    }
  }

  // Page d'accueil par défaut
  nav('accueil');
});
