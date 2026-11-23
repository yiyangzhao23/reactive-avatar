import * as THREE from 'three';
import { createAvatar } from './avatar.js?v=12';
import { startCamera, startScreenShare, startFaceTracking, stopCamera, stopScreenShare, captureScreen, state } from './perception.js?v=11';
import { Brain } from './brain.js?v=11';
import { startRecording, stopRecording, transcribe, startHandsFree, stopHandsFree } from './voice.js?v=11';
import { GeminiLive } from './live.js?v=1';

const IS_DEV = location.hostname === 'localhost' || location.hostname === '127.0.0.1';

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
    modelSettings: '模型设置',
    modelTitle: '模型设置 · 使用你自己的 API Key',
    modelHint: 'Key 只保存在本页内存：刷新或关闭页面即清空。请求先发到本机服务器再转发；不写磁盘、不写入日志。',
    modelProvider: '服务商',
    modelModel: '模型',
    modelKey: 'API Key',
    modelBase: '自定义地址',
    modelCustom: '自定义接口',
    modelTest: '测试连接',
    modelTesting: '测试中…',
    modelTestOk: '连接成功',
    modelTestFail: '连接失败：',
    modelSave: '保存并开始',
    modelSkip: '暂不设置（离线）',
    modelCostNote: '费用估算按 DeepSeek 价格展示；OpenAI / Gemini / OpenRouter / 自定义接口以账单为准。',
    modelOffline: '离线 fallback：未设置 Key',
    modelReady: '当前：',
    modelInvalidBase: '自定义地址必须以 https:// 或 http://localhost 开头',
    modelSaved: '模型设置已保存（仅本页内存）。',
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
    chatError: '回复失败：',
    remembered: '好，我记住了。',
    analyze: '分析当前画面',
    analyzing: '正在分析画面…',
    needScreen: '请先点“共享屏幕”，再分析',
    needGeminiVision: '画面分析需要能看图的模型（Gemini / OpenAI / OpenRouter / 自定义视觉模型）；DeepSeek 看不到画面。',
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
    browserHint: '浏览器指令：打开 example.com / 搜索 北京天气 / 点击 登录 / 总结这个网页 / 截图',
    browserDoing: '浏览器执行中：',
    browserDone: '已完成：',
    browserFail: '浏览器操作失败：',
    browserConfirmClick: '要点击这个元素吗？',
    browserReadDone: '网页内容已读到，看右侧日志。',
    browserScreenshot: '截图已保存：',
    liveStart: '实时模式（Gemini Live）',
    liveStop: '停止实时模式',
    liveNeedGemini: '实时模式需要 Gemini Key：请选择 Gemini 并保存 Key。',
    liveConnecting: '实时模式连接中…',
    liveConnected: '实时模式已连接：直接说话；共享屏幕后画面会以 1fps 发送。',
    liveClosed: '实时模式已关闭。',
    liveError: '实时模式错误：',
    liveScreenHint: '共享屏幕后，她会持续看到当前画面。',
    handsFreeStart: '连续语音',
    handsFreeStop: '停止连续语音',
    handsFreeOn: '连续语音已开启，直接说话即可。',
    handsFreeOff: '连续语音已关闭。',
    handsFreeUnsupported: '此浏览器不支持连续语音识别，请用麦克风按钮录音。',
    handsFreeError: '连续语音出错：',
    listening: '在听…',
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
    modelSettings: 'Model settings',
    modelTitle: 'Model settings · use your own API key',
    modelHint: 'The key stays in this page memory only: refresh or close the page to clear it. Requests go to the local server, which forwards them; no disk writes, no logs.',
    modelProvider: 'Provider',
    modelModel: 'Model',
    modelKey: 'API key',
    modelBase: 'Custom base URL',
    modelCustom: 'Custom endpoint',
    modelTest: 'Test connection',
    modelTesting: 'Testing…',
    modelTestOk: 'Connection OK',
    modelTestFail: 'Connection failed: ',
    modelSave: 'Save and start',
    modelSkip: 'Skip (offline)',
    modelCostNote: 'Cost estimates use DeepSeek pricing; OpenAI / Gemini / OpenRouter / custom endpoints are billed by your provider.',
    modelOffline: 'Offline fallback: no key set',
    modelReady: 'Using: ',
    modelInvalidBase: 'Custom base URL must start with https:// or http://localhost',
    modelSaved: 'Model settings saved (this page only).',
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
    chatError: 'Reply failed: ',
    remembered: 'Got it, I will remember that.',
    analyze: 'Analyze screen',
    analyzing: 'Analyzing the screen…',
    needScreen: 'Click “Share screen” first, then analyze',
    needGeminiVision: 'Screen analysis needs a vision model (Gemini / OpenAI / OpenRouter / custom); DeepSeek cannot see images.',
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
    browserHint: 'Browser commands: open example.com / search Beijing weather / click Sign in / summarize this page / screenshot',
    browserDoing: 'Browser action: ',
    browserDone: 'Done: ',
    browserFail: 'Browser action failed: ',
    browserConfirmClick: 'Click this element? ',
    browserReadDone: 'Page text loaded; see the log.',
    browserScreenshot: 'Screenshot saved: ',
    liveStart: 'Live mode (Gemini Live)',
    liveStop: 'Stop live mode',
    liveNeedGemini: 'Live mode needs a Gemini key: choose Gemini and save a key.',
    liveConnecting: 'Connecting live mode…',
    liveConnected: 'Live mode connected: just speak; shared screen frames are sent at 1 fps.',
    liveClosed: 'Live mode stopped.',
    liveError: 'Live mode error: ',
    liveScreenHint: 'Share your screen and she will keep seeing the current frame.',
    handsFreeStart: 'Hands-free',
    handsFreeStop: 'Stop hands-free',
    handsFreeOn: 'Hands-free on. Just speak.',
    handsFreeOff: 'Hands-free off.',
    handsFreeUnsupported: 'This browser does not support continuous speech recognition. Use the mic button.',
    handsFreeError: 'Hands-free error: ',
    listening: 'Listening…',
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
const langSel = $('lang');
const modelBtn = $('modelBtn');
const modelStatus = $('modelStatus');
const modelDialog = $('modelDialog');
const modelProvider = $('modelProvider');
const modelName = $('modelName');
const modelKey = $('modelKey');
const modelBase = $('modelBase');
const modelBaseRow = $('modelBaseRow');
const modelError = $('modelError');
const modelTestBtn = $('modelTest');
let camOn = false, screenOn = false;

