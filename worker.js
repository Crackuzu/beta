// Cloudflare Worker — Crackuzu API
// URL: https://crackuzu-api.crackuzu.workers.dev

const BOT_TOKEN = env.DISCORD_BOT_TOKEN || '';
const CHANNEL_ID = env.DISCORD_CHANNEL_ID || '';
const CLIENT_ID = env.DISCORD_CLIENT_ID || '';
const ALLOWED_DISCORD_ID = env.ALLOWED_DISCORD_ID || '';
const ALLOWED_USERNAME = env.ALLOWED_USERNAME || '';

const GITHUB_TOKEN = env.GITHUB_TOKEN || '';
const GITHUB_REPO = env.GITHUB_REPO || 'Crackuzu/beta';
const GITHUB_BRANCH = env.GITHUB_BRANCH || 'main';
const REQUESTS_FILE = 'requests.json';
const DISCORD_WEBHOOK = env.DISCORD_WEBHOOK || '';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: cors(origin) });
    }

    // ─── Discord endpoints ───
    if (url.pathname === '/api/discord-requests') {
      return discordRequests(origin);
    }
    if (url.pathname === '/api/discord-oauth') {
      return discordOAuth(url, env, origin);
    }

    // ─── Game Requests (GitHub file) ───
    if (url.pathname === '/api/github-requests') {
      return githubRequests(origin);
    }
    if (url.pathname === '/api/save-request' && request.method === 'POST') {
      return saveRequest(request, origin);
    }
    if (url.pathname === '/api/remove-request' && request.method === 'POST') {
      return removeRequest(request, origin);
    }

    // ─── Catbox Upload ───
    if (url.pathname === '/api/catbox-upload' && request.method === 'POST') {
      return catboxUpload(request, origin);
    }

    // ─── GitHub Sync (data.json) ───
    if (url.pathname === '/api/github-pull') {
      return githubPull(origin);
    }
    if (url.pathname === '/api/github-push' && request.method === 'POST') {
      return githubPush(request, origin);
    }

    // ─── Status ───
    if (url.pathname === '/' || url.pathname === '') {
      return json({ status: 'online', endpoints: ['/api/discord-requests', '/api/discord-oauth', '/api/github-requests', '/api/save-request', '/api/remove-request', '/api/catbox-upload', '/api/github-pull', '/api/github-push'] }, 200, origin);
    }

    return json({ error: 'Not found' }, 404, origin);
  }
};

function cors(origin) {
  const allowed = origin && (origin.endsWith('.github.io') || origin.includes('localhost'));
  return {
    'Access-Control-Allow-Origin': allowed ? origin : '',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };
}

function json(data, status, origin) {
  return new Response(JSON.stringify(data), { status, headers: cors(origin) });
}

// ─── Discord ───
async function discordRequests(origin) {
  try {
    const res = await fetch(
      `https://discord.com/api/v10/channels/${CHANNEL_ID}/messages?limit=50`,
      { headers: { 'Authorization': `Bot ${BOT_TOKEN}`, 'User-Agent': 'Crackuzu/1.0' } }
    );
    const data = await res.json();
    if (!res.ok) return json({ error: data.message || 'Discord error' }, res.status, origin);
    return json(data, 200, origin);
  } catch (e) {
    return json({ error: e.message }, 500, origin);
  }
}

async function discordOAuth(url, env, origin) {
  const code = url.searchParams.get('code');
  if (!code) {
    return json({ id: ALLOWED_DISCORD_ID, username: ALLOWED_USERNAME, avatar: null }, 200, origin);
  }
  const clientSecret = env?.DISCORD_CLIENT_SECRET;
  if (!clientSecret) {
    return json({ id: ALLOWED_DISCORD_ID, username: ALLOWED_USERNAME, avatar: null }, 200, origin);
  }
  const redirectUri = url.searchParams.get('redirect_uri') || `https://${url.host}`;
  try {
    const tokenRes = await fetch('https://discord.com/api/v10/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: clientSecret, grant_type: 'authorization_code', code, redirect_uri: redirectUri })
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) return json({ error: 'Token exchange failed' }, 400, origin);
    const userRes = await fetch('https://discord.com/api/v10/users/@me', { headers: { 'Authorization': `Bearer ${tokenData.access_token}` } });
    const user = await userRes.json();
    return json(user, 200, origin);
  } catch (e) {
    return json({ error: e.message }, 500, origin);
  }
}

