// js/core/config.js
// CrackUZU — Configuration globale

const CONFIG = {
  REPO: 'Crackuzu/beta',
  BRANCH: 'main',
  WORKER_URL: window.location.port === '3000'
    ? 'http://localhost:3000'
    : 'https://crackuzu-api.crackuzu.workers.dev',
  CATEGORIES: [
    'Action', 'Aventure', 'RPG', 'Simulation', 'Strategie',
    'Sport', 'Course', 'Horreur', 'Puzzle', 'Multijoueur',
    'FPS', 'Monde ouvert', 'Survie', 'Combat', 'Plateforme'
  ],
  CLOUDINARY_CLOUD: 'dijopwaix',
  CLOUDINARY_PRESET: 'kmorlkcl',
  SOURCES: {
    onlinefix: {
      name: 'Online-Fix',
      url: 'https://raw.githubusercontent.com/ArnamentGames/HydraLinks/main/onlinefix.json',
      icon: '🌐'
    },
    fitgirl: {
      name: 'FitGirl',
      url: 'https://raw.githubusercontent.com/ArnamentGames/HydraLinks/main/fitgirl.json',
      icon: '💪'
    },
    dodi: {
      name: 'DODI',
      url: 'https://raw.githubusercontent.com/ArnamentGames/HydraLinks/main/dodi.json',
      icon: '⚡'
    },
    steamrip: {
      name: 'SteamRip',
      url: 'https://raw.githubusercontent.com/ArnamentGames/HydraLinks/main/steamrip.json',
      icon: '🎮'
    }
  }
};

const DISCORD_CONFIG = {
  ALLOWED_DISCORD_ID: '482466285364576266',
  ALLOWED_USERNAME: 'crackuzu',
  CLIENT_ID: '1493055302961201264',
  REDIRECT_URI: window.location.origin + window.location.pathname,
  SCOPE: 'identify'
};
