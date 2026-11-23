import array
import base64
import concurrent.futures
import queue
import threading
import hashlib
import http.server
import io
import json
import os
import re
import sqlite3
import ssl
import subprocess
import tempfile
import urllib.error
import urllib.parse
import urllib.request
import uuid
import wave
from datetime import datetime, timedelta, timezone


ROOT = os.path.dirname(os.path.abspath(__file__))
VOICE_DIR = os.path.join(ROOT, 'voice')
VOICES_DIR = os.path.join(VOICE_DIR, 'voices')
CACHE_DIR = os.path.join(VOICE_DIR, 'cache')
INDEX_PATH = os.path.join(VOICES_DIR, 'index.json')
DB_PATH = os.path.join(ROOT, 'memory.db')
BROWSER_LOG = os.path.join(ROOT, 'browser_log.jsonl')
BROWSER_ARTIFACTS = os.path.join(ROOT, 'artifacts', 'browser')
os.makedirs(BROWSER_ARTIFACTS, exist_ok=True)
BROWSER_HEADLESS = os.environ.get('BROWSER_HEADLESS', '0') not in ('0', 'false', 'no', 'False')
BROWSER_STATE = {'ready': False, 'url': '', 'title': '', 'error': ''}
BROWSER_WORKER = None
BROWSER_LOCK = threading.Lock()
BROWSER_ALLOWED = {'open_url', 'search', 'click_text', 'read_page', 'screenshot', 'scroll', 'back', 'forward', 'reload', 'status', 'close'}
os.makedirs(VOICES_DIR, exist_ok=True)
os.makedirs(CACHE_DIR, exist_ok=True)

TTS_ENGINE = os.environ.get('TTS_ENGINE', 'gpt-sovits').lower()
TTS_API = os.environ.get('TTS_API', 'http://127.0.0.1:9880/tts')
TTS_REF = os.environ.get('TTS_REF', '')
TTS_PROMPT = os.environ.get('TTS_PROMPT', '')
TTS_PROMPT_LANG = os.environ.get('TTS_PROMPT_LANG', 'zh')
TTS_SPEED = float(os.environ.get('TTS_SPEED', '1.0'))
TTS_SEED = int(os.environ.get('TTS_SEED', '42'))
TTS_GAIN_DB = float(os.environ.get('TTS_GAIN_DB', '8'))
TTS_CACHE_VERSION = os.environ.get('TTS_CACHE_VERSION', 'xiaoke-v1')

def _ssl_context():
    try:
        import certifi
        return ssl.create_default_context(cafile=certifi.where())
    except Exception:
        try:
            return ssl.create_default_context(cafile='/etc/ssl/cert.pem')
        except Exception:
            return ssl.create_default_context()


SSL_CTX = _ssl_context()

LLM_PRESETS = {
    'openai': ('https://api.openai.com/v1/chat/completions', 'gpt-4o-mini'),
    'gemini': ('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', 'gemini-2.5-flash'),
    'deepseek': ('https://api.deepseek.com/chat/completions', 'deepseek-chat'),
    'openrouter': ('https://openrouter.ai/api/v1/chat/completions', 'deepseek/deepseek-chat'),
    'opencode': ('https://opencode.ai/inference/openai/v1/chat/completions', 'gemini-3.5-flash-lite'),
}


def request_llm(payload):
    raw = payload.get('llm') if isinstance(payload.get('llm'), dict) else {}
    key = str(raw.get('api_key') or '').strip()[:512]
    provider = str(raw.get('provider') or '').strip().lower()
    model = str(raw.get('model') or '').strip()[:160]
    base_url = str(raw.get('base_url') or '').strip()[:500]

    if not key:
        env_map = {
            'openai': os.environ.get('OPENAI_API_KEY', '').strip(),
            'gemini': os.environ.get('GEMINI_API_KEY', '').strip(),
            'deepseek': os.environ.get('DEEPSEEK_API_KEY', '').strip(),
            'openrouter': os.environ.get('OPENROUTER_API_KEY', '').strip(),
        }
        provider = provider or ('deepseek' if env_map['deepseek'] else 'gemini' if env_map['gemini'] else 'openai')
        key = env_map.get(provider, '') or os.environ.get('LLM_API_KEY', '').strip()
        if not key:
            raise ValueError('no API key: open 模型设置 or set a server key')
        if provider == 'custom':
            base_url = os.environ.get('LLM_API_URL', '').strip()
            model = model or os.environ.get('LLM_MODEL', '').strip()

    if provider == 'custom':
        if not (base_url.startswith('https://') or base_url.startswith('http://127.0.0.1') or base_url.startswith('http://localhost')):
            raise ValueError('custom base_url must be https:// or localhost')
        if not model:
            raise ValueError('custom model is empty')
        api_url = base_url
    else:
        if provider not in LLM_PRESETS:
            provider = 'deepseek'
        api_url, default_model = LLM_PRESETS[provider]
        model = model or default_model

    return {'provider': provider, 'api_key': key, 'api_url': api_url, 'model': model}
