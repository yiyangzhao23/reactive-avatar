# Custom voice (optional)

The avatar works without this folder: if GPT-SoVITS is unavailable, `/tts`
falls back to macOS `say`.

To use a fixed, custom voice:

1. Install GPT-SoVITS somewhere local (see its README).
2. Put a 3–10 second clean reference recording in this folder, e.g.
   `voice/reference.wav`.
3. Start the GPT-SoVITS API:

   ```sh
   ./voice/start_tts.sh
   ```

4. Start the avatar with the reference path and its transcript:

   ```sh
   export TTS_ENGINE=gpt-sovits
   export TTS_REF="$PWD/voice/reference.wav"
   export TTS_PROMPT="the exact words spoken in the reference clip"
   export TTS_PROMPT_LANG=zh
   python3 server.py
   ```

Optional settings:

```sh
export TTS_API=http://127.0.0.1:9880/tts
export TTS_SPEED=1.0
export TTS_SEED=42
export TTS_GAIN_DB=8
export TTS_CACHE_VERSION=my-voice-v1
```

Generated audio is cached in `voice/cache/` and is not committed.

## Privacy

A voice recording is biometric data. Only use your own voice, or a voice you
have explicit permission to clone. Do not commit raw recordings or reference
audio to a public repository.

## Note

`start_tts.sh` expects GPT-SoVITS to be installed at `../.gsv/GPT-SoVITS`
relative to this project. Adjust `BASE` if yours is elsewhere.