// ─── GitHub Requests (requests.json) ───
async function githubRequests(origin) {
  try {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${REQUESTS_FILE}?ref=${GITHUB_BRANCH}`, {
      headers: { 'Authorization': `Bearer ${GITHUB_TOKEN}`, 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'Crackuzu/1.0' }
    });
    if (res.status === 404) return json([], 200, origin);
    if (!res.ok) return json({ error: `GitHub error: ${res.status}` }, res.status, origin);
    const data = await res.json();
    const requests = JSON.parse(atob(data.content));
    return json(requests, 200, origin);
  } catch (e) {
    return json({ error: e.message }, 500, origin);
  }
}

// ─── GitHub Requests File helpers ───
async function getRequestsFile() {
  const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${REQUESTS_FILE}?ref=${GITHUB_BRANCH}`;
  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${GITHUB_TOKEN}`, 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'Crackuzu/1.0' }
  });
  if (res.status === 404) return { sha: null, requests: [] };
  if (!res.ok) throw new Error(`GitHub read error: ${res.status}`);
  const data = await res.json();
  const content = JSON.parse(atob(data.content));
  return { sha: data.sha, requests: content };
}

async function putRequestsFile(requests, sha) {
  const content = btoa(unescape(encodeURIComponent(JSON.stringify(requests, null, 2))));
  const body = { message: `Update ${REQUESTS_FILE}`, content, branch: GITHUB_BRANCH };
  if (sha) body.sha = sha;
  const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${REQUESTS_FILE}`, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${GITHUB_TOKEN}`, 'Accept': 'application/vnd.github.v3+json', 'Content-Type': 'application/json', 'User-Agent': 'Crackuzu/1.0' },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `GitHub write error: ${res.status}`);
  }
  return await res.json();
}

async function saveRequest(request, origin) {
  try {
    const body = await request.json();
    const { sha, requests } = await getRequestsFile();
    body.id = body.id || Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    body.requested_at = body.requested_at || new Date().toISOString();
    requests.push(body);
    await putRequestsFile(requests, sha);

    // Send Discord webhook notification
    try {
      const truncate = (s, n) => s && s.length > n ? s.slice(0, n-3) + '...' : (s || '—');
      await fetch(DISCORD_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          embeds: [{
            title: truncate(body.name, 256),
            url: body.url || '',
            description: truncate(body.desc, 2048),
            fields: [
              { name: 'App ID', value: String(body.appId || '?'), inline: true },
              { name: 'Développeur', value: truncate(body.developers, 1024), inline: true },
              { name: 'Genres', value: truncate(body.genres, 1024), inline: true },
              { name: 'Sortie', value: truncate(body.release, 1024), inline: true },
              { name: 'Prix', value: truncate(body.price, 1024), inline: true },
            ],
            image: { url: body.img || '' },
            color: 16056320,
            footer: { text: 'Crackuzu — Demande de jeu' },
            timestamp: body.requested_at
          }]
        })
      });
    } catch(e) { console.error('Webhook failed:', e); }

    return json({ success: true, id: body.id }, 200, origin);
  } catch (e) {
    return json({ error: e.message }, 500, origin);
  }
}

async function removeRequest(request, origin) {
  try {
    const body = await request.json();
    const { sha, requests } = await getRequestsFile();
    const filtered = requests.filter(r => r.id !== body.id);
    if (filtered.length === requests.length) return json({ error: 'Request not found' }, 404, origin);
    await putRequestsFile(filtered, sha);
    return json({ success: true }, 200, origin);
  } catch (e) {
    return json({ error: e.message }, 500, origin);
  }
}

// ─── Catbox Upload ───
async function catboxUpload(request, origin) {
  try {
    const formData = await request.formData();
    const file = formData.get('fileToUpload');
    if (!file) return json({ error: 'No file provided' }, 400, origin);

    // Forward to Catbox API
    const catboxForm = new FormData();
    catboxForm.append('reqtype', 'fileupload');
    catboxForm.append('fileToUpload', file);

    const res = await fetch('https://catbox.moe/user/api.php', {
      method: 'POST',
      body: catboxForm
    });

    if (!res.ok) return json({ error: `Catbox error: ${res.status}` }, 502, origin);

    const url = await res.text();
    if (url && url.startsWith('http')) {
      return json({ url: url.trim() }, 200, origin);
    }
    return json({ error: 'Catbox returned unexpected response', detail: url }, 502, origin);
  } catch (e) {
    return json({ error: e.message }, 500, origin);
  }
}

// ─── GitHub Sync (data.json) ───
async function githubPull(origin) {
  try {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/data.json?ref=${GITHUB_BRANCH}`, {
      headers: { 'Authorization': `Bearer ${GITHUB_TOKEN}`, 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'Crackuzu/1.0' }
    });
    if (!res.ok) return json({ error: `GitHub error: ${res.status}` }, res.status, origin);
    const data = await res.json();
    return json({ sha: data.sha, content: data.content }, 200, origin);
  } catch (e) {
    return json({ error: e.message }, 500, origin);
  }
}

async function githubPush(request, origin) {
  try {
    const body = await request.json();
    const { content, sha, message } = body;
    if (!content) return json({ error: 'No content' }, 400, origin);

    const putBody = { message: message || 'Update data.json', content: content, branch: GITHUB_BRANCH };
    if (sha) putBody.sha = sha;

    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/data.json`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${GITHUB_TOKEN}`, 'Accept': 'application/vnd.github.v3+json', 'Content-Type': 'application/json', 'User-Agent': 'Crackuzu/1.0' },
      body: JSON.stringify(putBody)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return json({ error: err.message || `GitHub push error: ${res.status}` }, res.status, origin);
    }
    const result = await res.json();
    return json({ success: true, sha: result.content?.sha }, 200, origin);
  } catch (e) {
    return json({ error: e.message }, 500, origin);
  }
}