MAX_VOICE_BYTES = 30 * 1024 * 1024
ALLOWED_EXT = {'wav', 'mp3', 'm4a', 'flac', 'ogg', 'aac'}

INDEX = {'current': None, 'voices': {}}


def load_index():
    global INDEX
    try:
        with open(INDEX_PATH, 'r', encoding='utf-8') as f:
            data = json.load(f)
        if isinstance(data, dict) and isinstance(data.get('voices'), dict):
            INDEX = {'current': data.get('current'), 'voices': data['voices']}
    except Exception:
        INDEX = {'current': None, 'voices': {}}


def save_index():
    tmp = INDEX_PATH + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(INDEX, f, ensure_ascii=False, indent=2)
    os.replace(tmp, INDEX_PATH)


def init_memory():
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS memories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                text TEXT NOT NULL,
                source TEXT NOT NULL DEFAULT 'user',
                tags TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL,
                expires_at TEXT
            )
            """
        )
        conn.commit()


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def prune_memory(conn):
    conn.execute('DELETE FROM memories WHERE expires_at IS NOT NULL AND expires_at <= ?', (now_iso(),))


def memory_public(row):
    return {
        'id': row['id'],
        'text': row['text'],
        'source': row['source'],
        'tags': row['tags'],
        'created_at': row['created_at'],
        'expires_at': row['expires_at'],
    }


def memory_list(limit=20):
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        prune_memory(conn)
        rows = conn.execute(
            'SELECT * FROM memories ORDER BY created_at DESC LIMIT ?', (max(1, min(100, int(limit))),)
        ).fetchall()
        conn.commit()
        return [memory_public(r) for r in rows]


def memory_add(text, source='user', tags='', ttl_days=30):
    text = str(text or '').strip()
    if not text:
        raise ValueError('memory text is required')
    ttl_days = float(ttl_days) if ttl_days is not None else 0
    expires = (datetime.now(timezone.utc) + timedelta(days=ttl_days)).isoformat() if ttl_days > 0 else None
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        cur = conn.execute(
            'INSERT INTO memories (text, source, tags, created_at, expires_at) VALUES (?, ?, ?, ?, ?)',
            (text[:2000], str(source or 'user')[:40], str(tags or '')[:200], now_iso(), expires),
        )
        conn.commit()
        row = conn.execute('SELECT * FROM memories WHERE id = ?', (cur.lastrowid,)).fetchone()
        return memory_public(row)


def memory_search(query, limit=8):
    q = str(query or '').strip()
    limit = max(1, min(50, int(limit)))
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        prune_memory(conn)
        if q:
            rows = conn.execute(
                'SELECT * FROM memories WHERE text LIKE ? ORDER BY created_at DESC LIMIT ?',
                (f'%{q}%', limit),
            ).fetchall()
        else:
            rows = conn.execute(
                'SELECT * FROM memories ORDER BY created_at DESC LIMIT ?', (limit,)
            ).fetchall()
        conn.commit()
        return [memory_public(r) for r in rows]


def memory_clear():
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute('DELETE FROM memories')
        conn.commit()


def voice_file(voice):
    if not voice:
        return None
    if voice.get('ref'):
        return voice['ref']
    if voice.get('file'):
        return os.path.join(VOICES_DIR, voice['file'])
    return None


def current_voice():
    vid = INDEX.get('current')
    voice = INDEX.get('voices', {}).get(vid) if vid else None
    if voice and voice_file(voice) and os.path.exists(voice_file(voice)):
        return voice
    if TTS_REF and TTS_PROMPT and os.path.exists(TTS_REF):
        return {
            'id': 'env',
            'name': 'env',
            'file': None,
            'ref': TTS_REF,
            'transcript': TTS_PROMPT,
            'lang': TTS_PROMPT_LANG,
        }
    return None


def voice_public(voice):
    if not voice:
        return None
    return {
        'id': voice.get('id'),
        'name': voice.get('name') or voice.get('id'),
        'transcript': voice.get('transcript', ''),
        'lang': voice.get('lang', 'zh'),
    }


def cache_path(text: str, lang: str, voice_id: str) -> str:
    key = f'{TTS_CACHE_VERSION}|{voice_id}|{lang}|{text}'.encode('utf-8')
    return os.path.join(CACHE_DIR, hashlib.sha1(key).hexdigest() + '.wav')


def boost_wav(data: bytes, gain_db: float) -> bytes:
    if not gain_db:
        return data
    try:
        with wave.open(io.BytesIO(data), 'rb') as w:
            params = w.getparams()
            frames = w.readframes(w.getnframes())
        if params.sampwidth != 2:
            return data
        samples = array.array('h')
        samples.frombytes(frames)
        factor = 10 ** (gain_db / 20.0)
        for i, value in enumerate(samples):
            out = int(value * factor)
            samples[i] = 32767 if out > 32767 else -32768 if out < -32768 else out
        buf = io.BytesIO()
        with wave.open(buf, 'wb') as w:
            w.setnchannels(params.nchannels)
            w.setsampwidth(2)
            w.setframerate(params.framerate)
            w.writeframes(samples.tobytes())
        return buf.getvalue()
    except Exception:
        return data


def synth_gpt_sovits(text: str, lang: str, voice: dict) -> bytes:
    ref = voice_file(voice)
    if not ref or not os.path.exists(ref):
        raise FileNotFoundError('no reference audio for the selected voice')
    if not voice.get('transcript'):
        raise RuntimeError('the selected voice has no transcript')
    payload = {
        'text': text,
        'text_lang': 'en' if lang == 'en' else 'zh',
        'ref_audio_path': ref,
        'prompt_text': voice['transcript'],
        'prompt_lang': voice.get('lang', TTS_PROMPT_LANG),
        'text_split_method': 'cut5',
        'speed_factor': TTS_SPEED,
        'seed': TTS_SEED,
        'streaming_mode': False,
        'media_type': 'wav',
    }
    body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
    req = urllib.request.Request(
        TTS_API,
        data=body,
        headers={'Content-Type': 'application/json'},
        method='POST',
    )
    with urllib.request.urlopen(req, timeout=180) as res:
        data = res.read()
    if not data.startswith(b'RIFF'):
        raise RuntimeError(data[:200].decode('utf-8', errors='replace'))
    return data


def synth_say(text: str, lang: str) -> bytes:
    voice = 'Samantha' if lang == 'en' else 'Tingting'
    with tempfile.TemporaryDirectory() as d:
        aiff = os.path.join(d, 'a.aiff')
        wav = os.path.join(d, 'a.wav')
        try:
            subprocess.run(['say', '-v', voice, '-o', aiff, text], check=True, timeout=20)
        except Exception:
            subprocess.run(['say', '-o', aiff, text], check=True, timeout=20)
        subprocess.run(
            ['afconvert', '-f', 'WAVE', '-d', 'LEI16@22050', aiff, wav],
            check=True,
            timeout=20,
        )
        with open(wav, 'rb') as f:
            return f.read()


def synth(text: str, lang: str) -> bytes:
    if TTS_ENGINE != 'say':
        voice = current_voice()
        if voice:
            cp = cache_path(text, lang, voice.get('id', 'env'))
            if os.path.exists(cp):
                with open(cp, 'rb') as f:
                    return f.read()
            try:
                data = boost_wav(synth_gpt_sovits(text, lang, voice), TTS_GAIN_DB)
                with open(cp, 'wb') as f:
                    f.write(data)
                return data
            except Exception as e:
                print(f'[tts] GPT-SoVITS failed, falling back to say: {e}', flush=True)
        else:
            print('[tts] no voice selected, falling back to say', flush=True)
    return synth_say(text, lang)


class BrowserWorker:
    def __init__(self):
        self.q = queue.Queue()
        self.thread = threading.Thread(target=self._run, daemon=True)
        self.thread.start()

    def _run(self):
        try:
            from playwright.sync_api import sync_playwright
            self.pw = sync_playwright().start()
            self.browser = self.pw.chromium.launch(
                channel='chrome',
                headless=BROWSER_HEADLESS,
                args=['--no-sandbox', '--disable-dev-shm-usage'],
            )
            self.context = self.browser.new_context(viewport={'width': 1280, 'height': 900})
            self.page = self.context.new_page()
            self.page.set_default_timeout(15000)
            BROWSER_STATE['ready'] = True
            BROWSER_STATE['error'] = ''
        except Exception as e:
            BROWSER_STATE['error'] = str(e)
            print(f'[browser] init failed: {e}', flush=True)
            return
        while True:
            item = self.q.get()
            if item is None:
                break
            action, args, fut = item
            try:
                fut.set_result(self._do(action, args))
            except Exception as e:
                fut.set_exception(e)

    def _do(self, action, args):
        page = self.page
        if action == 'status':
            return dict(BROWSER_STATE)
        if action == 'remember':
            return {}
        if action == 'open_url':
            url = str(args.get('url', '')).strip()
            if not url:
                raise ValueError('url is required')
            if not re.match(r'^[a-z]+://', url, re.I):
                url = 'https://' + url
            page.goto(url, wait_until='domcontentloaded', timeout=30000)
            BROWSER_STATE.update(url=page.url, title=page.title())
            return {'url': page.url, 'title': page.title()}
        if action == 'search':
            q = str(args.get('query', '')).strip()
            if not q:
                raise ValueError('query is required')
            url = 'https://www.bing.com/search?q=' + urllib.parse.quote(q)
            page.goto(url, wait_until='domcontentloaded', timeout=30000)
            BROWSER_STATE.update(url=page.url, title=page.title())
            return {'url': page.url, 'title': page.title(), 'query': q}
        if action == 'click_text':
            text = str(args.get('text', '')).strip()
            if not text:
                raise ValueError('text is required')
            page.get_by_text(text, exact=False).first.click(timeout=10000)
            page.wait_for_timeout(800)
            BROWSER_STATE.update(url=page.url, title=page.title())
            return {'url': page.url, 'title': page.title(), 'clicked': text}
        if action == 'read_page':
            text = page.inner_text('body')
            text = re.sub(r'\n{3,}', '\n\n', text).strip()
            BROWSER_STATE.update(url=page.url, title=page.title())
            return {'url': page.url, 'title': page.title(), 'text': text[:12000], 'truncated': len(text) > 12000}
        if action == 'screenshot':
            name = f"shot-{int(__import__('time').time())}.png"
            path = os.path.join(BROWSER_ARTIFACTS, name)
            page.screenshot(path=path, full_page=False)
            return {'path': path, 'url': page.url, 'title': page.title()}
        if action == 'scroll':
            delta = int(args.get('delta', 800))
            page.mouse.wheel(0, delta)
            page.wait_for_timeout(300)
            return {'delta': delta, 'url': page.url}
        if action == 'back':
            page.go_back(wait_until='domcontentloaded', timeout=30000)
            BROWSER_STATE.update(url=page.url, title=page.title())
            return {'url': page.url, 'title': page.title()}
        if action == 'forward':
            page.go_forward(wait_until='domcontentloaded', timeout=30000)
            BROWSER_STATE.update(url=page.url, title=page.title())
            return {'url': page.url, 'title': page.title()}
        if action == 'reload':
            page.reload(wait_until='domcontentloaded', timeout=30000)
            return {'url': page.url, 'title': page.title()}
        if action == 'close':
            global BROWSER_WORKER
            try:
                self.browser.close()
            finally:
                BROWSER_STATE['ready'] = False
                BROWSER_WORKER = None
            return {'closed': True}
        raise ValueError(f'unsupported browser action: {action}')

    def run(self, action, args=None):
        if not self.thread.is_alive():
            raise RuntimeError('browser worker is not running')
        fut = concurrent.futures.Future()
        self.q.put((action, args or {}, fut))
        return fut.result(timeout=120)


def get_browser():
    global BROWSER_WORKER
    with BROWSER_LOCK:
        if BROWSER_WORKER is None:
            BROWSER_WORKER = BrowserWorker()
        return BROWSER_WORKER


def browser_log(action, args, result=None, error=None):
    try:
        with open(BROWSER_LOG, 'a', encoding='utf-8') as f:
            f.write(json.dumps({
                'ts': now_iso(),
                'action': action,
                'args': args or {},
                'result': result if isinstance(result, (str, int, float, bool, type(None))) else 'ok',
                'error': str(error) if error else None,
            }, ensure_ascii=False) + '\n')
    except Exception:
        pass


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def send_json(self, obj, status=200):
        data = json.dumps(obj, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def read_json(self):
        length = int(self.headers.get('Content-Length', 0))
        if length <= 0 or length > MAX_VOICE_BYTES + 2 * 1024 * 1024:
            raise ValueError('invalid body size')
        body = self.rfile.read(length)
        return json.loads(body.decode('utf-8'))

    def do_POST(self):
        if self.path.startswith('/computer'):
            try:
                payload = self.read_json()
                action = str(payload.get('action', '')).strip()
                args = payload.get('args') or {}
                if action not in BROWSER_ALLOWED:
                    raise ValueError(f'action not allowed: {action}')
                result = get_browser().run(action, args)
                browser_log(action, args, result=result)
                self.send_json({'ok': True, 'action': action, 'result': result, 'state': BROWSER_STATE})
            except Exception as e:
                browser_log('error', {}, error=e)
                self.send_json({'ok': False, 'error': str(e), 'state': BROWSER_STATE}, 400)
            return

        if self.path.startswith('/memory/search'):
            try:
                payload = self.read_json()
                self.send_json({'ok': True, 'memories': memory_search(payload.get('query', ''), payload.get('limit', 8))})
            except Exception as e:
                self.send_json({'ok': False, 'error': str(e)}, 400)
            return

        if self.path.startswith('/memory/clear'):
            try:
                memory_clear()
                self.send_json({'ok': True, 'memories': []})
            except Exception as e:
                self.send_json({'ok': False, 'error': str(e)}, 400)
            return

        if self.path.startswith('/memory'):
            try:
                payload = self.read_json()
                item = memory_add(
                    payload.get('text', ''),
                    payload.get('source', 'user'),
                    payload.get('tags', ''),
                    payload.get('ttl_days', 30),
                )
                self.send_json({'ok': True, 'memory': item})
            except Exception as e:
                self.send_json({'ok': False, 'error': str(e)}, 400)
            return

        if self.path.startswith('/voice/select'):
            try:
                payload = self.read_json()
                vid = str(payload.get('id', ''))
                if vid not in INDEX['voices']:
                    self.send_json({'ok': False, 'error': 'voice not found'}, 404)
                    return
                INDEX['current'] = vid
                save_index()
                self.send_json({'ok': True, 'current': voice_public(current_voice())})
            except Exception as e:
                self.send_json({'ok': False, 'error': str(e)}, 400)
            return

        if self.path.startswith('/voice/delete'):
            try:
                payload = self.read_json()
                vid = str(payload.get('id', ''))
                voice = INDEX['voices'].pop(vid, None)
                if voice:
                    path = voice_file(voice)
                    if path and os.path.exists(path):
                        os.remove(path)
                    if INDEX.get('current') == vid:
                        INDEX['current'] = next(iter(INDEX['voices']), None)
                    save_index()
                self.send_json({'ok': True, 'current': voice_public(current_voice())})
            except Exception as e:
                self.send_json({'ok': False, 'error': str(e)}, 400)
            return

        if self.path.startswith('/voice'):
            try:
                payload = self.read_json()
                raw = str(payload.get('data', ''))
                if ',' in raw and raw.startswith('data:'):
                    raw = raw.split(',', 1)[1]
                data = base64.b64decode(raw, validate=True)
                if not data or len(data) > MAX_VOICE_BYTES:
                    raise ValueError('audio file is empty or too large')
                transcript = str(payload.get('transcript', '')).strip()
                if not transcript:
                    raise ValueError('transcript is required')
                name = str(payload.get('name', '')).strip()[:60] or 'voice'
                lang = str(payload.get('lang', 'zh')).strip() or 'zh'
                ext = str(payload.get('ext', 'wav')).lower().lstrip('.')
                ext = re.sub(r'[^a-z0-9]', '', ext)[:5] or 'wav'
                if ext not in ALLOWED_EXT:
                    raise ValueError('unsupported audio extension')
                vid = uuid.uuid4().hex[:12]
                filename = f'{vid}.{ext}'
                path = os.path.join(VOICES_DIR, filename)
                with open(path, 'wb') as f:
                    f.write(data)
                voice = {
                    'id': vid,
                    'name': name,
                    'transcript': transcript,
                    'lang': lang,
                    'file': filename,
                    'created': int(__import__('time').time()),
                }
                INDEX['voices'][vid] = voice
                INDEX['current'] = vid
                save_index()
                self.send_json({'ok': True, 'current': voice_public(voice)})
            except Exception as e:
                self.send_json({'ok': False, 'error': str(e)}, 400)
            return

        if self.path.startswith('/api/chat'):
            try:
                payload = self.read_json()
                llm = request_llm(payload)
                body = {
                    'model': llm['model'],
                    'messages': payload.get('messages') or [],
                    'temperature': payload.get('temperature', 0.7),
                }
                if payload.get('response_format') and llm['provider'] != 'gemini':
                    body['response_format'] = payload['response_format']
                headers = {
                    'Content-Type': 'application/json',
                    'Authorization': f"Bearer {llm['api_key']}",
                }
                if llm['provider'] == 'openrouter':
                    headers['HTTP-Referer'] = 'http://127.0.0.1:8017'
                    headers['X-Title'] = 'Reactive Avatar'
                req = urllib.request.Request(
                    llm['api_url'],
                    data=json.dumps(body, ensure_ascii=False).encode('utf-8'),
                    headers=headers,
                    method='POST',
                )
                try:
                    with urllib.request.urlopen(req, timeout=120, context=SSL_CTX) as res:
                        data = res.read()
                        status = res.status
                except urllib.error.HTTPError as exc:
                    data = exc.read()
                    status = exc.code
                self.send_response(status)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.send_header('Content-Length', str(len(data)))
                self.end_headers()
                self.wfile.write(data)
            except Exception as e:
                self.send_json({'error': str(e)}, 400)
            return

        if self.path.startswith('/llm'):
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length)
            auth = self.headers.get('Authorization', '')
            with tempfile.TemporaryDirectory() as d:
                out = os.path.join(d, 'out.json')
                args = [
                    'curl', '-sS', '-o', out, '-w', '%{http_code}', '-X', 'POST',
                    'https://opencode.ai/inference/openai/v1/chat/completions',
                    '-H', 'Content-Type: application/json',
                    '-H', f'Authorization: {auth}',
                    '--data-binary', '@-', '--max-time', '120',
                ]
                try:
                    p = subprocess.run(args, input=body, capture_output=True, timeout=130)
                except Exception as e:
                    self.send_error(502, str(e))
                    return
                if p.returncode != 0:
                    self.send_error(502, p.stderr.decode(errors='ignore')[:200])
                    return
                status = int(p.stdout.decode().strip() or '502')
                with open(out, 'rb') as f:
                    data = f.read()
            self.send_response(status)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return
        self.send_error(404)

    def do_GET(self):
        if self.path.startswith('/computer'):
            self.send_json({'ok': True, 'state': BROWSER_STATE})
            return
        if self.path.startswith('/memory'):
            q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
            limit = (q.get('limit') or ['20'])[0]
            self.send_json({'ok': True, 'memories': memory_list(limit)})
            return
        if self.path.startswith('/voice'):
            voices = [
                voice_public(v)
                for v in INDEX['voices'].values()
                if v.get('id') and os.path.exists(voice_file(v) or '')
            ]
            self.send_json({'ok': True, 'current': voice_public(current_voice()), 'voices': voices})
            return
        if self.path.startswith('/tts'):
            q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
            text = (q.get('text') or [''])[0].strip()[:400]
            lang = (q.get('lang') or ['zh'])[0]
            if not text:
                self.send_error(400, 'missing text')
                return
            try:
                data = synth(text, lang)
            except Exception as e:
                self.send_error(500, str(e))
                return
            self.send_response(200)
            self.send_header('Content-Type', 'audio/wav')
            self.send_header('Content-Length', str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return
        super().do_GET()


if __name__ == '__main__':
    load_index()
    init_memory()
    print(f'[tts] engine={TTS_ENGINE} api={TTS_API}', flush=True)
    print(f'[memory] {DB_PATH}', flush=True)
    print(f'[tts] voice={voice_public(current_voice())}', flush=True)
    print(f'[tts] cache={CACHE_DIR}', flush=True)
    http.server.ThreadingHTTPServer(('127.0.0.1', 8017), Handler).serve_forever()
