import * as THREE from 'three';
import { createAvatar } from './avatar.js?v=11';
import { startCamera, startScreenShare, startFaceTracking, stopCamera, stopScreenShare, captureScreen, state } from './perception.js?v=11';
import { Brain } from './brain.js?v=11';
import { startRecording, stopRecording, transcribe } from './voice.js?v=11';

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0f1220);
scene.fog = new THREE.Fog(0x0f1220, 6, 14);

const camera = new THREE.PerspectiveCamera(38, canvas.clientWidth / canvas.clientHeight, 0.1, 50);
camera.position.set(0, 1.15, 2.6);
camera.lookAt(0, 1.05, 0);

scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x30204a, 1.1));
const keyLight = new THREE.DirectionalLight(0xffffff, 1.6);
keyLight.position.set(2, 3, 2);
scene.add(keyLight);

const floor = new THREE.Mesh(
  new THREE.CircleGeometry(6, 48),
  new THREE.MeshStandardMaterial({ color: 0x1b1f36 })
);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

let avatar = null;
let lastEmotion = 'neutral';
createAvatar(scene).then((a) => {
  avatar = a;
  if (a.frame) {
    const { height, top, centerX } = a.frame;
    const topGap = 0.14;
    const visibleFrac = 1.12;
    const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const dist = height / (2 * tan * visibleFrac);
    const targetY = top - dist * tan * (1 - 2 * topGap);
    camera.position.set(centerX, targetY, dist);
    camera.lookAt(centerX, targetY, 0);
  }
  if (lastEmotion !== 'neutral') {
    avatar.setEmotion(lastEmotion);
    clearTimeout(emoTimer);
    emoTimer = setTimeout(() => avatar?.setEmotion('neutral'), 6000);
  }
  setTimeout(() => avatar?.wave?.(), 1200);
});

