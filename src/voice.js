let stream = null;
let ctx = null;
let source = null;
let proc = null;
let sink = null;
let chunks = [];
let recording = false;
let sampleRate = 0;

export function isRecording() {
  return recording;
}

export async function startRecording() {
  stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const AC = window.AudioContext || window.webkitAudioContext;
  ctx = new AC();
  if (ctx.state === 'suspended') await ctx.resume();
  sampleRate = ctx.sampleRate;
  source = ctx.createMediaStreamSource(stream);
  proc = ctx.createScriptProcessor(4096, 1, 1);
  sink = ctx.createGain();
  sink.gain.value = 0;
  chunks = [];
  proc.onaudioprocess = (e) => {
    if (recording) chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
  };
  source.connect(proc);
  proc.connect(sink);
  sink.connect(ctx.destination);
  recording = true;
}

export function stopRecording() {
  if (!recording) return null;
  recording = false;
  try { proc.disconnect(); } catch {}
  try { source.disconnect(); } catch {}
  try { sink.disconnect(); } catch {}
  stream?.getTracks().forEach((t) => t.stop());
  ctx?.close();
  proc = source = sink = stream = ctx = null;

  const total = chunks.reduce((n, c) => n + c.length, 0);
  if (total < sampleRate * 0.3) {
    chunks = [];
    return null;
  }
  const merged = new Float32Array(total);
  let off = 0;
  for (const c of chunks) { merged.set(c, off); off += c.length; }
  chunks = [];
  return encodeWav(merged, sampleRate);
}

function encodeWav(samples, rate) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const str = (offset, s) => { for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i)); };
  str(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  str(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  let off = 44;
  for (let i = 0; i < samples.length; i++, off += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([view], { type: 'audio/wav' });
}

async function blobToBase64(blob) {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  const step = 0x8000;
  for (let i = 0; i < buf.length; i += step) {
    binary += String.fromCharCode.apply(null, buf.subarray(i, i + step));
  }
  return btoa(binary);
}

export async function transcribe(blob, key, langName) {
  const data = await blobToBase64(blob);
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [
            { text: `Transcribe this audio to text. The speaker is likely speaking ${langName}. Return only the transcription, no extra words or quotes.` },
            { inline_data: { mime_type: 'audio/wav', data } },
          ],
        }],
        generationConfig: { temperature: 0 },
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);
  const json = await res.json();
  const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ?? '';
  return text.trim();
}
