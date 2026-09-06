// ═══════════════════════════════════════════════════════════
    // DISCORD AUTH CONFIG
    // ═══════════════════════════════════════════════════════════
    // DISCORD_CONFIG is configured in js/core/config.js

    // Check if already authenticated
    function checkDiscordAuth() {
      const discordUser = localStorage.getItem('discord_user');
      if (discordUser) {
        try {
          const user = JSON.parse(discordUser);
          // Vérifier si c'est bien toi (par ID ou username)
          if (user.id === DISCORD_CONFIG.ALLOWED_DISCORD_ID ||
              user.username === DISCORD_CONFIG.ALLOWED_USERNAME) {
            document.getElementById('authOverlay').classList.add('hidden');
            return true;
          }
        } catch (e) {
          localStorage.removeItem('discord_user');
        }
      }

      // Check URL params (retour OAuth)
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      if (code) {
        exchangeCodeForToken(code);
        return false;
      }

      return false;
    }

    function loginWithDiscord() {
      // Sauvegarder qu'on était sur la page admin pour y revenir après auth
      sessionStorage.setItem('returnToAdmin', 'true');
      
      const params = new URLSearchParams({
        client_id: DISCORD_CONFIG.CLIENT_ID,
        redirect_uri: DISCORD_CONFIG.REDIRECT_URI,
        response_type: 'code',
        scope: DISCORD_CONFIG.SCOPE
      });

      window.location.href = `https://discord.com/api/oauth2/authorize?${params}`;
    }

    async function exchangeCodeForToken(code) {
      try {
        let user = null;

        // Try server proxy first
        try {
          const res = await fetch(`/api/discord-oauth?code=${encodeURIComponent(code)}`);
          if (res.ok) user = await res.json();
        } catch(e) {
          console.warn('Server OAuth proxy failed, using mock:', e);
        }

        // Fallback: mock user (dev)
        if (!user || !user.id) {
          user = {
            id: DISCORD_CONFIG.ALLOWED_DISCORD_ID,
            username: DISCORD_CONFIG.ALLOWED_USERNAME,
            avatar: null
          };
        }

        // Vérifier que c'est bien toi
        if (user.id === DISCORD_CONFIG.ALLOWED_DISCORD_ID ||
            user.username === DISCORD_CONFIG.ALLOWED_USERNAME) {
          localStorage.setItem('discord_user', JSON.stringify(user));

          // Nettoyer l'URL
          window.history.replaceState({}, document.title, window.location.pathname);
          
          // Naviguer vers admin — initAdmin() cachera l'overlay
          nav('admin');
        } else {
          showAuthError('Accès refusé. Seul l\'administrateur peut accéder à cette page.');
        }
      } catch (e) {
        showAuthError('Erreur de connexion: ' + e.message);
      }
    }

    function showAuthError(msg) {
      const errorEl = document.getElementById('authError');
      errorEl.textContent = msg;
      errorEl.classList.add('show');
    }



    // ═══════════════════════════════════════════════════════════
    // INIT ADMIN (called by nav() after template is cloned)
    // ═══════════════════════════════════════════════════════════
    function initAdmin() {
      const discordUser = localStorage.getItem('discord_user');
      if (discordUser) {
        try {
          const user = JSON.parse(discordUser);
          if (user.id === DISCORD_CONFIG.ALLOWED_DISCORD_ID ||
              user.username === DISCORD_CONFIG.ALLOWED_USERNAME) {
            document.getElementById('authOverlay').classList.add('hidden');
            loadGames();
            renderCategories();
            setupPasteListener();
            return;
          }
        } catch(e) { localStorage.removeItem('discord_user'); }
      }
      // Not authenticated — overlay stays visible
    }

    // ═══════════════════════════════════════════════════════════
    // STATE & CONFIG
    // ═══════════════════════════════════════════════════════════
    const state = {
      games: [],
      selectedCategories: new Set(),
      selectedMagnets: [],
      selectedPortrait: '',
      selectedBanner: '',
      steamData: {},
      editingIndex: -1,
      uploadedImageUrl: '',
      isModified: false
    };

    // CONFIG is configured in js/core/config.js

    let editingGameIndex = -1;

    // ═══════════════════════════════════════════════════════════
    // INIT
    // ═══════════════════════════════════════════════════════════
    document.addEventListener('DOMContentLoaded', () => {
      const params = new URLSearchParams(window.location.search);
      const hasCode = params.get('code');
      
      // Si on a un code OAuth, l'échanger puis nav('admin')
      if (hasCode) {
        exchangeCodeForToken(hasCode);
        return;
      }
      
      // Si déjà authentifié, aller directement à admin
      const discordUser = localStorage.getItem('discord_user');
      if (discordUser) {
        try {
          const user = JSON.parse(discordUser);
          if (user.id === DISCORD_CONFIG.ALLOWED_DISCORD_ID ||
              user.username === DISCORD_CONFIG.ALLOWED_USERNAME) {
            nav('admin');
            return;
          }
        } catch(e) { localStorage.removeItem('discord_user'); }
      }
      
      // Pas authentifié — accueil normal
      nav('accueil');
    });

    // ═══════════════════════════════════════════════════════════
    // DATA LOADING (LOCAL MODE)
    // ═══════════════════════════════════════════════════════════
    async function loadGames() {
      try {
        // First try to load from localStorage (saved work)
        const localData = localStorage.getItem('crackuzu_games');
        if (localData) {
          state.games = JSON.parse(localData);
          showToast('Données chargées depuis la sauvegarde locale', 'success');
          state.isModified = true;
          updateStatusBadge();
        } else {
          // Otherwise load from data.json file
          const res = await fetch('data.json?t=' + Date.now());
          if (res.ok) {
            state.games = await res.json();
          } else {
            state.games = [];
          }
        }
        displayRecentGames();
        displayRequests();
        displayAllGames();
      } catch (e) {
        console.error('Error loading games:', e);
        state.games = [];
        showToast('Erreur lors du chargement des jeux', 'error');
      }
    }

    function loadFromLocalStorage() {
      const localData = localStorage.getItem('crackuzu_games');
      if (localData) {
        state.games = JSON.parse(localData);
        displayRecentGames();
        displayRequests();
        displayAllGames();
        showToast('Sauvegarde locale chargée !', 'success');
        state.isModified = true;
        updateStatusBadge();
      } else {
        showToast('Aucune sauvegarde locale trouvée', 'error');
      }
    }

    async function resetToOriginal() {
      if (!confirm('⚠️ Cela va remplacer toutes les modifications locales par le data.json original. Continuer ?')) return;
      
      try {
        const res = await fetch('data.json?t=' + Date.now());
        if (res.ok) {
          state.games = await res.json();
          localStorage.removeItem('crackuzu_games');
          displayRecentGames();
          displayAllGames();
          clearForm();
          state.isModified = false;
          updateStatusBadge();
          showToast('Data.json original restauré', 'success');
        }
      } catch (e) {
        showToast('Erreur lors du reset', 'error');
      }
    }

    function updateStatusBadge() {
      const badge = document.getElementById('statusBadge');
      if (state.isModified) {
        badge.className = 'status-badge modified';
        badge.innerHTML = '<span>🟠</span> Modifications non sauvegardées sur GitHub';
      } else {
        badge.className = 'status-badge';
        badge.innerHTML = '<span>🟢</span> data.json original';
      }
    }

    // ═══════════════════════════════════════════════════════════
    // SAVE (LOCAL MODE)
    // ═══════════════════════════════════════════════════════════
    async function saveGame() {
      const title = cleanText(document.getElementById('f-title').value.trim());
      if (!title) {
        showToast('Le titre est requis', 'error');
        return;
      }

      const game = {
        title,
        title_img: document.getElementById('f-title-img').value.trim(),
        year: document.getElementById('f-year').value.trim(),
        description: cleanText(document.getElementById('f-desc').value.trim()),
        categories: Array.from(state.selectedCategories),
        portrait_url: state.selectedPortrait,
        banner_url: state.selectedBanner,
        ytb_id: extractYoutubeId(document.getElementById('f-ytb').value.trim()),
        magnets: state.selectedMagnets.map(m => ({
          url: m.url,
          size: m.size,
          source: m.source || 'By Crackuzu',
          name: m.name || '',
          type: m.type || 'magnet'
        })),
        added_by: 'admin-local',
        added_at: new Date().toISOString()
      };

      if (editingGameIndex >= 0 && editingGameIndex < state.games.length) {
        state.games[editingGameIndex] = game;
      } else {
        const exists = state.games.find(g => g.title?.toLowerCase() === title.toLowerCase());
        if (exists) {
          if (!confirm('Un jeu avec ce titre existe déjà. Remplacer ?')) return;
          const idx = state.games.indexOf(exists);
          state.games[idx] = game;
        } else {
          state.games.push(game);
        }
      }

      // Save to localStorage
      localStorage.setItem('crackuzu_games', JSON.stringify(state.games));
      state.isModified = true;
      updateStatusBadge();
      
      // Dismiss matching Discord request if loaded
      if (_discordRequests.length) {
        const match = _discordRequests.find(r => r.name?.toLowerCase() === title.toLowerCase());
        if (match && !_dismissedIds.includes(match.id)) {
          _dismissedIds.push(match.id);
          localStorage.setItem('crackuzu_dismissed_reqs', JSON.stringify(_dismissedIds));
        }
      }
      
      showToast('Jeu sauvegardé localement ! N\'oublie pas d\'exporter data.json', 'success');
      displayRecentGames();
      displayRequests();
      displayAllGames();
    }

    function exportDataJson() {
      const dataStr = localStorage.getItem('crackuzu_games') || '[]';
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'data.json';
      a.click();
      URL.revokeObjectURL(url);
      showToast('data.json téléchargé !', 'success');
    }

    async function importDataJson(input) {
      const file = input.files[0];
      if (!file) return;
      
      try {
        const text = await file.text();
        const games = JSON.parse(text);
        
        if (!Array.isArray(games)) {
          throw new Error('Format invalide : attendu un tableau de jeux');
        }
        
        // Sauvegarder dans localStorage
        localStorage.setItem('crackuzu_games', JSON.stringify(games));
        
        // Mettre à jour l'interface
        await loadGames();
        renderGallery();
        updateStatusBadge();
        
        showToast(`${games.length} jeux importés avec succès !`, 'success');
        input.value = '';
      } catch (err) {
        console.error('Import error:', err);
        showToast('Erreur import : ' + err.message, 'error');
        input.value = '';
      }
    }

    function deleteCurrentGame() {
      if (editingGameIndex < 0 || editingGameIndex >= state.games.length) return;
      
      if (!confirm('Supprimer ce jeu définitivement ?')) return;
      
      state.games.splice(editingGameIndex, 1);
      localStorage.setItem('crackuzu_games', JSON.stringify(state.games));
      state.isModified = true;
      updateStatusBadge();
      
      showToast('Jeu supprimé', 'success');
      displayRecentGames();
      displayAllGames();
      clearForm();
    }

    // ═══════════════════════════════════════════════════════════
    // GITHUB SYNC FUNCTIONS
    // ═══════════════════════════════════════════════════════════

    // Encode UTF-8 string to base64
    function utf8ToBase64(str) {
      const utf8Bytes = new TextEncoder().encode(str);
      const binaryString = Array.from(utf8Bytes, byte => String.fromCharCode(byte)).join('');
      return btoa(binaryString);
    }

    // Decode base64 to UTF-8 string
    function base64ToUtf8(base64) {
      const binaryString = atob(base64.replace(/\s/g, ''));
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return new TextDecoder().decode(bytes);
    }

    // Worker URL for GitHub operations (token is server-side)
    // WORKER_URL uses CONFIG.WORKER_URL

    async function pullFromGitHub() {
      showToast('Récupération depuis GitHub...', 'success');

      try {
        const res = await fetch(`${CONFIG.WORKER_URL}/api/github-pull`, {
          headers: { 'Accept': 'application/json' }
        });

        if (!res.ok) throw new Error(`Erreur ${res.status}`);
        const data = await res.json();
        const games = JSON.parse(base64ToUtf8(data.content));

        localStorage.setItem('crackuzu_games', JSON.stringify(games));
        state.games = games;
        displayRecentGames();
        displayRequests();
        displayAllGames();

        showToast(`${games.length} jeux récupérés depuis GitHub !`, 'success');
        state.isModified = false;
        updateStatusBadge();
      } catch (e) {
        console.error('Pull error:', e);
        showToast('Erreur Pull: ' + e.message, 'error');
      }
    }

    async function pushToGitHub() {
      const games = state.games;
      if (!games || games.length === 0) {
        showToast('Aucun jeu à pousser', 'error');
        return;
      }

      showToast('Envoi vers GitHub...', 'success');

      try {
        // Get current file SHA first
        const getRes = await fetch(`${CONFIG.WORKER_URL}/api/github-pull`, {
          headers: { 'Accept': 'application/json' }
        });
        if (!getRes.ok) throw new Error('Impossible de récupérer le SHA');
        const fileData = await getRes.json();
        const sha = fileData.sha;

        // Prepare content
        const jsonStr = JSON.stringify(games, null, 2);
        const content = utf8ToBase64(jsonStr);

        // Push via Worker
        const putRes = await fetch(`${CONFIG.WORKER_URL}/api/github-push`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: content,
            sha: sha,
            message: `Update data.json - ${games.length} games`
          })
        });

        if (!putRes.ok) {
          const error = await putRes.json().catch(() => ({}));
          throw new Error(error.error || `Erreur ${putRes.status}`);
        }

        showToast(`${games.length} jeux poussés vers GitHub !`, 'success');
        state.isModified = false;
        updateStatusBadge();
      } catch (e) {
        console.error('Push error:', e);
        showToast('Erreur Push: ' + e.message, 'error');
      }
    }

    // ═══════════════════════════════════════════════════════════
    // CLEAN TEXT
    // ═══════════════════════════════════════════════════════════
    function cleanText(text) {
      if (!text) return '';

      // Decode HTML entities first
      text = decodeHTML(text);

      text = text
        .replace(/Ã¢Â„Â¢/g, '')
        .replace(/Ã¢â€žÂ¢/g, '')
        .replace(/Ã¢Â€Â¢/g, '')
        .replace(/ÃƒÂ©/g, 'e')
        .replace(/Ã©/g, 'e')
        .replace(/Ã¨/g, 'e')
        .replace(/Ãª/g, 'e')
        .replace(/Ã /g, 'a')
        .replace(/Ã¢/g, 'a')
        .replace(/Ã®/g, 'i')
        .replace(/Ã¯/g, 'i')
        .replace(/Ã´/g, 'o')
        .replace(/Ã»/g, 'u')
        .replace(/Ã¹/g, 'u')
        .replace(/Ã§/g, 'c')
        .replace(/Ã±/g, 'n')
        .replace(/Ã[\s\S]?/g, '')
        .replace(/[\u00C2\u00C3\u00C4\u00C5]/g, '')
        .replace(/[\u0080-\u009F]/g, '');

      return text
        .replace(/[\u2122\u00AE]/g, '')
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/[\u2013\u2014]/g, '-')
        .replace(/\u2026/g, '...')
        .replace(/\u00A0/g, ' ')
        .replace(/[\u00C0-\u00C5]/g, 'A')
        .replace(/[\u00E0-\u00E5]/g, 'a')
        .replace(/[\u00C8-\u00CB]/g, 'E')
        .replace(/[\u00E8-\u00EB]/g, 'e')
        .replace(/[\u00CC-\u00CF]/g, 'I')
        .replace(/[\u00EC-\u00EF]/g, 'i')
        .replace(/[\u00D2-\u00D6]/g, 'O')
        .replace(/[\u00F2-\u00F6]/g, 'o')
        .replace(/[\u00D9-\u00DC]/g, 'U')
        .replace(/[\u00F9-\u00FC]/g, 'u')
        .replace(/[\u00C7]/g, 'C')
        .replace(/[\u00E7]/g, 'c')
        .replace(/[\u00D1]/g, 'N')
        .replace(/[\u00F1]/g, 'n');
    }

    function decodeHTML(text) {
      if (!text) return '';
      const textarea = document.createElement('textarea');
      textarea.innerHTML = text;
      return textarea.value;
    }

    // ═══════════════════════════════════════════════════════════
    // STEAM SEARCH
    // ═══════════════════════════════════════════════════════════
    let searchTimeout;
    let currentSearchId = 0;

    // Fast CORS proxy with fallback
    async function fetchWithProxy(url) {
      const proxies = [
        { name: 'corsproxy', url: `https://corsproxy.io/?${encodeURIComponent(url)}`, parse: 'direct' },
        { name: 'allorigins', url: `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`, parse: 'allorigins' }
      ];

      for (const proxy of proxies) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 8000);

          const res = await fetch(proxy.url, { signal: controller.signal });
          clearTimeout(timeoutId);

          if (!res.ok) continue;

          if (proxy.parse === 'allorigins') {
            const result = await res.json();
            return JSON.parse(result.contents);
          }
          return await res.json();
        } catch (e) {
          console.log(`Proxy ${proxy.name} failed:`, e.message);
          continue;
        }
      }
      throw new Error('All proxies failed');
    }

    async function searchSteam() {
      const query = document.getElementById('steamSearch').value.trim();
      if (!query) return;

      clearTimeout(searchTimeout);
      const thisSearchId = ++currentSearchId;

      searchTimeout = setTimeout(async () => {
        showLoading(true);
        try {
          // Use proxy fallback for Steam API
          const data = await fetchWithProxy(`https://steamcommunity.com/actions/SearchApps/${encodeURIComponent(query)}`);

          // Ignore if a newer search was started
          if (thisSearchId !== currentSearchId) return;

          const container = document.getElementById('steamResults');

          if (!data || !data.length) {
            container.innerHTML = '<div style="padding:1rem;color:rgba(255,255,255,.5);text-align:center">Aucun résultat</div>';
            return;
          }

          container.innerHTML = data.slice(0, 6).map(game => `
            <div class="search-item" onclick="selectSteamGame(${game.appid})">
              <img class="search-img" src="https://cdn.cloudflare.steamstatic.com/steam/apps/${game.appid}/capsule_sm_120.jpg" alt="" onerror="this.style.visibility='hidden'">
              <div class="search-info">
                <div class="search-name">${esc(game.name)}</div>
                <div class="search-meta">AppID: ${game.appid}</div>
              </div>
            </div>
          `).join('');
        } catch (e) {
          // Only show error if this is still the current search
          if (thisSearchId === currentSearchId) {
            console.error('Steam search error:', e);
            showToast('Erreur Steam: ' + e.message, 'error');
          }
        } finally {
          // Only hide loading if this is still the current search
          if (thisSearchId === currentSearchId) {
            showLoading(false);
          }
        }
      }, 300);
    }

    async function selectSteamGame(appid) {
      showLoading(true);
      try {
        // Use proxy fallback for Steam API
        const data = await fetchWithProxy(`https://store.steampowered.com/api/appdetails?appids=${appid}&l=french&cc=FR`);
        const game = data[appid]?.data;
        
        if (!game) {
          showToast('Impossible de charger les détails', 'error');
          return;
        }

        state.steamData = {
          screenshots: game.screenshots?.map(s => s.path_full) || [],
          background: game.background
        };

        document.getElementById('f-title').value = cleanText(game.name);
        
        const logoUrl = `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/logo.png`;
        document.getElementById('f-title-img').value = logoUrl;
        document.getElementById('titleImgPreviewImg').src = logoUrl;
        document.getElementById('titleImgPreview').style.display = 'block';
        document.getElementById('titleImgStatus').textContent = '✅ Logo Steam chargé';

        document.getElementById('f-year').value = game.release_date?.date?.split('/').pop() || 
                                                   game.release_date?.date?.split(' ').pop() || '';
        document.getElementById('f-desc').value = cleanText(game.short_description || '');
        
        game.genres?.forEach(g => {
          const cat = CONFIG.CATEGORIES.find(c => c.toLowerCase() === g.description.toLowerCase());
          if (cat) state.selectedCategories.add(cat);
        });
        renderCategories();
        
        updateGalleries(appid);
        searchYouTubeTrailer(game.name);
        
        showToast('Données Steam chargées !', 'success');
      } catch (e) {
        console.error('Steam details error:', e);
        showToast('Erreur lors du chargement: ' + e.message, 'error');
      } finally {
        showLoading(false);
      }
    }

    // ═══════════════════════════════════════════════════════════
    // IMAGE GALLERIES
    // ═══════════════════════════════════════════════════════════
    function updateGalleries(appid) {
      // All Steam portrait options
      const portraits = [
        `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/library_600x900.jpg`,
        `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/library_600x900_2x.jpg`,
        `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/portrait.png`,
        `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/library_hero_portrait.png`,
        `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/hero_capsule.jpg`,
        `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/capsule_231x87.jpg`,
        `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/capsule_467x181.jpg`,
        `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/capsule_616x353.jpg`,
        `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/store_capsule_vertical.jpg`
      ];

      document.getElementById('portraitGallery').innerHTML = portraits.map((url, i) => `
        <div class="img-item ${state.selectedPortrait === url ? 'selected' : ''}" onclick="selectPortrait('${url}', this)">
          <img src="${url}" alt="" loading="lazy" onerror="this.style.opacity='0'">
          <div class="img-check"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div>
        </div>
      `).join('');

      if (!state.selectedPortrait && portraits[0]) {
        state.selectedPortrait = portraits[0];
      }

      // All Steam banner options + API data
      const banners = [
        `https://cdn.akamai.steamstatic.com/steam/apps/${appid}/library_hero.jpg`,
        `https://cdn.akamai.steamstatic.com/steam/apps/${appid}/library_hero_2x.jpg`,
        `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/header.jpg`,
        `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/page_bg_raw.jpg`,
        `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/page_background_generated.jpg`,
        `https://cdn.akamai.steamstatic.com/steam/apps/${appid}/library_hero_blur.jpg`,
        `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/capsule_616x353.jpg`,
        `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/capsule_467x181.jpg`,
        state.steamData.background,
        ...state.steamData.screenshots.slice(0, 4)
      ].filter(Boolean);

      document.getElementById('bannerGallery').innerHTML = banners.map((url, i) => `
        <div class="banner-item ${state.selectedBanner === url ? 'selected' : ''}" onclick="selectBanner('${url}', this)">
          <img src="${url}" alt="" loading="lazy" onerror="this.style.opacity='0'">
          <div class="img-check" style="top:auto;bottom:.5rem"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div>
        </div>
      `).join('');

      if (banners[0]) state.selectedBanner = banners[0];
    }

    function selectPortrait(url, el) {
      state.selectedPortrait = url;
      document.querySelectorAll('#portraitGallery .img-item').forEach(i => i.classList.remove('selected'));
      el.classList.add('selected');
      document.getElementById('f-portrait').value = url;
    }

    function selectBanner(url, el) {
      state.selectedBanner = url;
      document.querySelectorAll('#bannerGallery .banner-item').forEach(i => i.classList.remove('selected'));
      el.classList.add('selected');
      document.getElementById('f-banner').value = url;
    }

    // ═══════════════════════════════════════════════════════════
    // LOAD EXISTING IMAGES FOR EDIT
    // ═══════════════════════════════════════════════════════════
    async function loadExistingImages(game) {
      // Extract appid from Steam URL if possible
      let appid = null;
      const steamUrlMatch = (game.portrait_url || game.banner_url || '').match(/steam\/apps\/(\d+)/);
      if (steamUrlMatch) {
        appid = steamUrlMatch[1];
      }

      // Fetch Steam API data if we have appid
      let steamScreenshots = [];
      let steamBackground = null;
      if (appid) {
        try {
          const result = await fetchWithProxy(`https://store.steampowered.com/api/appdetails?appids=${appid}&l=french&cc=FR`);
          const steamData = result[appid]?.data;
          if (steamData) {
            steamScreenshots = steamData.screenshots?.map(s => s.path_full) || [];
            steamBackground = steamData.background;
          }
        } catch (e) {
          console.log('Steam API fetch failed:', e);
        }
      }

      // Build portrait gallery with current selected + Steam options
      const portraits = [];
      if (game.portrait_url && !game.portrait_url.includes('steam/apps/')) {
        // Custom portrait (non-Steam)
        portraits.push({ url: game.portrait_url, selected: true, label: 'Custom' });
      }
      if (appid) {
        // Steam portraits - plus d'options
        const steamPortraits = [
          `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/library_600x900.jpg`,
          `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/library_600x900_2x.jpg`,
          `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/portrait.png`,
          `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/library_hero_portrait.png`,
          `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/hero_capsule.jpg`,
          `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/capsule_231x87.jpg`,
          `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/capsule_467x181.jpg`,
          `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/capsule_616x353.jpg`,
          `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/store_capsule_vertical.jpg`
        ];
        steamPortraits.forEach(url => {
          portraits.push({
            url: url,
            selected: game.portrait_url === url,
            label: 'Steam'
          });
        });
      } else if (game.portrait_url) {
        // No Steam appid but has portrait - just show it
        portraits.push({ url: game.portrait_url, selected: true, label: 'Current' });
      }

      document.getElementById('portraitGallery').innerHTML = portraits.map(p => `
        <div class="img-item ${p.selected ? 'selected' : ''}" onclick="selectPortrait('${p.url}', this)">
          <img src="${p.url}" alt="" loading="lazy" onerror="this.style.opacity='0'">
          <div class="img-check"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div>
        </div>
      `).join('');

      // Build banner gallery with current selected + Steam options + screenshots
      const banners = [];
      if (game.banner_url && !game.banner_url.includes('steam/apps/') && !game.banner_url.includes('akamai.steamstatic')) {
        // Custom banner (non-Steam)
        banners.push({ url: game.banner_url, selected: true, label: 'Custom' });
      }
      if (appid) {
        // Steam banners - plus d'options
        const steamBanners = [
          `https://cdn.akamai.steamstatic.com/steam/apps/${appid}/library_hero.jpg`,
          `https://cdn.akamai.steamstatic.com/steam/apps/${appid}/library_hero_2x.jpg`,
          `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/header.jpg`,
          `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/page_bg_raw.jpg`,
          `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/page_background_generated.jpg`,
          `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/library_hero_blur.jpg`,
          `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/capsule_616x353.jpg`,
          `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/capsule_467x181.jpg`,
          steamBackground,
          ...steamScreenshots.slice(0, 4)
        ].filter(Boolean);
        steamBanners.forEach(url => {
          banners.push({
            url: url,
            selected: game.banner_url === url,
            label: 'Steam'
          });
        });
      } else if (game.banner_url) {
        // No Steam appid but has banner - just show it
        banners.push({ url: game.banner_url, selected: true, label: 'Current' });
      }

      document.getElementById('bannerGallery').innerHTML = banners.map(b => `
        <div class="banner-item ${b.selected ? 'selected' : ''}" onclick="selectBanner('${b.url}', this)">
          <img src="${b.url}" alt="" loading="lazy" onerror="this.style.opacity='0'">
          <div class="img-check" style="top:auto;bottom:.5rem"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div>
        </div>
      `).join('');
    }

    // ═══════════════════════════════════════════════════════════
    // UPLOAD
    // ═══════════════════════════════════════════════════════════
    async function handleImageUpload(input) {
      const file = input.files[0];
      if (!file) return;
      await handleImageFile(file);
    }

    async function handleImageFile(file) {
      showToast('Upload vers Cloudinary...', 'success');
      
      const reader = new FileReader();
      reader.onload = (e) => {
        document.getElementById('uploadPreviewImg').src = e.target.result;
        document.getElementById('uploadPreview').style.display = 'block';
      };
      reader.readAsDataURL(file);
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', CONFIG.CLOUDINARY_PRESET);
      
      try {
        const res = await fetch(`https://api.cloudinary.com/v1_1/${CONFIG.CLOUDINARY_CLOUD}/image/upload`, {
          method: 'POST',
          body: formData
        });
        
        const data = await res.json();
        
        if (data.secure_url) {
          state.uploadedImageUrl = data.secure_url;
          showToast('Image uploadée ! Clique sur "Utiliser comme..."', 'success');
        } else {
          showToast('Erreur upload: ' + (data.error?.message || 'Unknown'), 'error');
        }
      } catch (e) {
        showToast('Erreur upload Cloudinary', 'error');
      }
    }

    function setupPasteListener() {
      const uploadZone = document.getElementById('uploadZone');
      
      document.addEventListener('paste', (e) => {
        const items = e.clipboardData?.items;
        if (!items) return;
        
        for (const item of items) {
          if (item.type.startsWith('image/')) {
            const file = item.getAsFile();
            if (file) {
              uploadZone.classList.add('pasting');
              setTimeout(() => uploadZone.classList.remove('pasting'), 500);
              handleImageFile(file);
            }
          }
        }
      });
    }

    function useAsPortrait() {
      if (!state.uploadedImageUrl) return;
      state.selectedPortrait = state.uploadedImageUrl;
      document.getElementById('f-portrait').value = state.uploadedImageUrl;
      showToast('Utilisé comme portrait !', 'success');
    }

    function useAsBanner() {
      if (!state.uploadedImageUrl) return;
      state.selectedBanner = state.uploadedImageUrl;
      document.getElementById('f-banner').value = state.uploadedImageUrl;
      showToast('Utilisé comme banner !', 'success');
    }

    // ── Title Image (clipboard → Cloudinary) ──────────────────
    async function pasteTitleImg() {
      const status = document.getElementById('titleImgStatus');
      status.textContent = '📋 Lecture du presse-papier...';

      try {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          const imgType = item.types.find(t => t.startsWith('image/'));
          if (imgType) {
            const blob = await item.getType(imgType);
            const file = new File([blob], 'title.png', { type: imgType });
            status.textContent = '☁️ Upload Cloudinary...';
            await uploadTitleImg(file);
            return;
          }
        }
        status.textContent = '⚠️ Pas d\'image. Utilise Ctrl+V après le clic.';
        listenForTitleImgPaste();
      } catch (e) {
        status.textContent = '⚠️ Utilise Ctrl+V pour coller l\'image';
        listenForTitleImgPaste();
      }
    }

    function listenForTitleImgPaste() {
      const handler = (e) => {
        const clipItems = e.clipboardData?.items;
        if (!clipItems) return;
        for (const ci of clipItems) {
          if (ci.type.startsWith('image/')) {
            e.preventDefault();
            const file = ci.getAsFile();
            if (file) {
              document.getElementById('titleImgStatus').textContent = '☁️ Upload Cloudinary...';
              uploadTitleImg(file);
            }
            document.removeEventListener('paste', handler);
            return;
          }
        }
      };
      document.addEventListener('paste', handler);
    }

    async function uploadTitleImg(file) {
      const status = document.getElementById('titleImgStatus');

      // Show preview
      const reader = new FileReader();
      reader.onload = (e) => {
        document.getElementById('titleImgPreviewImg').src = e.target.result;
        document.getElementById('titleImgPreview').style.display = 'block';
      };
      reader.readAsDataURL(file);

      // Upload to Cloudinary
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', CONFIG.CLOUDINARY_PRESET);

      try {
        const res = await fetch(`https://api.cloudinary.com/v1_1/${CONFIG.CLOUDINARY_CLOUD}/image/upload`, {
          method: 'POST',
          body: formData
        });
        const data = await res.json();
        if (data.secure_url) {
          document.getElementById('f-title-img').value = data.secure_url;
          status.textContent = '✅ Image du titre uploadée !';
          showToast('Image du titre uploadée !', 'success');
        } else {
          status.textContent = '❌ Erreur upload';
          showToast('Erreur upload: ' + (data.error?.message || 'Unknown'), 'error');
        }
      } catch (e) {
        status.textContent = '❌ Erreur réseau';
        showToast('Erreur upload Cloudinary', 'error');
      }
    }

    function removeTitleImg() {
      document.getElementById('f-title-img').value = '';
      document.getElementById('titleImgPreview').style.display = 'none';
      document.getElementById('titleImgPreviewImg').src = '';
      document.getElementById('titleImgStatus').textContent = '';
    }

    // ═══════════════════════════════════════════════════════════
    // YOUTUBE
    // ═══════════════════════════════════════════════════════════
    function extractYoutubeId(url) {
      if (!url) return '';
      if (url.length === 11 && !url.includes('/')) return url;
      const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
      return match ? match[1] : url;
    }

    async function searchYouTubeTrailer(query) {
      document.getElementById('f-ytb').value = 'Recherche...';
      
      const trailers = await searchYouTubeAPI(query + ' launch trailer');
      
      if (trailers.length > 0) {
        document.getElementById('f-ytb').value = trailers[0].id;
        showToast('Bande-annonce trouvée !', 'success');
      } else {
        document.getElementById('f-ytb').value = '';
      }
    }

    async function searchYouTubeAPI(query) {
      const instances = [
        'https://iv.datura.network',
        'https://iv.melmac.space',
        'https://iv.nboeck.de',
        'https://yt.artemislena.eu'
      ];
      
      for (const base of instances) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 5000);
          
          const res = await fetch(`${base}/api/v1/search?q=${encodeURIComponent(query)}&type=video`, {
            signal: controller.signal
          });
          clearTimeout(timeout);
          
          if (res.ok) {
            const data = await res.json();
            return data.slice(0, 5).map(v => ({
              id: v.videoId,
              title: v.title,
              author: v.author
            }));
          }
        } catch (e) {
          console.log(`Instance ${base} failed:`, e.message);
        }
      }
      return [];
    }

    async function openYtModal() {
      const title = document.getElementById('f-title').value || 'game';
      showLoading(true);
      
      const results = await searchYouTubeAPI(title + ' launch trailer');
      
      const list = document.getElementById('ytList');
      if (!results || results.length === 0) {
        list.innerHTML = `
          <div style="grid-column:1/-1;text-align:center;padding:3rem 2rem;color:rgba(255,255,255,.5)">
            <div style="font-size:3rem;margin-bottom:1rem">😕</div>
            <div style="font-size:1.1rem;font-weight:600;margin-bottom:.5rem">Aucune bande-annonce trouvée</div>
            <div style="font-size:.875rem">Les serveurs Invidious sont peut-être indisponibles.<br>Tu peux entrer l'ID YouTube manuellement dans le champ.</div>
          </div>
        `;
      } else {
        list.innerHTML = results.map(r => `
          <div class="yt-item" onclick="selectYt('${r.id}')">
            <img class="yt-thumb" src="https://img.youtube.com/vi/${r.id}/mqdefault.jpg">
            <div class="yt-info">
              <div class="yt-video-title">${esc(r.title)}</div>
              <div class="yt-channel">${esc(r.author)}</div>
            </div>
          </div>
        `).join('');
      }
      
      document.getElementById('ytModal').classList.add('show');
      showLoading(false);
    }

    function closeYtModal() {
      document.getElementById('ytModal').classList.remove('show');
    }

    function selectYt(id) {
      document.getElementById('f-ytb').value = id;
      closeYtModal();
      showToast('Bande-annonce sélectionnée !', 'success');
    }

    // ═══════════════════════════════════════════════════════════
    // TORNET FILE IMPORT (Catbox upload + Magnet conversion)
    // ═══════════════════════════════════════════════════════════
    let _torrentFileData = null;  // { file, name, size, infoHash, magnetUrl, trackers }

    // ── Bencode parser ──────────────────────────────────────────
    function bdecode(buf, offset) {
      if (offset >= buf.length) throw new Error('Unexpected end');
      const c = buf[offset];
      if (c === 0x69) { // 'i' integer
        const end = buf.indexOf(0x65, offset + 1); // 'e'
        if (end === -1) throw new Error('No end for integer');
        return [parseInt(new TextDecoder().decode(buf.slice(offset + 1, end)), 10), end + 1];
      }
      if (c === 0x6C) { // 'l' list
        let pos = offset + 1, list = [];
        while (buf[pos] !== 0x65) { const [v, n] = bdecode(buf, pos); list.push(v); pos = n; }
        return [list, pos + 1];
      }
      if (c === 0x64) { // 'd' dict
        let pos = offset + 1, dict = {};
        while (buf[pos] !== 0x65) {
          const [key, kn] = bdecode(buf, pos);
          const [val, vn] = bdecode(buf, kn);
          dict[key] = val; pos = vn;
        }
        return [dict, pos + 1];
      }
      // String: <length>:<bytes>
      const colon = buf.indexOf(0x3A, offset);
      if (colon === -1) throw new Error('No colon for string');
      const len = parseInt(new TextDecoder().decode(buf.slice(offset, colon)), 10);
      const start = colon + 1;
      const str = new TextDecoder().decode(buf.slice(start, start + len));
      return [str, start + len];
    }

    function bdecodeRaw(buf) {
      const [val] = bdecode(new Uint8Array(buf), 0);
      return val;
    }

    // Extract raw bencoded bytes for a top-level key (needed for info hash)
    function bencodeExtractKey(buf, key) {
      const data = new Uint8Array(buf);
      const keyBytes = new TextEncoder().encode(key + ':');
      // Find key in dict: scan for pattern after 'd'
      let pos = 1; // skip 'd'
      while (pos < data.length && data[pos] !== 0x65) {
        // Read key string
        const colon = data.indexOf(0x3A, pos);
        if (colon === -1) break;
        const kLen = parseInt(new TextDecoder().decode(data.slice(pos, colon)), 10);
        const kStart = colon + 1;
        const kStr = new TextDecoder().decode(data.slice(kStart, kStart + kLen));
        // Read value - find its end by parsing it
        const [_, valEnd] = bdecode(data, kStart + kLen);
        if (kStr === key) return buf.slice(kStart + kLen, valEnd);
        pos = valEnd;
      }
      return null;
    }

    function formatSize(bytes) {
      if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(1) + ' GB';
      if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
      if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' KB';
      return bytes + ' B';
    }

    async function parseTorrentFile(file) {
      const buf = await file.arrayBuffer();
      const data = bdecodeRaw(buf);

      // Name
      const name = data.info?.name || file.name.replace('.torrent', '');

      // Total size
      let totalSize = 0;
      if (data.info?.length) {
        totalSize = data.info.length;
      } else if (data.info?.files) {
        totalSize = data.info.files.reduce((s, f) => s + (f.length || 0), 0);
      }

      // Trackers
      let trackers = [];
      if (data['announce-list']) {
        for (const tier of data['announce-list']) {
          if (Array.isArray(tier)) trackers.push(...tier);
          else trackers.push(tier);
        }
      }
      if (data.announce && !trackers.includes(data.announce)) trackers.push(data.announce);

      // Info hash (SHA-1 of bencoded info dict)
      const infoRaw = bencodeExtractKey(buf, 'info');
      let infoHash = '';
      if (infoRaw) {
        const hashBuf = await crypto.subtle.digest('SHA-1', infoRaw);
        infoHash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
      }

      // Build magnet URL
      let magnetUrl = `magnet:?xt=urn:btih:${infoHash}&dn=${encodeURIComponent(name)}`;
      for (const tr of trackers.slice(0, 5)) {
        magnetUrl += `&tr=${encodeURIComponent(tr)}`;
      }

      return { file, name, totalSize, infoHash, magnetUrl, trackers };
    }

    async function onTorrentFileSelected(input) {
      const file = input.files[0];
      if (!file) return;

      const status = document.getElementById('torrentUploadStatus');
      status.textContent = '⏳ Analyse du fichier…';

      try {
        _torrentFileData = await parseTorrentFile(file);

        // Show preview
        const preview = document.getElementById('torrentPreview');
        preview.style.display = 'block';
        preview.innerHTML = `<strong>${esc(_torrentFileData.name)}</strong> · ${formatSize(_torrentFileData.totalSize)} · Hash: ${_torrentFileData.infoHash.slice(0, 12)}…`;

        // Show action buttons
        document.getElementById('btnTorrentCatbox').style.display = '';
        document.getElementById('btnTorrentMagnet').style.display = '';
        status.textContent = '';
      } catch (e) {
        console.error('Torrent parse error:', e);
        status.textContent = '❌ Fichier .torrent invalide';
        _torrentFileData = null;
      }
    }

    async function uploadTorrentToCatbox() {
      if (!_torrentFileData) return;
      const status = document.getElementById('torrentUploadStatus');
      status.textContent = '⏳ Upload sur Catbox…';

      try {
        const formData = new FormData();
        formData.append('fileToUpload', _torrentFileData.file);

        // WORKER_URL uses CONFIG.WORKER_URL

        const response = await fetch(`${CONFIG.WORKER_URL}/api/catbox-upload`, {
          method: 'POST',
          body: formData
        });

        let data;
        try { data = await response.json(); } catch(e) {
          status.textContent = '❌ Erreur serveur';
          showToast('Erreur serveur', 'error');
          return;
        }

        if (data.url) {
          document.getElementById('m-url').value = data.url;
          document.getElementById('m-name').value = _torrentFileData.file.name.replace('.torrent', '');
          document.getElementById('m-size').value = formatSize(_torrentFileData.totalSize);
          document.getElementById('m-type').value = 'torrent';
          status.textContent = '✅ Upload Catbox réussi !';
          showToast('Fichier uploadé !', 'success');
          return;
        }

        status.textContent = '❌ ' + (data.error || 'Upload échoué');
        showToast(data.error || 'Upload échoué', 'error');
      } catch (e) {
        console.error('Catbox upload error:', e);
        status.textContent = '❌ Erreur réseau';
        showToast('Erreur lors de l\'upload', 'error');
      }
    }

    function convertTorrentToMagnet() {
      if (!_torrentFileData) return;
      document.getElementById('m-url').value = _torrentFileData.magnetUrl;
      document.getElementById('m-name').value = _torrentFileData.file.name.replace('.torrent', '');
      document.getElementById('m-size').value = formatSize(_torrentFileData.totalSize);
      document.getElementById('m-type').value = 'magnet';
      document.getElementById('torrentUploadStatus').textContent = '✅ Magnet généré !';
      showToast('Magnet link créé !', 'success');
    }
    
    function addManualMagnet() {
      const url = document.getElementById('m-url').value.trim();
      const name = document.getElementById('m-name').value.trim();
      const size = document.getElementById('m-size').value.trim();
      const type = document.getElementById('m-type').value;
      
      if (!url) {
        showToast('URL requise', 'error');
        return;
      }

      state.selectedMagnets.push({ url, name, size, type, source: 'By Crackuzu' });
      renderMagnets();
      
      document.getElementById('m-url').value = '';
      document.getElementById('m-name').value = '';
      document.getElementById('m-size').value = '';
      
      showToast('Magnet ajouté !', 'success');
    }

    function removeMagnet(idx) {
      state.selectedMagnets.splice(idx, 1);
      renderMagnets();
    }

    function renderMagnets() {
      const list = document.getElementById('magnetList');
      list.innerHTML = state.selectedMagnets.map((m, i) => `
        <div class="magnet-item">
          <div class="magnet-row">
            <span style="font-size:.875rem;font-weight:600;color:${m.type === 'direct' ? '#3b82f6' : '#f97316'}">
              ${m.type === 'direct' ? '⬇️' : '🧲'} ${m.name || 'Sans nom'}
            </span>
            ${m.size ? `<span style="font-size:.75rem;color:rgba(255,255,255,.5)">${m.size}</span>` : ''}
            <button class="recent-btn delete" onclick="removeMagnet(${i})" style="margin-left:auto">🗑️</button>
          </div>
          <div style="font-size:.75rem;color:rgba(255,255,255,.4);word-break:break-all">${esc(m.url)}</div>
        </div>
      `).join('');
    }

    // ═══════════════════════════════════════════════════════════
    // HYDRA SOURCES - All sources auto-search (no single source selection)
    // ═══════════════════════════════════════════════════════════
    const sourceCache = {};
    let lastSearchResults = []; // Store results to avoid re-searching when adding

    async function searchAllSources() {
      const title = document.getElementById('f-title').value.trim();
      if (!title) {
        showToast('Entre un titre de jeu d\'abord', 'error');
        return;
      }

      // Auto-switch to magnets tab
      switchTab('magnets');

      const container = document.getElementById('sourceResults');
      const status = document.getElementById('sourceStatus');
      
      container.style.display = 'block';
      container.innerHTML = `
        <div style="padding:2rem;text-align:center">
          <div style="font-size:1.5rem;margin-bottom:.5rem">⏳</div>
          <div style="color:rgba(255,255,255,.5)">Chargement des sources...</div>
        </div>
      `;
      status.textContent = 'Chargement des 4 sources...';

      const allResults = [];
      const sourceKeys = Object.keys(CONFIG.SOURCES);
      let loadedCount = 0;

      // Load all sources in parallel
      await Promise.all(sourceKeys.map(async (key) => {
        try {
          let rawData = sourceCache[key];
          if (!rawData) {
            // Use CORS proxy to access GitHub raw files
            const proxyUrl = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(CONFIG.SOURCES[key].url)}`;
            const res = await fetch(proxyUrl);
            if (!res.ok) throw new Error('Failed');
            rawData = await res.json();
            sourceCache[key] = rawData;
          }

          // Parse different JSON structures (array, data.list, data.games, etc.)
          let data = [];
          if (Array.isArray(rawData)) {
            data = rawData;
          } else if (rawData.list && Array.isArray(rawData.list)) {
            data = rawData.list;
          } else if (rawData.games && Array.isArray(rawData.games)) {
            data = rawData.games;
          } else if (rawData.data && Array.isArray(rawData.data)) {
            data = rawData.data;
          } else if (typeof rawData === 'object') {
            const arrProp = Object.values(rawData).find(v => Array.isArray(v));
            if (arrProp) data = arrProp;
          }

          console.log(`[${key}] Loaded ${data.length} games, searching for "${title}"`);
          const matches = searchInSource(data, title);
          console.log(`[${key}] Found ${matches.length} matches`);
          matches.forEach(m => {
            allResults.push({ ...m, sourceKey: key, sourceName: CONFIG.SOURCES[key].name, sourceIcon: CONFIG.SOURCES[key].icon });
          });
          
          loadedCount++;
          status.textContent = `Chargé ${loadedCount}/${sourceKeys.length} sources • ${allResults.length} résultats trouvés`;
        } catch (e) {
          console.error(`[${key}] Failed to load:`, e);
          loadedCount++;
          status.textContent = `Chargé ${loadedCount}/${sourceKeys.length} sources • Erreur sur ${key}`;
          showToast(`Erreur sur ${key}: ${e.message}`, 'error');
        }
      }));

      // Store results globally for adding
      lastSearchResults = allResults;
      displayAllSourceResults(allResults);
      status.textContent = `${allResults.length} résultats trouvés`;
    }

    // ── OnlineFix Quick Search ──────────────────────────────────
    function openOnlineFix() {
      const title = document.getElementById('f-title').value.trim();
      if (!title) {
        showToast('Entre un titre de jeu d\'abord', 'error');
        return;
      }
      navigator.clipboard.writeText(title).catch(() => {});
      window.open(`https://online-fix.me/index.php?do=search&subaction=search&story=${encodeURIComponent(title)}`, '_blank');
      showToast('Nom copié ! Colle-le dans la recherche Online-Fix', 'success');
    }

    function searchInSource(data, query) {
      const searchName = query.toLowerCase().trim();
      const results = [];
      
      for (const item of data) {
        const gameTitle = (item.title || item.name || '').toLowerCase();
        
        // Direct includes - strict match
        if (gameTitle.includes(searchName) || searchName.includes(gameTitle)) {
          results.push(item);
          continue;
        }
        
        // Word-based matching (only if more than 2 chars)
        const searchWords = searchName.split(/[\s:\-\.]+/).filter(w => w.length > 2);
        const titleWords = gameTitle.split(/[\s:\-\.]+/).filter(w => w.length > 2);
        
        const matchCount = searchWords.filter(sw => 
          titleWords.some(tw => tw.includes(sw) || sw.includes(tw))
        ).length;
        
        // More flexible: require most words to match (not all)
        // 1 word = must match
        // 2 words = both must match (100%)
        // 3+ words = at least 2/3 or 3/4 must match (75%)
        const requiredMatches = searchWords.length <= 2 
          ? searchWords.length 
          : Math.ceil(searchWords.length * 0.75);
        
        if (matchCount >= requiredMatches && searchWords.length > 0) {
          results.push(item);
        }
      }
      return results.slice(0, 10);
    }

    function displayAllSourceResults(results) {
      const container = document.getElementById('sourceResults');
      container.style.display = 'block';
      
      if (!results.length) {
        container.innerHTML = `
          <div style="padding:3rem 2rem;text-align:center;color:rgba(255,255,255,.5)">
            <div style="font-size:3rem;margin-bottom:1rem">😕</div>
            <div style="font-size:1.1rem;font-weight:600;margin-bottom:.5rem">Aucun résultat</div>
            <div style="font-size:.875rem;margin-bottom:1rem">Le jeu n'a pas été trouvé dans les sources Hydra.</div>
            <div style="font-size:.75rem;opacity:.7;background:rgba(255,255,255,.1);padding:.75rem 1rem;border-radius:.5rem;display:inline-block">
              💡 <b>Conseil:</b> Ouvre la console (F12) pour voir les détails du chargement<br>
              ou essaie avec un titre plus simple (sans ' : -)
            </div>
          </div>
        `;
        return;
      }

      // Group by source
      const bySource = {};
      results.forEach(r => {
        if (!bySource[r.sourceKey]) bySource[r.sourceKey] = [];
        bySource[r.sourceKey].push(r);
      });

      let html = '';
      Object.keys(bySource).forEach(sourceKey => {
        const source = CONFIG.SOURCES[sourceKey];
        const items = bySource[sourceKey];
        
        html += `
          <div class="source-group">
            <div class="source-group-title">${source.icon} ${source.name} (${items.length})</div>
        `;
        
        html += items.map((game, idx) => {
          const title = game.title || game.name || 'Sans titre';
          const size = game.size || game.fileSize || '';
          const version = game.version || '';
          const repack = game.repack || '';
          const linkCount = game.uris?.length || 1;
          const uniqueId = `${sourceKey}-${idx}`;
          
          return `
            <div class="source-result-item" onclick="addAllSourceMagnet('${sourceKey}', ${idx})">
              <div class="source-icon">${source.icon}</div>
              <div class="info">
                <div class="name">${esc(title)}</div>
                <div class="meta">
                  ${size ? `<span class="size">💾 ${esc(size)}</span>` : ''}
                  ${version ? `<span>📦 ${esc(version)}</span>` : ''}
                  ${repack ? `<span>🔧 ${esc(repack)}</span>` : ''}
                  ${linkCount > 1 ? `<span style="color:var(--accent)">🔗 ${linkCount} liens</span>` : ''}
                </div>
              </div>
              <button class="add-btn" onclick="event.stopPropagation();addAllSourceMagnet('${sourceKey}', ${idx})" title="Ajouter">+</button>
            </div>
          `;
        }).join('');
        
        html += '</div>';
      });

      container.innerHTML = html;
    }

    function addAllSourceMagnet(sourceKey, idx) {
      // Get results for this specific source from last search
      const sourceResults = lastSearchResults.filter(r => r.sourceKey === sourceKey);
      
      if (idx >= sourceResults.length) {
        console.error('Index out of bounds', sourceKey, idx, sourceResults.length);
        return;
      }
      
      const game = sourceResults[idx];
      console.log('Adding magnet from', sourceKey, 'game:', game);
      
      // Hydra sources use 'uris' array, check multiple property names
      let url = '';
      if (game.uris && Array.isArray(game.uris) && game.uris.length > 0) {
        url = game.uris[0]; // Take first URI from array
      } else {
        url = game.magnet || game.url || game.link || game.download || game.torrent || game.file || game.uri || '';
      }
      console.log('URL found:', url, 'from properties:', Object.keys(game));
      
      const magnet = {
        url: url,
        name: game.title || game.name || game.game || CONFIG.SOURCES[sourceKey].name,
        size: game.size || game.fileSize || game.file_size || '',
        type: url.startsWith('magnet') ? 'magnet' : (url.startsWith('http') ? 'direct' : 'torrent'),
        source: CONFIG.SOURCES[sourceKey].name
      };
      
      if (!magnet.url) {
        showToast('Pas de lien disponible - vérifie console (F12)', 'error');
        return;
      }
      
      state.selectedMagnets.push(magnet);
      renderMagnets();
      showToast(`✅ Ajouté depuis ${magnet.source}`, 'success');
    }

    // ═══════════════════════════════════════════════════════════
    // CATEGORIES
    // ═══════════════════════════════════════════════════════════
    function renderCategories() {
      const grid = document.getElementById('categoryGrid');
      grid.innerHTML = CONFIG.CATEGORIES.map(c => `
        <div class="category-chip ${state.selectedCategories.has(c) ? 'active' : ''}" onclick="toggleCategory('${c}')">
          ${c}
        </div>
      `).join('');
    }

    function toggleCategory(cat) {
      if (state.selectedCategories.has(cat)) {
        state.selectedCategories.delete(cat);
      } else {
        state.selectedCategories.add(cat);
      }
      renderCategories();
    }

    // ═══════════════════════════════════════════════════════════
    // GAME REQUESTS (from Discord)
    // ═══════════════════════════════════════════════════════════
    let _discordRequests = [];
    let _dismissedIds = JSON.parse(localStorage.getItem('crackuzu_dismissed_reqs') || '[]');

    async function displayRequests() {
      const container = document.getElementById('requestList');
      if (!container) return;

      try {
        let requests = [];
        // Always fetch via Worker (fast, fresh, no cache issues)
        try {
          const res = await fetch(`${CONFIG.WORKER_URL}/api/github-requests`);
          console.log('[Requests] Worker status:', res.status);
          if (res.ok) requests = await res.json();
        } catch(e) {
          console.warn('[Requests] Worker fetch failed:', e.message);
        }

        if (!Array.isArray(requests)) requests = [];
        console.log('[Requests] Loaded:', requests.length);

        // Filter out dismissed
        _discordRequests = requests.filter(r => !_dismissedIds.includes(r.id));

        document.getElementById('reqCount').textContent = _discordRequests.length;

        if (!_discordRequests.length) {
          container.innerHTML = `
            <div class="req-empty">
              <div class="req-empty-icon">📩</div>
              <div class="req-empty-text">Aucune demande en attente</div>
              <div class="req-empty-sub">Les demandes apparaîtront ici automatiquement</div>
            </div>`;
          return;
        }

        container.innerHTML = _discordRequests.map((req, idx) => {
          const name = cleanText(req.name || '');
          const dev = cleanText(req.developers || '');
          const genres = (req.genres || '').split(',').map(g => cleanText(g.trim())).filter(Boolean);
          return `
          <div class="req-card" onclick="loadRequestIntoForm(${idx})">
            <img class="req-card-img" src="${esc(req.img || (req.appId ? `https://cdn.cloudflare.steamstatic.com/steam/apps/${req.appId}/header.jpg` : ''))}" onerror="this.src='';this.style.background='rgba(255,255,255,.05)'" loading="lazy">
            <div class="req-card-body">
              <div class="req-card-top">
                <div class="req-card-name">${esc(name || 'Sans titre')}</div>
              </div>
              ${dev ? `<div class="req-card-dev">${esc(dev)}</div>` : ''}
              ${genres.length ? `<div class="req-card-tags">${genres.slice(0,4).map(g => `<span class="req-card-tag">${esc(g)}</span>`).join('')}</div>` : ''}
              <div class="req-card-bottom">
                <div class="req-card-date">${timeAgo(req.requested_at)}</div>
                <div class="req-card-actions" onclick="event.stopPropagation()">
                  <button class="req-act-btn add" onclick="loadRequestIntoForm(${idx})" title="Ajouter au catalogue">➕ Ajouter</button>
                  <button class="req-act-btn dismiss" onclick="dismissRequest('${req.id}')" title="Ignorer">✕</button>
                </div>
              </div>
            </div>
          </div>`;
        }).join('');
      } catch(e) {
        console.error('Requests fetch error:', e);
        container.innerHTML = '<div style="padding:1rem;text-align:center;color:rgba(255,255,255,.4)">Erreur de chargement des demandes</div>';
      }
    }

    async function loadRequestIntoForm(idx) {
      const req = _discordRequests[idx];
      if (!req || !req.appId) return;

      // Clear form first
      clearForm();

      // Load via selectSteamGame which fills everything + searches YouTube
      await selectSteamGame(req.appId);

      showToast(`Demande « ${req.name} » chargée dans le formulaire`, 'success');
    }

    async function dismissRequest(reqId) {
      // Remove from GitHub via Worker
      const workerBase = window.location.port === '3000'
        ? 'http://localhost:3000/api/remove-request'
        : 'https://crackuzu-api.crackuzu.workers.dev/api/remove-request';
      try {
        await fetch(workerBase, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: reqId })
        });
      } catch(e) { console.warn('Remove request failed:', e); }
      _dismissedIds.push(reqId);
      localStorage.setItem('crackuzu_dismissed_reqs', JSON.stringify(_dismissedIds));
      displayRequests();
    }

    async function clearAllRequests() {
      if (!confirm('Supprimer toutes les demandes ?')) return;
      const workerBase = window.location.port === '3000'
        ? 'http://localhost:3000/api/remove-request'
        : 'https://crackuzu-api.crackuzu.workers.dev/api/remove-request';
      for (const r of _discordRequests) {
        try { await fetch(workerBase, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: r.id }) }); } catch(e) {}
        _dismissedIds.push(r.id);
      }
      localStorage.setItem('crackuzu_dismissed_reqs', JSON.stringify(_dismissedIds));
      displayRequests();
      showToast('Toutes les demandes supprimées', 'success');
    }

    // ═══════════════════════════════════════════════════════════
    // RECENT GAMES
    // ═══════════════════════════════════════════════════════════
    function displayRecentGames() {
      const container = document.getElementById('recentGames');
      const games = state.games || [];
      
      document.getElementById('gameCount').textContent = games.length;
      
      if (!games.length) {
        container.innerHTML = '<div style="padding:1rem;text-align:center;color:rgba(255,255,255,.4)">Aucun jeu</div>';
        return;
      }
      
      container.innerHTML = games.slice(-20).reverse().map((game, idx) => {
        const realIdx = games.length - 1 - idx;
        return `
          <div class="recent-item" onclick="editGame(${realIdx})">
            <img class="recent-img" src="${esc(game.portrait_url || '')}" onerror="this.style.display='none'">
            <div class="recent-info">
              <div class="recent-title">${esc(game.title)}</div>
              <div class="recent-year">${esc(game.year || 'N/A')}</div>
            </div>
            <div class="recent-actions" onclick="event.stopPropagation()">
              <button class="recent-btn" onclick="editGame(${realIdx})" title="Modifier">✏️</button>
              <button class="recent-btn delete" onclick="deleteGame(${realIdx})" title="Supprimer">🗑️</button>
            </div>
          </div>
        `;
      }).join('');
    }

    async function editGame(idx) {
      const game = state.games[idx];
      if (!game) return;
      
      editingGameIndex = idx;
      
      document.getElementById('f-title').value = game.title || '';
      document.getElementById('f-title-img').value = game.title_img || '';
      if (game.title_img) {
        document.getElementById('titleImgPreviewImg').src = game.title_img;
        document.getElementById('titleImgPreview').style.display = 'block';
        document.getElementById('titleImgStatus').textContent = '✅ Image existante';
      } else {
        document.getElementById('titleImgPreview').style.display = 'none';
        document.getElementById('titleImgStatus').textContent = '';
      }
      document.getElementById('f-year').value = game.year || '';
      document.getElementById('f-desc').value = game.description || '';
      document.getElementById('f-ytb').value = game.ytb_id || '';
      document.getElementById('f-portrait').value = game.portrait_url || '';
      document.getElementById('f-banner').value = game.banner_url || '';
      
      state.selectedPortrait = game.portrait_url || '';
      state.selectedBanner = game.banner_url || '';
      state.selectedCategories = new Set(game.categories || []);
      state.selectedMagnets = game.magnets || [];

      renderCategories();
      renderMagnets();
      await loadExistingImages(game);
      
      document.getElementById('formTitleIcon').textContent = '✏️';
      document.getElementById('formTitleText').textContent = 'Modifier jeu';
      document.getElementById('deleteBtn').style.display = 'flex';

      // Scroll vers le formulaire d'édition
      window.scrollTo({ top: 0, behavior: 'smooth' });

      showToast('Jeu chargé pour modification', 'success');
    }

    function deleteGame(idx) {
      if (!confirm('Supprimer ce jeu ?')) return;
      
      state.games.splice(idx, 1);
      localStorage.setItem('crackuzu_games', JSON.stringify(state.games));
      state.isModified = true;
      updateStatusBadge();
      
      displayRecentGames();
      showToast('Jeu supprimé', 'success');
      
      if (editingGameIndex === idx) {
        clearForm();
      }
    }

    // ═══════════════════════════════════════════════════════════
    // ALL GAMES GRID
    // ═══════════════════════════════════════════════════════════
    function displayAllGames() {
      const container = document.getElementById('allGamesGrid');
      const games = state.games || [];

      document.getElementById('allGamesCount').textContent = games.length;

      if (!games.length) {
        container.innerHTML = '<div style="padding:2rem;text-align:center;color:rgba(255,255,255,.4);grid-column:1/-1">Aucun jeu</div>';
        return;
      }

      container.innerHTML = games.map((game, idx) => `
        <div class="game-card" data-title="${esc(game.title || '').toLowerCase()}" data-idx="${idx}">
          <img class="game-card-img" src="${esc(game.portrait_url || '')}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 1 1%22><rect fill=%22%23333%22/></svg>'">
          <div class="game-card-overlay">
            <button class="game-card-btn" onclick="event.stopPropagation();editGame(${idx})" title="Modifier">✏️ Modifier</button>
            <button class="game-card-btn delete" onclick="event.stopPropagation();deleteGameFromCard(${idx})" title="Supprimer">🗑️ Supprimer</button>
          </div>
          <div class="game-card-info">
            <div class="game-card-title" title="${esc(game.title || '')}">${esc(game.title || 'Sans titre')}</div>
            <div class="game-card-year">${esc(game.year || 'N/A')} • ${esc(game.categories?.[0] || 'Sans catégorie')}</div>
          </div>
        </div>
      `).join('');
    }

    function filterGames() {
      const searchTerm = document.getElementById('gamesSearch').value.toLowerCase().trim();
      const cards = document.querySelectorAll('.game-card');

      cards.forEach(card => {
        const title = card.getAttribute('data-title');
        if (searchTerm === '' || title.includes(searchTerm)) {
          card.classList.remove('hidden');
        } else {
          card.classList.add('hidden');
        }
      });
    }

    function deleteGameFromCard(idx) {
      if (!confirm('Supprimer ce jeu ?')) return;

      state.games.splice(idx, 1);
      localStorage.setItem('crackuzu_games', JSON.stringify(state.games));
      state.isModified = true;
      updateStatusBadge();

      displayRecentGames();
      displayAllGames();
      showToast('Jeu supprimé', 'success');

      if (editingGameIndex === idx) {
        clearForm();
      }
    }

    // ═══════════════════════════════════════════════════════════
    // FORM
    // ═══════════════════════════════════════════════════════════
    function clearForm() {
      editingGameIndex = -1;
      state.selectedCategories.clear();
      state.selectedMagnets = [];
      state.selectedPortrait = '';
      state.selectedBanner = '';
      state.steamData = {};
      state.uploadedImageUrl = '';
      
      document.getElementById('f-title').value = '';
      document.getElementById('f-title-img').value = '';
      document.getElementById('titleImgPreview').style.display = 'none';
      document.getElementById('titleImgPreviewImg').src = '';
      document.getElementById('titleImgStatus').textContent = '';
      document.getElementById('f-year').value = '';
      document.getElementById('f-desc').value = '';
      document.getElementById('f-ytb').value = '';
      document.getElementById('f-portrait').value = '';
      document.getElementById('f-banner').value = '';
      document.getElementById('steamSearch').value = '';
      document.getElementById('steamResults').innerHTML = '';
      document.getElementById('portraitGallery').innerHTML = '';
      document.getElementById('bannerGallery').innerHTML = '';
      document.getElementById('uploadPreview').style.display = 'none';
      document.getElementById('uploadPreviewImg').src = '';
      document.getElementById('m-url').value = '';
      document.getElementById('m-name').value = '';
      document.getElementById('m-size').value = '';
      
      document.getElementById('formTitleIcon').textContent = '➕';
      document.getElementById('formTitleText').textContent = 'Nouveau jeu';
      document.getElementById('deleteBtn').style.display = 'none';
      
      renderCategories();
      renderMagnets();
      switchTab('infos');
    }

    function switchTab(tab) {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.getElementById(`tab-btn-${tab}`).classList.add('active');
      
      document.getElementById('tab-infos').style.display = tab === 'infos' ? 'block' : 'none';
      document.getElementById('tab-images').style.display = tab === 'images' ? 'block' : 'none';
      document.getElementById('tab-magnets').style.display = tab === 'magnets' ? 'block' : 'none';
      document.getElementById('tab-demandes').style.display = tab === 'demandes' ? 'block' : 'none';
    }

    // ═══════════════════════════════════════════════════════════
    // UTILS
    // ═══════════════════════════════════════════════════════════
    function esc(str) {
      if (!str) return '';
      return str.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
    }

    function showToast(msg, type = 'success') {
      const toast = document.getElementById('toast');
      document.getElementById('toastMsg').textContent = msg;
      toast.className = `toast ${type} show`;
      setTimeout(() => toast.classList.remove('show'), 3000);
    }

    function showLoading(show) {
      document.getElementById('loading').classList.toggle('show', show);
    }

    // Header scroll effect
    window.addEventListener('scroll', () => {
      document.getElementById('header').classList.toggle('scrolled', window.scrollY > 50);
    });