const MODEL_PRESETS = {
  openai: { model: 'gpt-4o-mini', base_url: '' },
  gemini: { model: 'gemini-3.8-flash', base_url: '' },
  deepseek: { model: 'deepseek-chat', base_url: '' },
  openrouter: { model: 'deepseek/deepseek-chat', base_url: '' },
  custom: { model: '', base_url: '' },
};
let modelSettings = { provider: 'deepseek', model: 'deepseek-chat', api_key: '', base_url: '' };
const getProvider = () => modelSettings.provider;
const getKey = () => modelSettings.api_key;
const getLlm = () => ({ ...modelSettings });
const getGeminiKey = () => (modelSettings.provider === 'gemini' ? modelSettings.api_key : '');

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
const liveBtn = $('liveBtn');
const liveStatus = $('liveStatus');
let live = null;
let liveActive = false;
const pauseBtn = $('pausePerception');
let memoryOn = localStorage.getItem('storyMemoryOn') === '1';
let perceptionPaused = false;
function loadMemory() {
  try { return JSON.parse(localStorage.getItem('storyMemory') || '[]'); } catch { return []; }
}
function saveMemory(list) {
  localStorage.setItem('storyMemory', JSON.stringify(list.slice(-25)));
}
async function postMemory(text, source = 'user', ttlDays = 30) {
  try {
    await fetch('/memory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, source, ttl_days: ttlDays }),
    });
  } catch {}
}