// ---------- i18n ----------
const I18N = {
  zh: {
    hint: '角色通过摄像头看到你、通过屏幕共享感知你正在看的内容（本地分析），再用 Gemini 或 DeepSeek 生成实时反应与对话。',
    synthetic: '合成角色 · 不是人 · 表情和语言由模型生成',
    ledgerTitle: '感知账本 · 模型实际收到什么',
    ledgerHint: '这里显示本地感知摘要和最近记忆；暂停后不再向模型发送新的观察。',
    pauseOff: '暂停感知', pauseOn: '继续感知',
    ledgerPaused: '感知已暂停：摄像头/屏幕仍在本地，但新的观察不会发送给模型。',
    ledgerEmpty: '暂无记忆。',
    ledgerMemory: '最近记忆：',
    perceptionResumed: '感知已继续：新的观察会再次发送给模型。',
    save: '保存', send: '发送',
    camOff: '开启摄像头', camOn: '摄像头已开启', camStopped: '摄像头已关闭',
    shareOff: '共享屏幕', shareOn: '屏幕共享中', shareStopped: '屏幕共享已停止',
    stCam: '摄像头', stScreen: '屏幕', stFace: '人脸',
    chatPh: '和我打字说点什么…',
    keyPh: { gemini: 'Gemini API Key（能看画面）', deepseek: 'DeepSeek API Key（纯文本）', opencode: 'OpenCode API Key（Console）' },
    providerName: { gemini: 'Gemini（多模态，能看截图）', deepseek: 'DeepSeek（纯文本对话）' },
    savedKey: (p) => `已保存 ${p} 的 API Key`,
    switched: (p) => `已切换为 ${p}`,
    camFail: (m) => `摄像头开启失败: ${m}`,
    shareFail: (m) => `屏幕共享取消: ${m}`,
    camOpen: '摄像头打开啦，我能看到你了！',
    shareOpen: '我现在能看到你的屏幕了！',
    thinking: '正在思考…',
    analyze: '分析当前画面',
    analyzing: '正在分析画面…',
    needScreen: '请先点“共享屏幕”，再分析',
    needGeminiVision: '画面分析需要 Gemini 或 OpenCode Key（DeepSeek 看不到画面）：上方选择并保存 Key',
    analyzeFail: '分析失败: ',
    memoryOn: '剧情记忆：开', memoryOff: '剧情记忆：关',
    clearMemory: '清空记忆', memoryCleared: '剧情记忆已清空', memoryAdded: '已记入剧情记忆',
    micStart: '语音聊天', micStop: '结束录音',
    transcribing: '识别中…',
    needGemini: '语音识别需要 Gemini Key：请在上方选择 Gemini 并保存 Key',
    noSpeech: '没听清，再说一次？',
    sttFail: '语音识别失败: ',
    micFail: '麦克风开启失败: ',
    greeting: '嗨，我是你的虚拟伙伴！开启摄像头和屏幕共享，我就能实时回应你。',
    voiceCloneTitle: '声音克隆（上传参考音频）',
    voiceCloneHint: '上传 3–10 秒干净人声，填写对应文字；会保存到本机并切换为该声音。',
    voiceNamePh: '声音名称（如：小可）',
    voicePromptPh: '这段音频里说的文字（必填）',
    voiceUpload: '使用这个声音',
    voiceRefresh: '刷新',
    voiceUploading: '正在保存声音…',
    voiceUploaded: '已切换声音：',
    voiceNeedFile: '请先选择音频文件',
    voiceNeedPrompt: '请填写参考音频对应的文字',
    voiceTooLong: '参考音频建议 3–10 秒；当前为 ',
    voiceLoadFail: '读取声音列表失败：',
    voiceSelected: '已切换声音：',
    voiceNone: '尚未选择克隆声音',
    voiceCurrent: '当前声音：',
    speech: 'zh-CN', voicePrefix: 'zh',
  },
  en: {
    hint: 'The character sees you through the webcam and senses your screen via screen sharing (analyzed locally), then responds in real time with Gemini or DeepSeek.',
    synthetic: 'Synthetic character · not a person · expressions and language are model-generated',
    ledgerTitle: 'Perception ledger · what the model actually receives',
    ledgerHint: 'This shows the local sensing summary and recent memory. Pause stops new observations from being sent to the model.',
    pauseOff: 'Pause perception', pauseOn: 'Resume perception',
    ledgerPaused: 'Perception paused: camera/screen stay local, but no new observations are sent to the model.',
    ledgerEmpty: 'No memory yet.',
    ledgerMemory: 'Recent memory:',
    perceptionResumed: 'Perception resumed: new observations are sent to the model again.',
    save: 'Save', send: 'Send',
    camOff: 'Start camera', camOn: 'Camera on', camStopped: 'Camera off',
    shareOff: 'Share screen', shareOn: 'Sharing screen', shareStopped: 'Screen sharing stopped',
    stCam: 'Camera', stScreen: 'Screen', stFace: 'Face',
    chatPh: 'Type something to me…',
    keyPh: { gemini: 'Gemini API key (vision)', deepseek: 'DeepSeek API key (text)', opencode: 'OpenCode API key (Console)' },
    providerName: { gemini: 'Gemini (multimodal, sees screenshots)', deepseek: 'DeepSeek (text only)' },
    savedKey: (p) => `Saved the ${p} API key`,
    switched: (p) => `Switched to ${p}`,
    camFail: (m) => `Camera failed: ${m}`,
    shareFail: (m) => `Screen share cancelled: ${m}`,
    camOpen: 'Camera is on — I can see you now!',
    shareOpen: 'I can see your screen now!',
    thinking: 'Thinking…',
    analyze: 'Analyze screen',
    analyzing: 'Analyzing the screen…',
    needScreen: 'Click “Share screen” first, then analyze',
    needGeminiVision: 'Screen analysis needs a Gemini or OpenCode key (DeepSeek cannot see): pick one above and save a key',
    analyzeFail: 'Analysis failed: ',
    memoryOn: 'Story memory: on', memoryOff: 'Story memory: off',
    clearMemory: 'Clear memory', memoryCleared: 'Story memory cleared', memoryAdded: 'Saved to story memory',
    micStart: 'Voice chat', micStop: 'Stop',
    transcribing: 'Transcribing…',
    needGemini: 'Voice input needs a Gemini key: pick Gemini above and save your key',
    noSpeech: "Didn't catch that — try again?",
    sttFail: 'Transcription failed: ',
    micFail: 'Microphone failed: ',
    greeting: "Hi, I'm your virtual companion! Turn on the camera and share your screen, and I'll react in real time.",
    voiceCloneTitle: 'Voice cloning (upload a reference)',
    voiceCloneHint: 'Upload a clean 3–10 second voice clip and its transcript; it is saved locally and selected.',
    voiceNamePh: 'Voice name (e.g. Xiao Ke)',
    voicePromptPh: 'Exact words spoken in the clip (required)',
    voiceUpload: 'Use this voice',
    voiceRefresh: 'Refresh',
    voiceUploading: 'Saving voice…',
    voiceUploaded: 'Voice selected: ',
    voiceNeedFile: 'Choose an audio file first',
    voiceNeedPrompt: 'Enter the transcript of the reference clip',
    voiceTooLong: 'Use a 3–10 second reference; this clip is ',
    voiceLoadFail: 'Could not load voices: ',
    voiceSelected: 'Voice selected: ',
    voiceNone: 'No cloned voice selected',
    voiceCurrent: 'Current voice: ',
    speech: 'en-US', voicePrefix: 'en',
  },
};

let lang = localStorage.getItem('lang') ?? 'zh';
const t = (k) => I18N[lang][k];

