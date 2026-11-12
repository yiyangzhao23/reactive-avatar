import array
import hashlib
import http.server
import io
import json
import os
import subprocess
import tempfile
import urllib.error
import urllib.parse
import urllib.request
import wave


ROOT = os.path.dirname(os.path.abspath(__file__))
VOICE_DIR = os.path.join(ROOT, 'voice')
CACHE_DIR = os.path.join(VOICE_DIR, 'cache')
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


def cache_path(text: str, lang: str) -> str:
    key = f'{TTS_CACHE_VERSION}|{lang}|{text}'.encode('utf-8')
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


def synth_gpt_sovits(text: str, lang: str) -> bytes:
    if not TTS_REF:
        raise RuntimeError('TTS_REF is not set; add a reference audio and export TTS_REF')
    if not TTS_PROMPT:
        raise RuntimeError('TTS_PROMPT is not set; export the reference audio transcript')
    if not os.path.exists(TTS_REF):
        raise FileNotFoundError(f'GPT-SoVITS reference audio not found: {TTS_REF}')
    payload = {
        'text': text,
        'text_lang': 'en' if lang == 'en' else 'zh',
        'ref_audio_path': TTS_REF,
        'prompt_text': TTS_PROMPT,
        'prompt_lang': TTS_PROMPT_LANG,
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
        cp = cache_path(text, lang)
        if os.path.exists(cp):
            with open(cp, 'rb') as f:
                return f.read()
        try:
            data = boost_wav(synth_gpt_sovits(text, lang), TTS_GAIN_DB)
            with open(cp, 'wb') as f:
                f.write(data)
            return data
        except Exception as e:
            print(f'[tts] GPT-SoVITS failed, falling back to say: {e}', flush=True)
    return synth_say(text, lang)


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def do_POST(self):
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
    print(f'[tts] engine={TTS_ENGINE} api={TTS_API}', flush=True)
    print(f'[tts] ref={TTS_REF}', flush=True)
    print(f'[tts] cache={CACHE_DIR}', flush=True)
    http.server.ThreadingHTTPServer(('127.0.0.1', 8017), Handler).serve_forever()