async function memoryContext(query = '') {
  try {
    const res = await fetch('/memory/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, limit: 8 }),
    });
    if (res.ok) {
      const data = await res.json();
      const rows = data.memories || [];
      if (rows.length) return rows.map((e, i) => `${i + 1}. ${e.text}`).join('\n').slice(-3000);
    }
    const recent = await fetch('/memory?limit=8', { cache: 'no-store' });
    if (recent.ok) {
      const data = await recent.json();
      const rows = data.memories || [];
      if (rows.length) return rows.map((e, i) => `${i + 1}. ${e.text}`).join('\n').slice(-3000);
    }
  } catch {}
  const m = loadMemory();
  if (!m.length) return '';
  return m.map((e, i) => `${i + 1}. ${e.text}`).join('\n').slice(-3000);
}
async function refreshMemoryCount() {
  try {
    const res = await fetch('/memory?limit=50', { cache: 'no-store' });
    if (!res.ok) return;
    const data = await res.json();
    const n = Math.max(loadMemory().length, (data.memories || []).length);
    memoryBtn.textContent = t(memoryOn ? 'memoryOn' : 'memoryOff') + (memoryOn && n ? ` (${n})` : '');
  } catch {}
}

function renderMemory() {
  const n = loadMemory().length;
  memoryBtn.textContent = t(memoryOn ? 'memoryOn' : 'memoryOff') + (memoryOn && n ? ` (${n})` : '');
  memoryBtn.classList.toggle('active', memoryOn);
  renderLedger();
  refreshMemoryCount();
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
  renderMemory();
  renderVoiceOptions();
  liveBtn.textContent = t(liveActive ? 'liveStop' : 'liveStart');
  updateModelStatus();
}

langSel.value = lang;

langSel.onchange = () => {
  lang = langSel.value;
  localStorage.setItem('lang', lang);
  applyLang();
};
voiceSel.onchange = () => {
  localStorage.setItem('voiceMode', voiceSel.value);
};

// ---------- 模型设置（仅本页内存） ----------
function updateModelStatus() {
  if (modelSettings.api_key) {
    modelStatus.textContent = `${t('modelReady')}${modelSettings.provider} / ${modelSettings.model}`;
  } else {
    modelStatus.textContent = t('modelOffline');
  }
}

function syncModelForm() {
  modelProvider.value = modelSettings.provider;
  modelName.value = modelSettings.model || MODEL_PRESETS[modelSettings.provider]?.model || '';
  modelKey.value = modelSettings.api_key || '';
  modelBase.value = modelSettings.base_url || '';
  modelBaseRow.classList.toggle('hidden', modelSettings.provider !== 'custom');
  modelError.textContent = '';
  updateModelStatus();
}

function showModelDialog() {
  syncModelForm();
  if (typeof modelDialog.show === 'function') {
    if (!modelDialog.open) modelDialog.show();
  } else {
    modelDialog.setAttribute('open', '');
  }
}

function closeModelDialog() {
  if (typeof modelDialog.close === 'function') modelDialog.close();
  else modelDialog.removeAttribute('open');
}

modelBtn.onclick = showModelDialog;
modelProvider.onchange = () => {
  const preset = MODEL_PRESETS[modelProvider.value] || {};
  modelBaseRow.classList.toggle('hidden', modelProvider.value !== 'custom');
  if (!modelName.value || Object.values(MODEL_PRESETS).some((p) => p.model === modelName.value)) {
    modelName.value = preset.model || '';
  }
  if (modelProvider.value === 'custom') modelName.focus();
};
modelSkip.onclick = () => {
  closeModelDialog();
  updateModelStatus();
};
function readModelForm() {
  const provider = modelProvider.value;
  const model = modelName.value.trim() || MODEL_PRESETS[provider]?.model || '';
  const api_key = modelKey.value.trim();
  const base_url = modelBase.value.trim();
  if (provider === 'custom' && !/^(https:\/\/|http:\/\/localhost|http:\/\/127\.0\.0\.1)/.test(base_url)) {
    throw new Error(t('modelInvalidBase'));
  }
  return { provider, model, api_key, base_url };
}