// ---------- UI ----------
const $ = (id) => document.getElementById(id);
const camBtn = $('camBtn'), shareBtn = $('shareBtn');
const camPreview = $('camPreview'), screenVideo = $('screenVideo');
const keyInput = $('apiKey');
const providerSel = $('provider');
const langSel = $('lang');
let camOn = false, screenOn = false;

const keyStore = (p) => (p === 'gemini' ? 'geminiKey' : p === 'opencode' ? 'opencodeKey' : 'deepseekKey');
const getProvider = () => localStorage.getItem('provider') ?? 'deepseek';

// ---------- 剧情记忆 ----------
const memoryBtn = $('memoryBtn');
const voiceSel = $('voiceMode');
const VOICE_OPTIONS = [
  { v: 'gemini:Aoede', zh: '声音：自然女声', en: 'Voice: Natural (F)' },
  { v: 'gemini:Kore', zh: '声音：温柔女声', en: 'Voice: Gentle (F)' },
  { v: 'gemini:Charon', zh: '声音：自然男声', en: 'Voice: Natural (M)' },
  { v: 'system', zh: '声音：系统语音', en: 'Voice: System' },
];
function renderVoiceOptions() {
  const cur = localStorage.getItem('voiceMode') || 'gemini:Aoede';
  voiceSel.innerHTML = '';
  for (const o of VOICE_OPTIONS) {
    const el = document.createElement('option');
    el.value = o.v;
    el.textContent = o[lang] || o.zh;
    voiceSel.append(el);
  }
  voiceSel.value = VOICE_OPTIONS.some((o) => o.v === cur) ? cur : 'gemini:Aoede';
  localStorage.setItem('voiceMode', voiceSel.value);
}
const pauseBtn = $('pausePerception');
let memoryOn = localStorage.getItem('storyMemoryOn') === '1';
let perceptionPaused = false;
function loadMemory() {
  try { return JSON.parse(localStorage.getItem('storyMemory') || '[]'); } catch { return []; }
}
function saveMemory(list) {
  localStorage.setItem('storyMemory', JSON.stringify(list.slice(-25)));
}
function memoryContext() {
  const m = loadMemory();
  if (!m.length) return '';
  return m.map((e, i) => `${i + 1}. ${e.text}`).join('\n').slice(-3000);
}
function renderMemory() {
  const n = loadMemory().length;
  memoryBtn.textContent = t(memoryOn ? 'memoryOn' : 'memoryOff') + (memoryOn && n ? ` (${n})` : '');
  memoryBtn.classList.toggle('active', memoryOn);
  renderLedger();
}

function perceptionSummary() {
  const f = state.face;
  const bits = [];
  if (state.cam.on) {
    if (f.detected) {
      const pos = f.x < 0.35 ? 'left' : f.x > 0.65 ? 'right' : 'center';
      bits.push(`camera: face at ${pos}${f.smile > 0.4 ? ', smiling' : ''}${f.blink > 0.5 ? ', blinking' : ''}`);
    } else {
      bits.push('camera: no face');
    }
  } else {
    bits.push('camera: off');
  }
  bits.push(state.screen.on ? 'screen: sharing (frame may be sent to a vision model)' : 'screen: off');
  return bits.join('; ');
}

function renderLedger() {
  const ledger = $('ledger');
  if (!ledger) return;
  const mem = loadMemory();
  const lines = [];
  lines.push(perceptionPaused ? t('ledgerPaused') : `local sensing → ${perceptionSummary()}`);
  lines.push('');
  lines.push(t('ledgerMemory'));
  lines.push(mem.length ? mem.slice(-3).map((e) => `• ${e.text}`).join('\n') : t('ledgerEmpty'));
  ledger.textContent = lines.join('\n');
  ledger.parentElement.classList.toggle('paused', perceptionPaused);
  pauseBtn.textContent = t(perceptionPaused ? 'pauseOn' : 'pauseOff');
  pauseBtn.classList.toggle('active', perceptionPaused);
}

function applyLang() {
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of document.querySelectorAll('[data-i18n-ph]')) el.placeholder = t(el.dataset.i18nPh);
  camBtn.textContent = t(camOn ? 'camOn' : 'camOff');
  shareBtn.textContent = t(screenOn ? 'shareOn' : 'shareOff');
  chatInput.placeholder = t('chatPh');
  keyInput.placeholder = t('keyPh')[providerSel.value];
  renderMemory();
  renderVoiceOptions();
}

function loadKey() {
  keyInput.value = localStorage.getItem(keyStore(providerSel.value)) ?? '';
  keyInput.placeholder = t('keyPh')[providerSel.value];
}

langSel.value = lang;
providerSel.value = localStorage.getItem('provider') ?? 'deepseek';
loadKey();

