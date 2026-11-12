import array
import base64
import hashlib
import http.server
import io
import json
import os
import re
import subprocess
import tempfile
import urllib.error
import urllib.parse
import urllib.request
import uuid
import wave


ROOT = os.path.dirname(os.path.abspath(__file__))
VOICE_DIR = os.path.join(ROOT, 'voice')
VOICES_DIR = os.path.join(VOICE_DIR, 'voices')
CACHE_DIR = os.path.join(VOICE_DIR, 'cache')
INDEX_PATH = os.path.join(VOICES_DIR, 'index.json')
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
    print(f'[tts] engine={TTS_ENGINE} api={TTS_API}', flush=True)
    print(f'[tts] voice={voice_public(current_voice())}', flush=True)
    print(f'[tts] cache={CACHE_DIR}', flush=True)
    http.server.ThreadingHTTPServer(('127.0.0.1', 8017), Handler).serve_forever()
