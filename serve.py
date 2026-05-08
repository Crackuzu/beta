import http.server
import json
import os
import time
import random
import urllib.request
import urllib.error
import urllib.parse
import webbrowser

PORT = 3000
os.chdir(os.path.dirname(os.path.abspath(__file__)))

BOT_TOKEN = os.environ.get('DISCORD_BOT_TOKEN', '')
CHANNEL_ID = os.environ.get('DISCORD_REQUESTS_CHANNEL', '')
CLIENT_ID = os.environ.get('DISCORD_CLIENT_ID', '')
CLIENT_SECRET = os.environ.get('DISCORD_CLIENT_SECRET', '')
REDIRECT_URI = os.environ.get('DISCORD_REDIRECT_URI', '')
GITHUB_TOKEN = os.environ.get('GITHUB_TOKEN', '')
GITHUB_REPO = os.environ.get('GITHUB_REPO', 'Crackuzu/beta')

class ProxyHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/api/discord-requests':
            self._proxy_discord()
        elif self.path.startswith('/api/discord-oauth?code='):
            self._oauth_exchange()
        elif self.path == '/api/github-pull':
            self._github_pull()
        elif self.path == '/api/github-requests':
            self._github_requests()
        else:
            super().do_GET()

    def do_POST(self):
        if self.path == '/api/save-request':
            self._save_request()
        elif self.path == '/api/remove-request':
            self._remove_request()
        elif self.path == '/api/github-push':
            self._github_push()
        elif self.path == '/api/catbox-upload':
            self._catbox_upload()
        else:
            self.send_response(404)
            self.end_headers()

    def _read_requests_file(self):
        filepath = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'requests.json')
        if os.path.exists(filepath):
            with open(filepath, 'r', encoding='utf-8') as f:
                return json.load(f)
        return []

    def _write_requests_file(self, requests):
        filepath = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'requests.json')
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(requests, f, ensure_ascii=False, indent=2)

    def _save_request(self):
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length)
        try:
            data = json.loads(body)
            data['id'] = data.get('id', str(int(time.time())) + ''.join(random.choices('abcdefghijklmnopqrstuvwxyz', k=4)))
            data['requested_at'] = data.get('requested_at', time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()))
            requests = self._read_requests_file()
            requests.append(data)
            self._write_requests_file(requests)
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({'success': True, 'id': data['id']}).encode())
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': str(e)}).encode())

    def _remove_request(self):
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length)
        try:
            data = json.loads(body)
            req_id = data.get('id')
            requests = self._read_requests_file()
            filtered = [r for r in requests if r.get('id') != req_id]
            self._write_requests_file(filtered)
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({'success': True}).encode())
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': str(e)}).encode())

    def _proxy_discord(self):
        url = f'https://discord.com/api/v10/channels/{CHANNEL_ID}/messages?limit=50'
        print(f'[PROXY] Fetching Discord messages from channel {CHANNEL_ID}...')
        req = urllib.request.Request(url, headers={
            'Authorization': f'Bot {BOT_TOKEN}',
            'User-Agent': 'CrackuzuServer/1.0'
        })
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = resp.read()
                print(f'[PROXY] Discord responded: {len(data)} bytes')
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(data)
        except urllib.error.HTTPError as e:
            body = e.read().decode() if e.fp else ''
            print(f'[PROXY] Discord HTTP error: {e.code} {e.reason} — {body[:200]}')
            self.send_response(e.code)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': e.reason, 'details': body[:500]}).encode())
        except Exception as e:
            print(f'[PROXY] Discord fetch exception: {e}')
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': str(e)}).encode())

    def _oauth_exchange(self):
        # Extract code from URL
        parsed = urllib.parse.urlparse(self.path)
        params = urllib.parse.parse_qs(parsed.query)
        code = params.get('code', [''])[0]

        if not code or not CLIENT_SECRET:
            # No secret configured, return mock user for dev
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                'id': '482466285364576266',
                'username': 'crackuzu',
                'avatar': None
            }).encode())
            return

        # Exchange code for token
        redirect = REDIRECT_URI or f'http://localhost:{PORT}'
        token_data = urllib.parse.urlencode({
            'client_id': CLIENT_ID,
            'client_secret': CLIENT_SECRET,
            'grant_type': 'authorization_code',
            'code': code,
            'redirect_uri': redirect
        }).encode()

        token_req = urllib.request.Request(
            'https://discord.com/api/v10/oauth2/token',
            data=token_data,
            headers={'Content-Type': 'application/x-www-form-urlencoded'}
        )

        try:
            with urllib.request.urlopen(token_req, timeout=10) as resp:
                token_json = json.loads(resp.read())
                access_token = token_json.get('access_token')

            # Get user info
            user_req = urllib.request.Request('https://discord.com/api/v10/users/@me', headers={
                'Authorization': f'Bearer {access_token}'
            })
            with urllib.request.urlopen(user_req, timeout=10) as resp:
                user = json.loads(resp.read())

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(user).encode())
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': str(e)}).encode())

    def _github_pull(self):
        try:
            url = f'https://api.github.com/repos/{GITHUB_REPO}/contents/data.json?ref=main'
            req = urllib.request.Request(url, headers={
                'Authorization': f'Bearer {GITHUB_TOKEN}',
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'Crackuzu/1.0'
            })
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read())
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({'sha': data['sha'], 'content': data['content']}).encode())
        except urllib.error.HTTPError as e:
            if e.code == 404:
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps([]).encode())
            else:
                self.send_response(e.code)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': str(e)}).encode())
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': str(e)}).encode())

    def _github_requests(self):
        try:
            url = f'https://api.github.com/repos/{GITHUB_REPO}/contents/requests.json?ref=main'
            req = urllib.request.Request(url, headers={
                'Authorization': f'Bearer {GITHUB_TOKEN}',
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'Crackuzu/1.0'
            })
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read())
            import base64
            requests = json.loads(base64.b64decode(data['content']))
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(requests).encode())
        except urllib.error.HTTPError as e:
            if e.code == 404:
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps([]).encode())
            else:
                self.send_response(e.code)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': str(e)}).encode())
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': str(e)}).encode())

    def _github_push(self):
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length)
        try:
            data = json.loads(body)
            put_body = {
                'message': data.get('message', 'Update data.json'),
                'content': data.get('content', ''),
                'branch': 'main'
            }
            if data.get('sha'):
                put_body['sha'] = data['sha']

            req = urllib.request.Request(
                f'https://api.github.com/repos/{GITHUB_REPO}/contents/data.json',
                data=json.dumps(put_body).encode(),
                headers={
                    'Authorization': f'Bearer {GITHUB_TOKEN}',
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json',
                    'User-Agent': 'Crackuzu/1.0'
                },
                method='PUT'
            )
            with urllib.request.urlopen(req, timeout=15) as resp:
                result = json.loads(resp.read())
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({'success': True, 'sha': result.get('content', {}).get('sha')}).encode())
        except urllib.error.HTTPError as e:
            err_body = e.read().decode() if e.fp else ''
            self.send_response(e.code)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': err_body[:500]}).encode())
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': str(e)}).encode())

    def _catbox_upload(self):
        """Proxy .torrent file upload to Catbox API (avoids CORS) — forwards raw body"""
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            content_type = self.headers.get('Content-Type', '')
            if not content_length or 'multipart/form-data' not in content_type:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': 'Expected multipart/form-data'}).encode())
                return

            # Read raw body and forward directly to Catbox
            raw_body = self.rfile.read(content_length)

            req = urllib.request.Request('https://catbox.moe/user/api.php', data=raw_body, headers={
                'Content-Type': content_type
            })
            resp = urllib.request.urlopen(req)
            url = resp.read().decode().strip()

            if url and url.startswith('http'):
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({'url': url}).encode())
            else:
                self.send_response(502)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': 'Catbox returned unexpected response', 'detail': url[:200]}).encode())
        except urllib.error.HTTPError as e:
            err_body = e.read().decode() if e.fp else ''
            self.send_response(502)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': f'Catbox error: {e.code}', 'detail': err_body[:200]}).encode())
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': str(e)}).encode())

webbrowser.open(f"http://localhost:{PORT}")
http.server.HTTPServer(("", PORT), ProxyHandler).serve_forever()
