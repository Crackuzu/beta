# 🎮 CrackUZU — Répertoire de jeux Hydra

Site statique de répertoire de jeux alimenté automatiquement par des sources Hydra Launcher.

## Architecture

```
GitHub Actions (cron horaire)
     ↓
Fetch 5 sources Hydra + compare lastChecked
     ↓
Nouveaux jeux → Steam Search → cover image
     ↓ (fallback)
SteamGridDB → cover image
     ↓
Commit data.json sur GitHub
     ↓
Frontend fetch data.json → affichage
```

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | Frontend complet (fetch `data.json`, affichage, recherche, pagination) |
| `data.json` | Base de données JSON statique (mise à jour par GitHub Actions) |
| `scripts/update.js` | Script Node.js — fetch sources + résolution covers |
| `.github/workflows/update.yml` | GitHub Actions — tourne toutes les heures |

## Setup GitHub Pages

1. **Push ce repo sur GitHub**
2. Aller dans **Settings → Pages**
3. Source : `Deploy from a branch` → `main` → `/ (root)`
4. Ton site sera dispo sur `https://TON_PSEUDO.github.io/NOM_DU_REPO/`

## Ajouter le secret SteamGridDB

1. Aller dans **Settings → Secrets and variables → Actions**
2. Cliquer **New repository secret**
3. Nom : `STEAMGRIDDB_API_KEY`
4. Valeur : ta clé API SteamGridDB

## Lancer la première mise à jour

1. Aller dans **Actions → Update Games Database**
2. Cliquer **Run workflow**
3. Attendre ~5-10 min (selon le nombre de jeux à traiter)
4. `data.json` sera mis à jour avec les jeux + covers

## Sources Hydra incluses

| Source | URL |
|---|---|
| OnlineFix | `https://hydralinks.cloud/sources/onlinefix.json` |
| FitGirl | `https://hydralinks.cloud/sources/fitgirl.json` |
| DODI | `https://hydralinks.cloud/sources/dodi.json` |
| KaosKrew | `https://hydralinks.cloud/sources/kaoskrew.json` |
| Xatab | `https://hydralinks.cloud/sources/xatab.json` |

## Ajouter/modifier des sources

Éditer la constante `SOURCES` dans `scripts/update.js` :

```js
const SOURCES = {
  onlinefix: 'https://hydralinks.cloud/sources/onlinefix.json',
  // Ajoute ici...
  nouvellesource: 'https://example.com/source.json',
};
```

Et ajouter l'entrée correspondante dans `data.json` :

```json
{
  "sources": {
    "nouvellesource": {
      "lastChecked": null,
      "games": []
    }
  }
}
```

## Structure data.json

```json
{
  "sources": {
    "onlinefix": {
      "lastChecked": "2026-04-05T10:00:00.000Z",
      "games": [
        {
          "name": "Slay the Spire 2",
          "version": "0.99.1",
          "size": "1.2 GB",
          "magnet": "magnet:?xt=urn:btih:...",
          "uploadDate": "2026-03-23T13:20:47.000Z",
          "cover": "https://shared.steamstatic.com/..."
        }
      ]
    }
  }
}
```
