// js/core/utils.js
// CrackUZU — Utilitaires partagés

// ── FORMATAGE DE DATE ────────────────────────────────────────────────────────
function fd(s) {
  if (!s) return '—';
  const d = new Date(s);
  return isNaN(d) ? '—' : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function timeAgo(s) {
  if (!s) return '';
  const d = new Date(s), now = new Date(), diff = Math.floor((now - d) / 1000);
  if (diff < 60) return "À l'instant";
  if (diff < 3600) return Math.floor(diff / 60) + ' min';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h';
  if (diff < 604800) return Math.floor(diff / 86400) + 'j';
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

// ── ÉCHAPPEMENT HTML & TEXTE ────────────────────────────────────────────────
function esc(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[m]));
}

function escapeHtml(str) {
  return esc(str);
}

function e(s) {
  return esc(s);
}

function e2(s) {
  return esc(s).replace(/&#39;/g, "\\'");
}

function sid(s) {
  return String(s).replace(/[^a-zA-Z0-9]/g, '_');
}

function decodeHTML(text) {
  if (!text) return '';
  const textarea = document.createElement('textarea');
  textarea.innerHTML = text;
  return textarea.value;
}

function cleanText(text) {
  if (!text) return '';
  text = decodeHTML(text);
  return text
    .replace(/[\u2122\u00AE\u00A9]/g, '') // ™, ®, ©
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/\u00A0/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function cleanTitle(str) {
  if (!str) return '';
  return cleanText(str).replace(/[^\w\s\-\.,'":;!\?\(\)\[\]\/]/g, '').trim();
}

// ── ENCODAGE / DÉCODAGE BASE64 UTF-8 SÉCURISÉ ──────────────────────────────
function utf8ToBase64(str) {
  const utf8Bytes = new TextEncoder().encode(str);
  const binaryString = Array.from(utf8Bytes, byte => String.fromCharCode(byte)).join('');
  return btoa(binaryString);
}

function base64ToUtf8(base64) {
  const binaryString = atob(base64.replace(/\s/g, ''));
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

// ── PROXY UNIFIÉ (CF Worker dédié + fallbacks) ───────────────────────────────
const CORS_PROXY_URL = CONFIG.WORKER_URL + '/api/proxy';

async function fetchWithProxy(url) {
  const proxies = [
    // 1. Notre propre Worker Cloudflare (ultra-rapide, fiable, pas de rate-limit)
    { name: 'cf-proxy', url: `${CORS_PROXY_URL}?url=${encodeURIComponent(url)}`, parse: 'direct', timeout: 6000 },
    // 2. Allorigins /raw — fallback gratuit
    { name: 'allorigins-raw', url: `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`, parse: 'direct', timeout: 10000 },
    // 3. Allorigins /get — enveloppe {contents: "..."}, dernier recours
    { name: 'allorigins-get', url: `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`, parse: 'allorigins', timeout: 12000 }
  ];

  for (const proxy of proxies) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), proxy.timeout);

      const res = await fetch(proxy.url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!res.ok) {
        console.warn(`Proxy ${proxy.name}: HTTP ${res.status}`);
        continue;
      }

      if (proxy.parse === 'allorigins') {
        const result = await res.json();
        return typeof result.contents === 'string' ? JSON.parse(result.contents) : result.contents;
      }
      return await res.json();
    } catch (e) {
      console.warn(`Proxy ${proxy.name} échoué:`, e.message);
      continue;
    }
  }
  throw new Error('Tous les proxies ont échoué pour récupérer : ' + url);
}

// Alias pour compatibilité
const reqFetchProxy = fetchWithProxy;

// ── UI HELPERS (Toast & Loading) ─────────────────────────────────────────────
function showToast(msg, type = 'success') {
  let toast = document.getElementById('toast');
  let msgEl = document.getElementById('toastMsg');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    toast.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="20,6 9,17 4,12"/>
      </svg>
      <span id="toastMsg"></span>
    `;
    document.body.appendChild(toast);
    msgEl = toast.querySelector('#toastMsg');
  }
  if (msgEl) msgEl.textContent = msg;
  toast.className = `toast ${type} show`;
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), 2600);
}

function showLoading(show) {
  const el = document.getElementById('loading');
  if (el) el.classList.toggle('show', show);
}

// ── BENCODE PARSER POUR FICHIERS .TORRENT ───────────────────────────────────
function bdecode(buf, offset) {
  if (offset >= buf.length) throw new Error('Unexpected end');
  const c = buf[offset];
  if (c === 0x69) { // 'i' integer
    const end = buf.indexOf(0x65, offset + 1);
    if (end === -1) throw new Error('No end for integer');
    return [parseInt(new TextDecoder().decode(buf.slice(offset + 1, end)), 10), end + 1];
  }
  if (c === 0x6C) { // 'l' list
    let pos = offset + 1, list = [];
    while (buf[pos] !== 0x65) {
      const [v, n] = bdecode(buf, pos);
      list.push(v);
      pos = n;
    }
    return [list, pos + 1];
  }
  if (c === 0x64) { // 'd' dict
    let pos = offset + 1, dict = {};
    while (buf[pos] !== 0x65) {
      const [key, kn] = bdecode(buf, pos);
      const [val, vn] = bdecode(buf, kn);
      dict[key] = val;
      pos = vn;
    }
    return [dict, pos + 1];
  }
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

function bencodeExtractKey(buf, key) {
  const data = new Uint8Array(buf);
  let pos = 1;
  while (pos < data.length && data[pos] !== 0x65) {
    const colon = data.indexOf(0x3A, pos);
    if (colon === -1) break;
    const kLen = parseInt(new TextDecoder().decode(data.slice(pos, colon)), 10);
    const kStart = colon + 1;
    const kStr = new TextDecoder().decode(data.slice(kStart, kStart + kLen));
    const [_, valEnd] = bdecode(data, kStart + kLen);
    if (kStr === key) return buf.slice(kStart + kLen, valEnd);
    pos = valEnd;
  }
  return null;
}

function formatSize(bytes) {
  if (!bytes || isNaN(bytes)) return '-';
  if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(1) + ' GB';
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
  if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return bytes + ' B';
}

async function parseTorrentFile(file) {
  const buf = await file.arrayBuffer();
  const data = bdecodeRaw(buf);

  const name = data.info?.name || file.name.replace('.torrent', '');
  let totalSize = 0;
  if (data.info?.length) {
    totalSize = data.info.length;
  } else if (data.info?.files) {
    totalSize = data.info.files.reduce((s, f) => s + (f.length || 0), 0);
  }

  let trackers = [];
  if (data['announce-list']) {
    for (const tier of data['announce-list']) {
      if (Array.isArray(tier)) trackers.push(...tier);
      else trackers.push(tier);
    }
  }
  if (data.announce && !trackers.includes(data.announce)) trackers.push(data.announce);

  const infoRaw = bencodeExtractKey(buf, 'info');
  let infoHash = '';
  if (infoRaw) {
    const hashBuf = await crypto.subtle.digest('SHA-1', infoRaw);
    infoHash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  let magnetUrl = `magnet:?xt=urn:btih:${infoHash}&dn=${encodeURIComponent(name)}`;
  for (const tr of trackers.slice(0, 5)) {
    magnetUrl += `&tr=${encodeURIComponent(tr)}`;
  }

  return { file, name, totalSize, infoHash, magnetUrl, trackers };
}