langSel.onchange = () => {
  lang = langSel.value;
  localStorage.setItem('lang', lang);
  applyLang();
};
providerSel.onchange = () => {
  localStorage.setItem('provider', providerSel.value);
  loadKey();
  log(t('switched')(t('providerName')[providerSel.value]));
};
voiceSel.onchange = () => {
  localStorage.setItem('voiceMode', voiceSel.value);
};

// ---------- 声音克隆 ----------
const voiceFile = $('voiceFile');
const voiceName = $('voiceName');
const voiceLang = $('voiceLang');
const voicePrompt = $('voicePrompt');
const voiceUpload = $('voiceUpload');
const voiceRefresh = $('voiceRefresh');
const voiceSelect = $('voiceSelect');
const voiceStatus = $('voiceStatus');
let voiceData = { current: null, voices: [] };
let voiceDuration = 0;

function setVoiceModeSystem() {
  localStorage.setItem('voiceMode', 'system');
  renderVoiceOptions();
  voiceSel.value = 'system';
}

function renderVoiceList(data) {
  voiceData = data || { current: null, voices: [] };
  voiceSelect.innerHTML = '';
  if (!voiceData.voices || !voiceData.voices.length) {
    const o = document.createElement('option');
    o.value = '';
    o.textContent = t('voiceNone');
    voiceSelect.append(o);
    voiceStatus.textContent = t('voiceNone');
    return;
  }
  for (const v of voiceData.voices) {
    const o = document.createElement('option');
    o.value = v.id;
    o.textContent = v.name || v.id;
    voiceSelect.append(o);
  }
  if (voiceData.current?.id) voiceSelect.value = voiceData.current.id;
  voiceStatus.textContent = voiceData.current
    ? t('voiceCurrent') + (voiceData.current.name || voiceData.current.id)
    : t('voiceNone');
}

async function loadVoices() {
  try {
    const res = await fetch('/voice', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    renderVoiceList(await res.json());
  } catch (e) {
    voiceStatus.textContent = t('voiceLoadFail') + e.message;
  }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = () => reject(r.error || new Error('read failed'));
    r.readAsDataURL(file);
  });
}

voiceFile.onchange = () => {
  const f = voiceFile.files?.[0];
  if (!f) return;
  const url = URL.createObjectURL(f);
  const a = new Audio(url);
  a.onloadedmetadata = () => {
    const d = a.duration;
    voiceDuration = d;
    voiceStatus.textContent = `${f.name} · ${d.toFixed(1)}s`;
    if (d < 3 || d > 10) voiceStatus.textContent = t('voiceTooLong') + `${d.toFixed(1)}s`;
    URL.revokeObjectURL(url);
  };
  a.onerror = () => URL.revokeObjectURL(url);
};

voiceUpload.onclick = async () => {
  const f = voiceFile.files?.[0];
  if (!f) { voiceStatus.textContent = t('voiceNeedFile'); return; }
  if (voiceDuration && (voiceDuration < 3 || voiceDuration > 10)) {
    voiceStatus.textContent = t('voiceTooLong') + `${voiceDuration.toFixed(1)}s`;
    return;
  }
  const transcript = voicePrompt.value.trim();
  if (!transcript) { voiceStatus.textContent = t('voiceNeedPrompt'); return; }
  voiceUpload.disabled = true;
  voiceStatus.textContent = t('voiceUploading');
  try {
    const data = await fileToBase64(f);
    const ext = (f.name.split('.').pop() || 'wav').toLowerCase();
    const res = await fetch('/voice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: voiceName.value.trim() || f.name.replace(/\.[^.]+$/, ''),
        transcript,
        lang: voiceLang.value,
        ext,
        data,
      }),
    });
    const out = await res.json();
    if (!res.ok || !out.ok) throw new Error(out.error || `HTTP ${res.status}`);
    setVoiceModeSystem();
    await loadVoices();
    voiceStatus.textContent = t('voiceUploaded') + (out.current?.name || '');
  } catch (e) {
    voiceStatus.textContent = t('voiceLoadFail') + e.message;
  } finally {
    voiceUpload.disabled = false;
  }
};

voiceRefresh.onclick = loadVoices;

