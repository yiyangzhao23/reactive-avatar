# Reactive Avatar · 小可

A real-time 3D virtual companion prototype: VRM avatar + webcam/screen perception
+ LLM chat + local TTS + short-term memory + autonomous gestures.

The browser renders the character; a small Python standard-library server serves
the page and proxies model/TTS requests.

## Features

- 3D VRM avatar with blinking, breathing, gaze tracking, expressions and gestures
- Webcam perception via MediaPipe (face position, smile, blink)
- Screen sharing + local brightness sensing + optional vision-model screenshots
- Providers: DeepSeek (text), Gemini (multimodal), OpenCode (Console)
- Local TTS via macOS `say`; optional fixed voice via GPT-SoVITS
- Hands-free voice mode: browser speech recognition with interim transcripts,
  automatic sentence-level TTS, and barge-in interruption
- Text-driven viseme lip-sync and autonomous gestures: nods when agreeing,
  shakes when disagreeing, waves on greetings/farewells, bows for thanks,
  cheers for good news, etc.
- Voice cloning from the page: upload a 3–10 second clip + transcript to switch
  the GPT-SoVITS voice
- SQLite memory with source, expiry, keyword search, and "remember this"
- Tool intents: "summarize my screen" and "remember this"
- Perception ledger: shows what the model actually receives, with a pause switch
- PWA: installable from the browser; service worker caches the shell

## Quick start

```sh
python3 server.py
# open http://127.0.0.1:8017/
```

No Python packages are required for the basic page. API keys are entered in the
page and stored in the browser's `localStorage`; they are never committed.

### Add an avatar model

`model.vrm` is not included (large file, separate license). Put a VRM model here:

```text
reactive-avatar/model.vrm
```

Without it the app falls back to a simple placeholder character.

### Optional: custom voice by uploading a file

Open the page, expand **声音克隆 / Voice cloning**, upload a clean 3–10 second
clip, enter its exact transcript, and click **使用这个声音**. The server saves it
under `voice/voices/` and switches TTS to that voice. Uploaded audio is
git-ignored.

You can also configure it from the command line. Install GPT-SoVITS separately,
add a 3–10 second reference clip, then:

```sh
export TTS_ENGINE=gpt-sovits
export TTS_REF="$PWD/voice/reference.wav"
export TTS_PROMPT="exact transcript of the reference clip"
export TTS_PROMPT_LANG=zh
./voice/start_tts.sh   # in another terminal
python3 server.py
```

If GPT-SoVITS is unavailable, `/tts` automatically falls back to `say`.

See [`voice/README.md`](voice/README.md) for configuration and privacy notes.

## Architecture

```text
camera / screen
  → browser perception (MediaPipe, Canvas)
  → observation summary (+ optional screenshot)
  → /llm or provider API
  → JSON {emotion, line, action}
  → VRM expression + viseme + gesture + sentence-level TTS
  → SQLite memory (source, expiry, search)
```

| Path | Purpose |
|---|---|
| `index.html` | page layout |
| `styles.css` | UI styles |
| `src/main.js` | UI, reaction loop, gesture dispatch, TTS playback |
| `src/avatar.js` | Three.js + VRM avatar, expressions, gestures |
| `src/perception.js` | webcam, screen share, MediaPipe |
| `src/brain.js` | model calls, prompts, memory, autonomous gesture inference |
| `src/voice.js` | microphone recording, transcription, hands-free recognition |
| `server.py` | static server, `/llm`, `/tts`, `/voice`, `/memory` |
| `manifest.webmanifest`, `sw.js` | PWA install + shell cache |
| `voice/` | optional GPT-SoVITS setup |

## Gestures

The model is asked to return an `action` with its reply. If it returns `none`,
a local inference layer checks the user's question and the reply:

- agreement / yes → `nod`
- disagreement / no → `shake`
- greeting / farewell → `wave`
- thanks → `bow`
- celebration / good news → `cheer`
- pointing → `point`
- thinking → `think`

Explicit requests such as “挥挥手” or “点点头” also work.

## Privacy and limits

- Webcam and screen frames stay local unless you use a vision provider.
- API keys live in `localStorage`; this is a prototype, not a secure product.
- The server binds to `127.0.0.1` and has no authentication or rate limiting.
- Memory is stored locally in `memory.db`; it has source and expiry fields, but
  the prototype does not encrypt the database.
- Hands-free recognition uses the browser's speech service; availability and
  language support depend on the browser.
- Do not clone a voice without consent. Raw recordings are git-ignored.

## Install as an app

Serve the page from `http://127.0.0.1:8017/` and use the browser's install
button. The manifest and service worker cache the app shell; model/TTS/memory
requests always go to the local server.

## Not included

- `model.vrm` (add your own, with a compatible license)
- voice recordings, reference audio, test audio
- `.gsv/` (local GPT-SoVITS install and models)
- `memory.db` and API keys (local runtime data)
