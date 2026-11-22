// Gemini Live API: streaming microphone + screen frames + native audio.
// Client-to-server (BYOK). For production, use ephemeral tokens.
const LIVE_URL = (key) =>
  `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${encodeURIComponent(key)}`;

const b64 = (bytes) => {
  let binary = '';
  const chunk = 0x8000;
  const view = new Uint8Array(bytes);
  for (let i = 0; i < view.length; i += chunk) {
    binary += String.fromCharCode.apply(null, view.subarray(i, i + chunk));
  }
  return btoa(binary);
};

const b64ToBytes = (data) => {
  const bin = atob(data);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

function resampleTo16k(input, inputRate) {
  if (inputRate === 16000) {
    const out = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) out[i] = Math.max(-32768, Math.min(32767, input[i] * 32767));
    return out;
  }
  const ratio = inputRate / 16000;
  const outLen = Math.max(1, Math.floor(input.length / ratio));
  const out = new Int16Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const idx = i * ratio;
    const i0 = Math.floor(idx);
    const i1 = Math.min(input.length - 1, i0 + 1);
    const frac = idx - i0;
    const v = input[i0] * (1 - frac) + input[i1] * frac;
    out[i] = Math.max(-32768, Math.min(32767, v * 32767));
  }
  return out;
}

export class GeminiLive {
  constructor({ getLang, system, onStatus, onUserText, onUserInterim, onModelText, onLevel, onSpeaking, onError }) {
    this.getLang = getLang || (() => 'zh');
    this.system = system || '';
    this.onStatus = onStatus || (() => {});
    this.onUserText = onUserText || (() => {});
    this.onUserInterim = onUserInterim || (() => {});
    this.onModelText = onModelText || (() => {});
    this.onLevel = onLevel || (() => {});
    this.onSpeaking = onSpeaking || (() => {});
    this.onError = onError || (() => {});
    this.ws = null;
    this.active = false;
    this.ready = false;
    this.micStream = null;
    this.micCtx = null;
    this.micSource = null;
    this.micProc = null;
    this.micSink = null;
    this.playCtx = null;
    this.analyser = null;
    this.levelTimer = null;
    this.frameTimer = null;
    this.sources = new Set();
    this.nextTime = 0;
    this.outText = '';
    this.screenVideo = null;
    this.frameCanvas = null;
    this.speakOffTimer = null;
    this.startResolve = null;
    this.startReject = null;
  }

  async start({ apiKey, model = 'gemini-3.8-live', screenVideo = null } = {}) {
    if (!apiKey) throw new Error('missing Gemini API key');
    if (this.active) return;
    this.active = true;
    this.screenVideo = screenVideo;
    this.onStatus('connecting');
    const ready = new Promise((resolve, reject) => {
      this.startResolve = resolve;
      this.startReject = reject;
    });
    this.ws = new WebSocket(LIVE_URL(apiKey));
    const timeout = setTimeout(() => {
      if (!this.ready) {
        this.startReject?.(new Error('Live setup timeout'));
        this.stop();
      }
    }, 20000);
    this.ws.onopen = () => {
      const lang = this.getLang() === 'en' ? 'en-US' : 'zh-CN';
      const system = this.system || '你是小可，一个温暖、简洁的 3D 虚拟伙伴。';
      this.ws.send(JSON.stringify({
        setup: {
          model: `models/${model}`,
          responseModalities: ['AUDIO'],
          systemInstruction: { parts: [{ text: system }] },
          inputAudioTranscription: { languageCodes: [lang] },
          outputAudioTranscription: { languageCodes: [lang] },
          realtimeInputConfig: {
            automaticActivityDetection: {
              startOfSpeechSensitivity: 'START_SENSITIVITY_HIGH',
              endOfSpeechSensitivity: 'END_SENSITIVITY_HIGH',
              silenceDurationMs: 700,
            },
          },
        },
      }));
    };
    this.ws.onmessage = async (event) => {
      let raw = event.data;
      if (raw instanceof Blob) raw = await raw.text();
      this._handle(raw);
    };
    this.ws.onerror = () => {
      this.onError('websocket error');
      this.startReject?.(new Error('websocket error'));
    };
    this.ws.onclose = (e) => {
      clearTimeout(timeout);
      if (this.active) this.onStatus(`closed ${e.code || ''}`.trim());
      this.startReject?.(new Error(`websocket closed ${e.code || ''}`));
      this.stop();
    };
    await ready;
    this.ready = true;
    this.active = true;
    this.onStatus('connected');
    await this._startMic();
    this._startScreenFrames();
    this._startLevelMeter();
  }

  _handle(raw) {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    if (msg.setupComplete) {
      this.ready = true;
      this.startResolve?.();
      return;
    }
    const sc = msg.serverContent;
    if (!sc) return;
    if (sc.interrupted) {
      this._stopPlayback();
      this.onSpeaking(false);
      this.outText = '';
    }
    if (sc.inputTranscription?.text) this.onUserText(sc.inputTranscription.text);
    if (sc.interimInputTranscription?.text) this.onUserInterim(sc.interimInputTranscription.text);
    if (sc.outputTranscription?.text) this.outText += sc.outputTranscription.text;
    if (sc.modelTurn?.parts) {
      for (const part of sc.modelTurn.parts) {
        const data = part.inlineData?.data ?? part.inline_data?.data;
        if (data) this._playPcm(data);
      }
    }
    if (sc.turnComplete) {
      const text = this.outText.trim();
      this.outText = '';
      if (text) this.onModelText(text);
      if (this.sources.size === 0) this.onSpeaking(false);
    }
  }