voiceSelect.onchange = async () => {
  const id = voiceSelect.value;
  if (!id) return;
  try {
    const res = await fetch('/voice/select', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    const out = await res.json();
    if (!res.ok || !out.ok) throw new Error(out.error || `HTTP ${res.status}`);
    setVoiceModeSystem();
    voiceStatus.textContent = t('voiceSelected') + (out.current?.name || '');
    if (voiceData.current) voiceData.current = out.current;
  } catch (e) {
    voiceStatus.textContent = t('voiceLoadFail') + e.message;
  }
};
memoryBtn.onclick = () => {
  memoryOn = !memoryOn;
  localStorage.setItem('storyMemoryOn', memoryOn ? '1' : '0');
  renderMemory();
  log(t(memoryOn ? 'memoryOn' : 'memoryOff'));
};
$('clearMemory').onclick = () => {
  saveMemory([]);
  renderMemory();
  log(t('memoryCleared'));
};
pauseBtn.onclick = () => {
  perceptionPaused = !perceptionPaused;
  brain.perceptionPaused = perceptionPaused;
  renderLedger();
  log(perceptionPaused ? t('ledgerPaused') : t('perceptionResumed'));
};
$('saveKey').onclick = () => {
  localStorage.setItem(keyStore(providerSel.value), keyInput.value.trim());
  log(t('savedKey')(providerSel.value));
};

camBtn.onclick = async () => {
  if (camOn) {
    stopCamera();
    camOn = false;
    camBtn.classList.remove('active'); camBtn.textContent = t('camOff');
    $('camDot').classList.remove('on');
    log(t('camStopped'));
    return;
  }
  try {
    const stream = await startCamera(camPreview);
    camOn = true;
    camBtn.classList.add('active'); camBtn.textContent = t('camOn');
    $('camDot').classList.add('on');
    startFaceTracking();
    stream.getVideoTracks()[0].addEventListener('ended', () => {
      camOn = false;
      camBtn.classList.remove('active'); camBtn.textContent = t('camOff');
      $('camDot').classList.remove('on');
      stopCamera();
    });
    react('happy', t('camOpen'));
  } catch (e) { log(t('camFail')(e.message)); }
};

shareBtn.onclick = async () => {
  if (screenOn) {
    stopScreenShare();
    screenOn = false;
    shareBtn.classList.remove('active'); shareBtn.textContent = t('shareOff');
    $('shareDot').classList.remove('on');
    log(t('shareStopped'));
    return;
  }
  try {
    const stream = await startScreenShare(screenVideo);
    screenOn = true;
    shareBtn.classList.add('active'); shareBtn.textContent = t('shareOn');
    $('shareDot').classList.add('on');
    stream.getVideoTracks()[0].addEventListener('ended', () => {
      screenOn = false;
      shareBtn.classList.remove('active'); shareBtn.textContent = t('shareOff');
      $('shareDot').classList.remove('on');
      stopScreenShare();
    });
    react('surprised', t('shareOpen'));
  } catch (e) { log(t('shareFail')(e.message)); }
};

const analyzeBtn = $('analyzeBtn');
analyzeBtn.onclick = async () => {
  if (perceptionPaused) { log(t('ledgerPaused')); return; }
  if (!state.screen.on) { log(t('needScreen')); return; }
  const provider = getProvider();
  const gk = localStorage.getItem(keyStore(provider));
  if (provider === 'deepseek' || !gk) { log(t('needGeminiVision')); return; }
  const thinking = log(t('analyzing'), null, false, 'thinking');
  analyzeBtn.disabled = true;
  try {
    const img = captureScreen();
    if (!img) throw new Error('no frame');
    const mem = memoryOn ? memoryContext() : '';
    let prompt;
    if (memoryOn) {
      prompt = lang === 'zh'
        ? `你是一位游戏助手。用户正在玩解谜/剧情/推理类游戏，这是当前屏幕截图。
已知剧情与线索记忆：
${mem || '（暂无）'}
请只输出 JSON：{"analysis":"...","memory":"..."}
analysis：简体中文，1) 一句话概括当前画面 2) 关键线索/可疑点 3) 2-3 条可执行建议（分点），200 字内。
memory：本次新发现、值得长期记住的事实（一句话）；如果没有新的就输出空字符串。`
        : `You are a game assistant. The user is playing a puzzle/story/detective game; this is the current screen.
Known story memory:
${mem || '(none yet)'}
Output JSON only: {"analysis":"...","memory":"..."}
analysis: in English, 1) one-line summary 2) key clues/suspicious details 3) 2-3 actionable suggestions, under 120 words.
memory: one sentence of new long-term fact; empty string if nothing new.`;
    } else {
      prompt = lang === 'zh'
        ? '你是一位游戏助手。用户正在玩解谜/剧情/推理类游戏，这是他的当前屏幕截图。请用简体中文回答：1) 一句话概括画面中正在发生什么；2) 指出关键线索、物品或可疑细节；3) 给出 2-3 条具体可执行的建议（分点）。控制在 200 字以内，直接给分析，不要客套。'
        : 'You are a game assistant. The user is playing a puzzle/story/detective game; this is their current screen. Reply in English: 1) one line summarizing what is happening; 2) point out key clues, items, or suspicious details; 3) give 2-3 concrete actionable suggestions as bullet points. Under 120 words, no pleasantries.';
    }
    let text;
    if (provider === 'opencode') {
      const res = await fetch('/llm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${gk}` },
        body: JSON.stringify({
          model: 'gemini-3.5-flash-lite',
          messages: [{ role: 'user', content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${img}` } },
          ] }],
          temperature: 0.4,
          ...(memoryOn ? { response_format: { type: 'json_object' } } : {}),
        }),
      });
      if (!res.ok) throw new Error(`OpenCode HTTP ${res.status}`);
      const json = await res.json();
      text = json.choices?.[0]?.message?.content?.trim() ?? '';
    } else {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(gk)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [
              { text: prompt },
              { inline_data: { mime_type: 'image/jpeg', data: img } },
            ] }],
            generationConfig: memoryOn
              ? { temperature: 0.4, responseMimeType: 'application/json' }
              : { temperature: 0.4 },
          }),
        }
      );
      if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);
      const json = await res.json();
      text = json.candidates?.[0]?.content?.parts?.map((x) => x.text).join('').trim() ?? '';
    }
    thinking.remove();
    if (!text) throw new Error('empty');
    if (memoryOn) {
      try {
        const out = JSON.parse(text);
        text = out.analysis || text;
        if (out.memory && out.memory.trim()) {
          const list = loadMemory();
          list.push({ at: Date.now(), text: out.memory.trim() });
          saveMemory(list);
          renderMemory();
          log(t('memoryAdded'));
        }
      } catch { /* 非 JSON 时直接使用原文 */ }
    }
    react('relaxed', text);
  } catch (e) {
    thinking.remove();
    log(t('analyzeFail') + e.message);
  } finally {
    analyzeBtn.disabled = false;
  }
};

function log(text, emotion, isUser = false, extraClass = '') {
  const p = document.createElement('p');
  if (isUser) { p.className = 'user'; p.textContent = text; }
  else if (extraClass) { p.className = extraClass; p.textContent = text; }
  else if (emotion) p.innerHTML = `<span class="emo">[${emotion}]</span>${escapeHtml(text)}`;
  else p.textContent = text;
  const box = $('log');
  box.append(p);
  while (box.children.length > 40) box.firstChild.remove();
  box.scrollTop = box.scrollHeight;
  return p;
}
const escapeHtml = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------- TTS ----------
let speaking = false;
let audioEl = null;
let audioSrc = null;
let audioCtx = null;
let speakSeq = 0;
let voiceLogged = false;
let pendingSpeech = null;
const isSafari = /^((?!chrome|chromium|crios|edg|android).)*safari/i.test(navigator.userAgent);
let voices = [];
const normLang = (s) => (s || '').replace('_', '-');
const CANTONESE = /cantonese|sin-?ji|aasing|粤|粵|yue|hong ?kong/i;
const MANDARIN_NAME = /tingting|ting-ting|meijia|mei-jia|普通话|国语|國語|mandarin/i;

function setTalking(on) {
  speaking = on;
  avatar?.setTalking(on);
}

function refreshVoices() {
  if ('speechSynthesis' in window) voices = speechSynthesis.getVoices();
}
if ('speechSynthesis' in window) {
  refreshVoices();
  speechSynthesis.addEventListener?.('voiceschanged', refreshVoices);
}

function pickVoice(kind) {
  const all = (voices.length ? voices : speechSynthesis.getVoices()).filter((v) => v.lang);
  if (kind === 'zh') {
    const usable = all.filter((v) => !CANTONESE.test(v.name) && !/HK|yue/i.test(normLang(v.lang)));
    const mandarin = usable.filter((v) => /^zh-(CN|SG|TW|Hant)/i.test(normLang(v.lang)));
    return (
      mandarin.find((v) => MANDARIN_NAME.test(v.name)) ||
      mandarin.find((v) => /^zh-CN/i.test(normLang(v.lang))) ||
      mandarin.find((v) => /^zh-SG/i.test(normLang(v.lang))) ||
      mandarin[0] ||
      null
    );
  }
  return all.find((v) => /^en-US/i.test(normLang(v.lang))) || all.find((v) => /^en/i.test(normLang(v.lang))) || null;
}

function getAudioCtx() {
  audioCtx ??= new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

async function speakGemini(text, voiceName, seq) {
  const key = localStorage.getItem('geminiKey');
  if (!key) throw new Error('no gemini key');
  const models = ['gemini-2.5-flash-preview-tts', 'gemini-2.5-pro-preview-tts'];
  let json = null;
  let lastErr = '';
  for (const model of models) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text }] }],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
          },
        }),
      }
    );
    if (res.ok) { json = await res.json(); break; }
    lastErr = `${model} HTTP ${res.status}`;
  }
  if (!json) throw new Error(lastErr || 'Gemini TTS failed');
  const part = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData || p.inline_data);
  const b64 = part?.inlineData?.data ?? part?.inline_data?.data;
  if (!b64) throw new Error('no audio');
  if (seq !== speakSeq) return;
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const pcm = new Int16Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 2));
  const ctx = getAudioCtx();
  const buf = ctx.createBuffer(1, pcm.length, 24000);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < pcm.length; i++) ch[i] = pcm[i] / 32768;
  if (audioSrc) { try { audioSrc.stop(); } catch {} }
  if (audioEl) audioEl.pause();
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.connect(ctx.destination);
  audioSrc = src;
  setTalking(true);
  src.onended = () => { if (audioSrc === src) setTalking(false); };
  src.start();
}

// 优先 Gemini 自然语音（需 Gemini Key），否则用本地服务器 say
async function speak(text) {
  const seq = ++speakSeq;
  const mode = localStorage.getItem('voiceMode') || 'gemini:Aoede';
  if (mode.startsWith('gemini:')) {
    try {
      await speakGemini(text, mode.slice(7), seq);
      if (!voiceLogged) {
        voiceLogged = true;
        const info = document.getElementById('voiceInfo');
        if (info) info.textContent = `语音: Gemini ${mode.slice(7)}`;
      }
      return;
    } catch (e) {
      console.warn('Gemini 语音失败，回退服务器语音', e);
    }
  }
  const L = I18N[lang];
  try {
    const res = await fetch(`/tts?lang=${L.voicePrefix}&text=${encodeURIComponent(text)}`);
    if (!res.ok) throw new Error(`TTS HTTP ${res.status}`);
    const blob = await res.blob();
    if (seq !== speakSeq) return;
    const url = URL.createObjectURL(blob);
    if (audioEl) audioEl.pause();
    const el = new Audio(url);
    audioEl = el;
    el.onplay = () => setTalking(true);
    el.onended = el.onerror = () => { setTalking(false); URL.revokeObjectURL(url); };
    if (!voiceLogged) {
      voiceLogged = true;
      const info = document.getElementById('voiceInfo');
      if (info) info.textContent = lang === 'zh' ? '语音: 婷婷（服务器 TTS）' : '语音: Samantha（服务器 TTS）';
    }
    await el.play();
  } catch (e) {
    if (seq !== speakSeq) return;
    if (e.name === 'NotAllowedError') {
      pendingSpeech = text;
      armResume();
      return;
    }
    console.warn('服务器 TTS 失败', e);
    if (!isSafari) speakBrowser(text);
  }
}

function armResume() {
  const events = ['pointerdown', 'keydown', 'touchstart'];
  const resume = () => {
    events.forEach((ev) => removeEventListener(ev, resume, true));
    const text = pendingSpeech;
    pendingSpeech = null;
    if (text) speak(text);
  };
  events.forEach((ev) => addEventListener(ev, resume, true));
}

function speakBrowser(text) {
  if (!('speechSynthesis' in window)) return;
  const seq = speakSeq;
  let tries = 0;
  const trySpeak = () => {
    if (seq !== speakSeq) return;
    refreshVoices();
    if (voices.length === 0 && tries++ < 6) { setTimeout(trySpeak, 400); return; }
    if (seq !== speakSeq) return;
    speechSynthesis.cancel();
    const L = I18N[lang];
    const u = new SpeechSynthesisUtterance(text);
    u.lang = L.speech;
    u.rate = 1.05;
    const v = pickVoice(L.voicePrefix);
    if (v) { u.voice = v; u.lang = normLang(v.lang); }
    u.onstart = () => setTalking(true);
    u.onend = u.onerror = () => setTalking(false);
    speechSynthesis.speak(u);
  };
  trySpeak();
}

// ---------- 反应调度 ----------
let emoTimer = null;
function react(emotion, line, action = 'none') {
  lastEmotion = emotion;
  avatar?.setEmotion(emotion);
  if (action && action !== 'none') avatar?.playGesture(action);
  $('emoBadge').textContent = emotion;
  log(line, emotion);
  speak(line);
  clearTimeout(emoTimer);
  emoTimer = setTimeout(() => avatar?.setEmotion('neutral'), 6000);
}


const brain = new Brain({
  getKey: () => localStorage.getItem(keyStore(getProvider())) || null,
  getProvider,
  getLang: () => lang,
  onLine: () => {},
  onEmotion: () => {},
});
brain.emit = (emotion, line, action = 'none') => {
  const now = performance.now();
  if (now - (brain.lastEmit ?? 0) < 3500) return;
  brain.lastEmit = now;
  react(emotion, line, action);
};

// ---------- 语音聊天 ----------
const micBtn = $('micBtn');
let voiceRec = false;
micBtn.onclick = async () => {
  if (!voiceRec) {
    try {
      await startRecording();
      voiceRec = true;
      micBtn.classList.add('recording');
      micBtn.textContent = t('micStop');
    } catch (e) { log(t('micFail') + e.message); }
    return;
  }
  voiceRec = false;
  micBtn.classList.remove('recording');
  micBtn.textContent = t('micStart');
  const blob = stopRecording();
  if (!blob) return;
  const gk = localStorage.getItem('geminiKey');
  if (!gk) { log(t('needGemini')); return; }
  const thinking = log(t('transcribing'), null, false, 'thinking');
  try {
    const text = await transcribe(blob, gk, lang === 'zh' ? 'Mandarin Chinese' : 'English');
    thinking.remove();
    if (!text) { log(t('noSpeech')); return; }
    log(text, null, true);
    avatar?.setEmotion('relaxed');
    const reply = await brain.chatUser(text, memoryOn ? memoryContext() : '');
    react(reply.emotion, reply.line, reply.action);
  } catch (e) {
    thinking.remove();
    log(t('sttFail') + e.message);
  }
};

// ---------- 打字聊天 ----------
const chatForm = $('chatForm'), chatInput = $('chatInput'), chatSend = $('chatSend');
chatForm.onsubmit = async (e) => {
  e.preventDefault();
  const text = chatInput.value.trim();
  if (!text) return;
  chatInput.value = '';
  log(text, null, true);
  avatar?.setEmotion('relaxed');
  const thinking = log(t('thinking'), null, false, 'thinking');
  chatSend.disabled = true;
  const reply = await brain.chatUser(text, memoryOn ? memoryContext() : '');
  thinking.remove();
  chatSend.disabled = false;
  chatInput.focus();
  react(reply.emotion, reply.line, reply.action);
};

applyLang();
loadVoices();
setInterval(() => {
  if (!perceptionPaused) brain.tick();
  renderLedger();
}, 1000);
react('happy', t('greeting'));

// ---------- 鼠标交互 ----------
const raycaster = new THREE.Raycaster();
const lookPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
const mouseNdc = new THREE.Vector2();
const lookPoint = new THREE.Vector3();
let mouseOnStage = false;
let dragging = false;
let lastX = 0;
let targetYaw = 0;
let yaw = 0;
let prevYaw = 0;
let mouseGazeUntil = 0;

function toNdc(e) {
  const r = canvas.getBoundingClientRect();
  mouseNdc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  mouseOnStage = true;
}
canvas.addEventListener('pointerenter', toNdc);
canvas.addEventListener('pointermove', (e) => {
  toNdc(e);
  mouseGazeUntil = performance.now() + 500;
  if (dragging) {
    targetYaw = Math.max(-1.1, Math.min(1.1, targetYaw + (e.clientX - lastX) * 0.012));
    lastX = e.clientX;
  }
});
canvas.addEventListener('pointerdown', (e) => {
  dragging = true;
  lastX = e.clientX;
  canvas.setPointerCapture?.(e.pointerId);
  canvas.style.cursor = 'grabbing';
});
const endDrag = (e) => {
  dragging = false;
  canvas.style.cursor = 'grab';
  try { canvas.releasePointerCapture?.(e.pointerId); } catch {}
};
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);
canvas.addEventListener('pointerleave', () => { if (!dragging) mouseOnStage = false; });

// ---------- 渲染循环 ----------
const clock = new THREE.Clock();
function loop() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const time = clock.elapsedTime;

  yaw += (targetYaw - yaw) * Math.min(1, dt * 10);
  const yawVel = dt > 0 ? (yaw - prevYaw) / dt : 0;
  prevYaw = yaw;
  if (avatar) {
    avatar.setYaw?.(yaw);
    avatar.setTurnRate?.(yawVel);
    const lookingMouse = performance.now() < mouseGazeUntil;
    avatar.setInteracting?.(dragging || lookingMouse);
    if (lookingMouse) {
      raycaster.setFromCamera(mouseNdc, camera);
      if (raycaster.ray.intersectPlane(lookPlane, lookPoint)) {
        const headY = avatar.frame?.centerY ?? 1.5;
        let dx = lookPoint.x;
        let dz = lookPoint.z;
        let h = Math.hypot(dx, dz);
        if (h < 0.5) {
          const ux = h > 1e-4 ? dx / h : 0;
          const uz = h > 1e-4 ? dz / h : 1;
          dx = ux * 0.5;
          dz = uz * 0.5;
          h = 0.5;
        }
        let dy = lookPoint.y - headY;
        const maxUp = Math.tan(0.06) * h;
        if (dy > maxUp) dy = maxUp;
        lookPoint.set(dx, headY + dy, dz);
        avatar.lookAtWorld?.(lookPoint);
      }
      avatar.setHeadBias?.(mouseNdc.x, mouseNdc.y);
    } else {
      avatar.setHeadBias?.(0, 0);
      if (state.face.detected && !speaking) avatar.setGaze(state.face.x, state.face.y);
      else avatar.setGaze?.(0.5, 0.45);
    }
    avatar.update(dt, time);
  }

  $('faceDot').classList.toggle('on', state.face.detected);
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}
loop();

addEventListener('resize', () => {
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  camera.aspect = canvas.clientWidth / canvas.clientHeight;
  camera.updateProjectionMatrix();
});