modelSave.onclick = () => {
  try {
    modelSettings = readModelForm();
  } catch (e) {
    modelError.textContent = e.message;
    return;
  }
  if (liveActive) stopLiveMode();
  updateModelStatus();
  closeModelDialog();
  log(t('modelSaved'));
};

modelTestBtn.onclick = async () => {
  let llm;
  try { llm = readModelForm(); } catch (e) { modelError.textContent = e.message; return; }
  modelError.style.color = '#9aa1c0';
  modelError.textContent = t('modelTesting');
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ llm, messages: [{ role: 'user', content: 'Reply with OK.' }], temperature: 0 }),
    });
    const raw = await res.text();
    let data = {};
    try { data = JSON.parse(raw); } catch {}
    if (!res.ok) {
      const msg = data?.error?.message || (Array.isArray(data) ? data[0]?.error?.message : '') || data?.error || raw.slice(0, 300) || `HTTP ${res.status}`;
      throw new Error(msg);
    }
    const text = data.choices?.[0]?.message?.content ?? '';
    modelError.style.color = '#2bb673';
    modelError.textContent = `${t('modelTestOk')}${text ? ' · ' + text.slice(0, 40) : ''}`;
  } catch (e) {
    modelError.style.color = '#e5484d';
    modelError.textContent = t('modelTestFail') + e.message;
  }
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
$('clearMemory').onclick = async () => {
  saveMemory([]);
  try { await fetch('/memory/clear', { method: 'POST' }); } catch {}
  renderMemory();
  log(t('memoryCleared'));
};
pauseBtn.onclick = () => {
  perceptionPaused = !perceptionPaused;
  brain.perceptionPaused = perceptionPaused;
  renderLedger();
  log(perceptionPaused ? t('ledgerPaused') : t('perceptionResumed'));
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
    live?.setScreenVideo?.(null);
    log(t('shareStopped'));
    return;
  }
  try {
    const stream = await startScreenShare(screenVideo);
    screenOn = true;
    shareBtn.classList.add('active'); shareBtn.textContent = t('shareOn');
    $('shareDot').classList.add('on');
    live?.setScreenVideo?.(screenVideo);
    stream.getVideoTracks()[0].addEventListener('ended', () => {
      screenOn = false;
      shareBtn.classList.remove('active'); shareBtn.textContent = t('shareOff');
      $('shareDot').classList.remove('on');
      live?.setScreenVideo?.(null);
      stopScreenShare();
    });
    react('surprised', t('shareOpen'));
  } catch (e) { log(t('shareFail')(e.message)); }
};