  async _startMic() {
    this.micStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    const AC = window.AudioContext || window.webkitAudioContext;
    this.micCtx = new AC();
    if (this.micCtx.state === 'suspended') await this.micCtx.resume();
    this.micSource = this.micCtx.createMediaStreamSource(this.micStream);
    this.micProc = this.micCtx.createScriptProcessor(4096, 1, 1);
    this.micSink = this.micCtx.createGain();
    this.micSink.gain.value = 0;
    this.micProc.onaudioprocess = (e) => {
      if (!this.active || !this.ready) return;
      const pcm = resampleTo16k(e.inputBuffer.getChannelData(0), this.micCtx.sampleRate);
      this._send({
        realtimeInput: {
          audio: { data: b64(pcm.buffer), mimeType: 'audio/pcm;rate=16000' },
        },
      });
    };
    this.micSource.connect(this.micProc);
    this.micProc.connect(this.micSink);
    this.micSink.connect(this.micCtx.destination);
  }

  setScreenVideo(video) {
    this.screenVideo = video;
  }

  _startScreenFrames() {
    this.frameCanvas = document.createElement('canvas');
    this.frameCanvas.width = 640;
    this.frameCanvas.height = 360;
    this.frameTimer = setInterval(() => {
      const video = this.screenVideo;
      if (!this.active || !video || !video.videoWidth) return;
      const ctx = this.frameCanvas.getContext('2d');
      ctx.drawImage(video, 0, 0, this.frameCanvas.width, this.frameCanvas.height);
      const data = this.frameCanvas.toDataURL('image/jpeg', 0.6).split(',')[1];
      this._send({ realtimeInput: { video: { data, mimeType: 'image/jpeg' } } });
    }, 1000);
  }

  _startLevelMeter() {
    const AC = window.AudioContext || window.webkitAudioContext;
    this.playCtx = new AC({ sampleRate: 24000 });
    this.analyser = this.playCtx.createAnalyser();
    this.analyser.fftSize = 512;
    this.analyser.connect(this.playCtx.destination);
    this.nextTime = this.playCtx.currentTime;
    const data = new Uint8Array(this.analyser.fftSize);
    this.levelTimer = setInterval(() => {
      if (!this.analyser) return;
      this.analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / data.length);
      this.onLevel(Math.min(1, rms * 4));
    }, 50);
  }

  _playPcm(data) {
    if (!this.playCtx) return;
    const bytes = b64ToBytes(data);
    const pcm = new Int16Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 2));
    const buffer = this.playCtx.createBuffer(1, pcm.length, 24000);
    const ch = buffer.getChannelData(0);
    for (let i = 0; i < pcm.length; i++) ch[i] = pcm[i] / 32768;
    const src = this.playCtx.createBufferSource();
    src.buffer = buffer;
    src.connect(this.analyser);
    const when = Math.max(this.playCtx.currentTime + 0.02, this.nextTime);
    src.start(when);
    this.nextTime = when + buffer.duration;
    this.sources.add(src);
    this.onSpeaking(true);
    src.onended = () => {
      this.sources.delete(src);
      if (this.sources.size === 0) this.onSpeaking(false);
    };
  }

  _stopPlayback() {
    for (const src of this.sources) {
      try { src.stop(); } catch {}
    }
    this.sources.clear();
    this.nextTime = this.playCtx ? this.playCtx.currentTime : 0;
    this.onLevel(0);
  }

  _send(obj) {
    if (this.ws?.readyState === WebSocket.OPEN && this.ws.bufferedAmount < 1_000_000) {
      this.ws.send(JSON.stringify(obj));
    }
  }

  sendText(text) {
    const value = String(text || '').trim();
    if (!value) return;
    this._send({ realtimeInput: { text: value } });
  }

  stop() {
    this.active = false;
    this.ready = false;
    if (this.ws) {
      try { this.ws.close(); } catch {}
      this.ws = null;
    }
    if (this.frameTimer) clearInterval(this.frameTimer);
    if (this.levelTimer) clearInterval(this.levelTimer);
    if (this.speakOffTimer) clearTimeout(this.speakOffTimer);
    this.frameTimer = this.levelTimer = this.speakOffTimer = null;
    this._stopPlayback();
    try { this.micProc?.disconnect(); } catch {}
    try { this.micSource?.disconnect(); } catch {}
    try { this.micSink?.disconnect(); } catch {}
    try { this.micStream?.getTracks().forEach((t) => t.stop()); } catch {}
    try { this.micCtx?.close(); } catch {}
    try { this.playCtx?.close(); } catch {}
    this.micStream = this.micCtx = this.micSource = this.micProc = this.micSink = null;
    this.playCtx = this.analyser = null;
    this.onLevel(0);
    this.onSpeaking(false);
    this.onStatus('closed');
  }
}