const analyzeBtn = $('analyzeBtn');
async function analyzeScreen() {
  if (perceptionPaused) { log(t('ledgerPaused')); return; }
  if (!state.screen.on) { log(t('needScreen')); return; }
  const llm = getLlm();
  if (!llm.api_key) { log(t('modelOffline')); return; }
  if (llm.provider === 'deepseek') { log(t('needGeminiVision')); return; }
  const thinking = log(t('analyzing'), null, false, 'thinking');
  analyzeBtn.disabled = true;
  try {
    const img = captureScreen();
    if (!img) throw new Error('no frame');
    const mem = memoryOn ? await memoryContext('') : '';
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
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        llm,
        messages: [{ role: 'user', content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${img}` } },
        ] }],
        temperature: 0.4,
        ...(memoryOn ? { response_format: { type: 'json_object' } } : {}),
      }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
    text = json.choices?.[0]?.message?.content?.trim() ?? '';
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
          await postMemory(out.memory.trim(), 'screen', 30);
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
}
analyzeBtn.onclick = analyzeScreen;

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

let visemeTimer = null;

function splitSentences(text) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  const raw = clean.match(/[^。！？!?；;\n]+[。！？!?；;]?/g) || [clean];
  const out = [];
  for (let part of raw) {
    part = part.trim();
    if (!part) continue;
    while (part.length > 90) {
      out.push(part.slice(0, 90));
      part = part.slice(90);
    }
    out.push(part);
  }
  return out;
}

function visemeForChar(ch) {
  if (/[aàáǎāA]/.test(ch)) return 0.9;
  if (/[oōóǒòO]/.test(ch)) return 0.75;
  if (/[eēéěèE]/.test(ch)) return 0.55;
  if (/[iīíǐìI]/.test(ch)) return 0.35;
  if (/[uūúǔùUüv]/.test(ch)) return 0.45;
  if (/[啊阿]/.test(ch)) return 0.9;
  if (/[哦噢喔]/.test(ch)) return 0.75;
  if (/[诶欸]/.test(ch)) return 0.55;
  if (/[衣一]/.test(ch)) return 0.35;
  if (/[乌无]/.test(ch)) return 0.45;
  if (/[\s，。！？、；：,.!?;:…—]/.test(ch)) return 0;
  return 0.18;
}

function scheduleVisemes(text, durationSec) {
  if (visemeTimer) { clearInterval(visemeTimer); visemeTimer = null; }
  const chars = Array.from(String(text || ''));
  if (!chars.length || !durationSec) return;
  const start = performance.now();
  visemeTimer = setInterval(() => {
    const t = (performance.now() - start) / 1000;
    if (t >= durationSec) {
      clearInterval(visemeTimer);
      visemeTimer = null;
      avatar?.setMouth?.(null);
      return;
    }
    const idx = Math.min(chars.length - 1, Math.floor((t / durationSec) * chars.length));
    avatar?.setMouth?.(visemeForChar(chars[idx]));
  }, 60);
}

function stopSpeaking() {
  speakSeq++;
  if (audioEl) { try { audioEl.pause(); } catch {} audioEl = null; }
  if (audioSrc) { try { audioSrc.stop(); } catch {} audioSrc = null; }
  if ('speechSynthesis' in window) { try { speechSynthesis.cancel(); } catch {} }
  if (visemeTimer) { clearInterval(visemeTimer); visemeTimer = null; }
  setTalking(false);
  avatar?.setMouth?.(null);
}

async function speakGemini(text, voiceName, seq) {
  const key = getGeminiKey();
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
  scheduleVisemes(text, buf.duration);
  return new Promise((resolve) => {
    src.onended = () => {
      if (audioSrc === src) {
        audioSrc = null;
        setTalking(false);
        avatar?.setMouth?.(null);
      }
      resolve();
    };
    src.start();
  });
}

async function speakServerPart(text, seq) {
  const L = I18N[lang];
  const res = await fetch(`/tts?lang=${L.voicePrefix}&text=${encodeURIComponent(text)}`);
  if (!res.ok) throw new Error(`TTS HTTP ${res.status}`);
  const blob = await res.blob();
  if (seq !== speakSeq) return;
  const url = URL.createObjectURL(blob);
  const el = new Audio(url);
  audioEl = el;
  let duration = 0;
  const meta = new Promise((resolve) => {
    el.onloadedmetadata = () => { duration = el.duration; resolve(); };
    setTimeout(resolve, 1200);
  });
  el.onplay = () => setTalking(true);
  await el.play();
  await meta;
  if (seq !== speakSeq) {
    el.pause();
    URL.revokeObjectURL(url);
    return;
  }
  scheduleVisemes(text, duration || Math.max(1.2, text.length * 0.16));
  await new Promise((resolve) => {
    el.onended = el.onerror = () => {
      if (audioEl === el) {
        audioEl = null;
        setTalking(false);
        avatar?.setMouth?.(null);
      }
      URL.revokeObjectURL(url);
      resolve();
    };
  });
}

async function speak(text) {
  stopSpeaking();
  const seq = speakSeq;
  const mode = localStorage.getItem('voiceMode') || 'gemini:Aoede';
  const parts = splitSentences(text);
  for (const part of parts) {
    if (seq !== speakSeq) return;
    if (mode.startsWith('gemini:')) {
      try {
        await speakGemini(part, mode.slice(7), seq);
        if (!voiceLogged) {
          voiceLogged = true;
          const info = document.getElementById('voiceInfo');
          if (info) info.textContent = `语音: Gemini ${mode.slice(7)}`;
        }
        continue;
      } catch (e) {
        console.warn('Gemini 语音失败，回退服务器语音', e);
        if (!IS_DEV) { speakBrowser(text); return; }
      }
    }
    if (!IS_DEV) { speakBrowser(text); return; }
    try {
      await speakServerPart(part, seq);
      if (!voiceLogged) {
        voiceLogged = true;
        const info = document.getElementById('voiceInfo');
        if (info) info.textContent = lang === 'zh' ? '语音: 服务器 TTS' : '语音: Server TTS';
      }
    } catch (e) {
      if (seq !== speakSeq) return;
      if (e.name === 'NotAllowedError') {
        pendingSpeech = text;
        armResume();
        return;
      }
      console.warn('服务器 TTS 失败，回退浏览器语音', e);
      speakBrowser(text);
      return;
    }
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
  if (!liveActive) speak(line);
  clearTimeout(emoTimer);
  emoTimer = setTimeout(() => avatar?.setEmotion('neutral'), 6000);
}


const brain = new Brain({
  getKey,
  getProvider,
  getLlm,
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

// ---------- Gemini Live ----------
const LIVE_SYSTEM = `你是小可，一个住在网页里的 3D 虚拟伙伴。你可以同时听到用户的声音、看到用户共享的屏幕（约 1fps）。
用简短、自然、有性格的口语回答，默认中文；用户说英文时用英文。不要每句话都描述屏幕，只在相关时提到你看到的画面。
你知道自己是一个合成角色，不要假装是真人；不确定时说不确定，不要编造。`;

async function startLiveMode() {
  const key = getGeminiKey();
  if (!key) { log(t('liveNeedGemini')); return; }
  if (liveActive) return;
  stopSpeaking();
  liveStatus.textContent = t('liveConnecting');
  liveBtn.disabled = true;
  live = new GeminiLive({
    getLang: () => lang,
    system: LIVE_SYSTEM,
    onStatus: (state) => {
      if (state === 'connecting') liveStatus.textContent = t('liveConnecting');
      if (state === 'connected') liveStatus.textContent = t('liveConnected');
      if (state.startsWith('closed')) liveStatus.textContent = t('liveClosed');
    },
    onUserText: (txt) => log(txt, null, true),
    onUserInterim: (txt) => { chatInput.value = txt; },
    onModelText: (txt) => {
      avatar?.setEmotion('relaxed');
      log(txt, 'relaxed');
    },
    onLevel: (level) => { avatar?.setMouth(level > 0.03 ? level : 0); },
    onSpeaking: (on) => {
      setTalking(on);
      if (!on) avatar?.setMouth(null);
    },
    onError: (e) => log(t('liveError') + e),
  });
  try {
    await live.start({
      apiKey: key,
      model: localStorage.getItem('liveModel') || 'gemini-3.8-live',
      screenVideo: state.screen.video,
    });
    liveActive = true;
    liveBtn.textContent = t('liveStop');
    liveBtn.classList.add('active');
    liveStatus.textContent = t('liveConnected');
    handsFreeBtn.disabled = true;
    micBtn.disabled = true;
    log(t('liveConnected'));
  } catch (e) {
    log(t('liveError') + e.message);
    liveStatus.textContent = '';
    try { live?.stop(); } catch {}
    live = null;
    liveActive = false;
  } finally {
    liveBtn.disabled = false;
  }
}

function stopLiveMode() {
  try { live?.stop(); } catch {}
  live = null;
  liveActive = false;
  liveBtn.textContent = t('liveStart');
  liveBtn.classList.remove('active');
  liveStatus.textContent = t('liveClosed');
  handsFreeBtn.disabled = false;
  micBtn.disabled = false;
  setTalking(false);
  avatar?.setMouth(null);
  log(t('liveClosed'));
}

liveBtn.onclick = () => (liveActive ? stopLiveMode() : startLiveMode());

// ---------- 语音聊天 ----------
const micBtn = $('micBtn');
const handsFreeBtn = $('handsFreeBtn');
let voiceRec = false;
let handsFreeOn = false;

function parseBrowserCommand(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;
  let m = raw.match(/^(?:请|帮我)?(?:打开|open)\s+(.+)$/i);
  if (m) {
    const target = m[1].trim();
    if (/浏览器|browser/i.test(target)) return { action: 'open_url', args: { url: 'https://www.bing.com' }, label: target };
    if (/^https?:\/\//i.test(target) || /^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(target)) {
      return { action: 'open_url', args: { url: target }, label: target };
    }
    return null;
  }
  m = raw.match(/^(?:请|帮我)?(?:搜索|搜一下|查一下|查一查|search)\s*(.+)$/i);
  if (m && m[1].trim()) return { action: 'search', args: { query: m[1].trim() }, label: m[1].trim() };
  m = raw.match(/^(?:请|帮我)?点击\s*(.+)$/i) || raw.match(/^click\s+(.+)$/i);
  if (m && m[1].trim()) return { action: 'click_text', args: { text: m[1].trim() }, label: m[1].trim() };
  if (/^(?:请|帮我)?(?:总结|读一下|看看)(?:这个)?(?:网页|页面|屏幕)?$/i.test(raw) || /summarize (this )?page/i.test(raw)) {
    return { action: 'read_page', args: {}, label: 'page' };
  }
  if (/^(?:请|帮我)?截图$/i.test(raw) || /^screenshot$/i.test(raw)) return { action: 'screenshot', args: {}, label: 'screen' };
  if (/^(?:请|帮我)?(?:向下滚|往下滚|滚动)$/i.test(raw) || /^scroll/i.test(raw)) return { action: 'scroll', args: { delta: 800 }, label: 'down' };
  if (/^(?:后退|返回)$/i.test(raw) || /^back$/i.test(raw)) return { action: 'back', args: {}, label: 'back' };
  if (/^(?:关闭浏览器)$/i.test(raw) || /^close browser$/i.test(raw)) return { action: 'close', args: {}, label: 'close' };
  return null;
}

async function runBrowserCommand(cmd) {
  if (cmd.action === 'click_text' && !window.confirm(t('browserConfirmClick') + cmd.args.text)) return;
  log(t('browserDoing') + cmd.action + (cmd.label ? ' · ' + cmd.label : ''));
  try {
    const res = await fetch('/computer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: cmd.action, args: cmd.args }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || `HTTP ${res.status}`);
    const r = data.result || {};
    if (cmd.action === 'read_page') {
      log((r.title || '') + ' · ' + (r.url || ''));
      let summary = String(r.text || '').slice(0, 2000);
      try { summary = await brain.summarizePage(r.text || ''); } catch {}
      log(summary);
      react('relaxed', String(summary).slice(0, 120), 'none');
      return;
    }
    if (cmd.action === 'screenshot') {
      log(t('browserScreenshot') + (r.path || ''));
      react('happy', t('browserDone') + (r.title || ''), 'nod');
      return;
    }
    log(t('browserDone') + (r.title || '') + ' · ' + (r.url || ''));
    react('happy', t('browserDone') + (r.title || ''), 'nod');
  } catch (e) {
    log(t('browserFail') + e.message);
  }
}

async function sendUserText(text) {
  const line = String(text || '').trim();
  if (!line) return;
  log(line, null, true);
  avatar?.setEmotion('relaxed');

  const browser = parseBrowserCommand(line);
  if (browser) {
    await runBrowserCommand(browser);
    return;
  }

  const remember = line.match(/^(?:请|帮我)?记住[：:，,\s]*(.+)$/s) || line.match(/^remember[:\s]+(.+)$/is);
  if (remember) {
    const fact = remember[1].trim();
    await postMemory(fact, 'user', 30);
    renderMemory();
    log(t('memoryAdded'));
    react('happy', t('remembered'), 'nod');
    return;
  }
  if (/(看|总结|分析).{0,12}(屏幕|画面)|summarize.{0,20}screen|look at.{0,20}screen/i.test(line)) {
    await analyzeScreen();
    return;
  }

  if (liveActive) {
    live.sendText(line);
    return;
  }

  const thinking = log(t('thinking'), null, false, 'thinking');
  chatSend.disabled = true;
  try {
    const context = memoryOn ? await memoryContext(line) : '';
    const reply = await brain.chatUser(line, context);
    thinking.remove();
    chatSend.disabled = false;
    chatInput.focus();
    react(reply.emotion, reply.line, reply.action);
  } catch (e) {
    thinking.remove();
    chatSend.disabled = false;
    log(t('chatError') + e.message);
  }
}

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
  const gk = getGeminiKey();
  if (!gk) { log(t('needGemini')); return; }
  const thinking = log(t('transcribing'), null, false, 'thinking');
  try {
    const text = await transcribe(blob, gk, lang === 'zh' ? 'Mandarin Chinese' : 'English');
    thinking.remove();
    if (!text) { log(t('noSpeech')); return; }
    await sendUserText(text);
  } catch (e) {
    thinking.remove();
    log(t('sttFail') + e.message);
  }
};

handsFreeBtn.onclick = async () => {
  if (handsFreeOn) {
    stopHandsFree();
    handsFreeOn = false;
    handsFreeBtn.classList.remove('active');
    handsFreeBtn.textContent = t('handsFreeStart');
    log(t('handsFreeOff'));
    return;
  }
  const ok = await startHandsFree({
    lang,
    onStart: () => log(t('handsFreeOn')),
    onInterim: (txt) => { chatInput.value = txt; },
    onSpeechStart: () => { if (speaking) stopSpeaking(); },
    onFinal: (txt) => {
      chatInput.value = '';
      sendUserText(txt);
    },
    onError: (e) => {
      log(t('handsFreeError') + e);
      if (/not-allowed|service-not-allowed/.test(String(e))) {
        stopHandsFree();
        handsFreeOn = false;
        handsFreeBtn.classList.remove('active');
        handsFreeBtn.textContent = t('handsFreeStart');
      }
    },
  });
  if (!ok) { log(t('handsFreeUnsupported')); return; }
  handsFreeOn = true;
  handsFreeBtn.classList.add('active');
  handsFreeBtn.textContent = t('handsFreeStop');
};

// ---------- 打字聊天 ----------
const chatForm = $('chatForm'), chatInput = $('chatInput'), chatSend = $('chatSend');
chatForm.onsubmit = async (e) => {
  e.preventDefault();
  const text = chatInput.value.trim();
  if (!text) return;
  chatInput.value = '';
  await sendUserText(text);
};

if (!IS_DEV) document.getElementById('voiceBox')?.remove();
applyLang();
if (IS_DEV) loadVoices();
showModelDialog();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('service worker failed', e));
}
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
