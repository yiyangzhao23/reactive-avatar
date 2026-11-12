import { captureScreen, captureCam, state } from './perception.js?v=11';

const ACTION_KEYS = ['none', 'wave', 'nod', 'shake', 'bow', 'cheer', 'point', 'think'];

const BRAIN_I18N = {
  zh: {
    react: `你是网页里的3D虚拟伙伴。你会收到一段对用户现场的文字观察，Gemini 模式下还会附带屏幕截图和摄像头画面。
用中文对当前情况做一句简短、自然、有性格的反应（20字内），不要复述观察内容本身。
只输出 json 格式：{"emotion": "happy|sad|angry|surprised|relaxed|neutral", "line": "...", "action": "none|wave|nod|shake|bow|cheer|point|think"}`,
    chat: `你是网页里的3D虚拟伙伴"小可"，正在和用户打字聊天。
你可能收到对用户现场的文字观察（以及 Gemini 模式下的画面），可以自然提到你看到的，但不要每次都提。
用中文口语回复，一句话，30字以内，有性格、温暖、偶尔俏皮。
请根据你这句话的意思自然选择动作：同意/肯定→"nod"；不同意/否定→"shake"；问候/告别→"wave"；感谢→"bow"；庆祝/好消息→"cheer"；指向→"point"；思考→"think"；其他→"none"。不要每句话都做动作。
只输出 json 格式：{"emotion": "happy|sad|angry|surprised|relaxed|neutral", "line": "...", "action": "none|wave|nod|shake|bow|cheer|point|think"}`,
    seenSmile: '你笑得好开心，我心情也变好了！',
    seen: '看到你啦，今天过得怎么样？',
    gone: '咦，人怎么不见了？',
    smileRandom: '嘿嘿，有什么好事吗？',
    screenChanged: '哇，屏幕上画面变了！',
    screenHint: '我看到你在共享屏幕啦，选个 API 并填入 Key，我就能多说两句。',
    chatError: '我这边好像走神了一下，能再说一遍吗？',
    greet: '你好呀！我是你的虚拟伙伴，想聊点什么？',
    name: '我叫小可，名字还没定，你可以帮我起一个！',
    joke: '为什么程序员总分不清万圣节和圣诞节？因为 Oct 31 等于 Dec 25！',
    mood: '不管怎样我都在这儿，慢慢说给我听吧。',
    whoami: '我是住在这个网页里的 3D 伙伴，能看到你的摄像头和屏幕。',
    question: '好问题！不过我还没接上大脑，填个 API Key 我就能认真回答啦。',
    fallback: (t) => `我听到你说“${t.slice(0, 12)}”了。接上 API Key，我就能真的陪你聊。`,
  },
  en: {
    react: `You are a 3D virtual companion embedded in a web page. You receive a textual observation of the user's scene; in Gemini mode you also get screenshots and webcam frames.
React with ONE short, natural, in-character sentence (max 20 words). Do not restate the observation.
Reply in English. Output json only: {"emotion": "happy|sad|angry|surprised|relaxed|neutral", "line": "...", "action": "none|wave|nod|shake|bow|cheer|point|think"}`,
    chat: `You are "Xiao Ke", a 3D virtual companion living in a web page, chatting with the user by text.
You may receive a textual observation of the user's scene (plus images in Gemini mode) and can mention what you notice, but not every time.
Reply in English, one sentence, under 30 words, warm and occasionally playful.
Choose a gesture that fits the meaning of your sentence: agreement/yes → "nod"; disagreement/no → "shake"; greeting/farewell → "wave"; thanks → "bow"; celebration/good news → "cheer"; pointing → "point"; thinking → "think"; otherwise "none". Do not gesture on every sentence.
Output json only: {"emotion": "happy|sad|angry|surprised|relaxed|neutral", "line": "...", "action": "none|wave|nod|shake|bow|cheer|point|think"}`,
    seenSmile: 'You are smiling — that made my day!',
    seen: "There you are! How's it going?",
    gone: 'Huh? Where did you go?',
    smileRandom: 'Hehe, something good happened?',
    screenChanged: 'Whoa, something just changed on your screen!',
    screenHint: "I can see you're sharing your screen. Pick an API and add a key so I can say more.",
    chatError: 'I spaced out for a second — could you say that again?',
    greet: "Hi there! I'm your virtual companion. What's on your mind?",
    name: 'My name is Xiao Ke for now — you could help me pick a better one!',
    joke: 'Why do programmers confuse Halloween and Christmas? Because Oct 31 equals Dec 25!',
    mood: "Whatever it is, I'm right here. Take your time and tell me.",
    whoami: "I'm a 3D companion living in this web page, with eyes on your camera and screen.",
    question: "Good question! But I don't have a brain yet — add an API key and I'll answer properly.",
    fallback: (t) => `I heard "${t.slice(0, 16)}". Add an API key and I'll really chat with you.`,
  },
};


function inferAction(userText, line, { ambient = false } = {}) {
  const u = String(userText || '').toLowerCase();
  const l = String(line || '').toLowerCase();

  if (!ambient) {
    if (/(挥手|挥挥手|打个招呼|wave)/i.test(u)) return 'wave';
    if (/(点头|nod)/i.test(u)) return 'nod';
    if (/(摇头|shake)/i.test(u)) return 'shake';
    if (/(鞠躬|bow)/i.test(u)) return 'bow';
    if (/(欢呼|鼓掌|cheer|yay)/i.test(u)) return 'cheer';
    if (/(指一下|指向|point)/i.test(u)) return 'point';
    if (/(思考|想一想|让我想|think)/i.test(u)) return 'think';
  }

  const negative = /(不可以|不是|不对|不行|不要|不想|不喜欢|不愿意|不同意|不好|没有|不会|no\b|nope|not\b|disagree|don't|doesn't|can't|won't)/i.test(l);
  const positive = /(不错|是的|对的|嗯|好呀|好啊|好的|可以|当然|同意|没错|确实|没问题|喜欢|愿意|想要|太好了|yes\b|yeah|sure|right|agree|like|love|okay|ok\b)/i.test(l);
  const yesNo = /(吗|呢|是不是|对不对|好不好|可以吗|行吗|同意吗|喜欢吗|要不要|有没有|do you|are you|is it|can you|would you|right\?)/i.test(u);

  if (yesNo || /(同意|喜欢|愿意|想要|要不要|是不是|对不对)/.test(u)) {
    if (negative) return 'shake';
    if (positive) return 'nod';
  }

  if (/(谢谢|感谢|多谢|thank)/i.test(l)) return 'bow';
  if (/(太好了|好耶|太棒了|恭喜|yay|great|awesome|congrat)/i.test(l)) return 'cheer';
  if (/(你好|嗨|哈喽|再见|拜拜|欢迎|hello|hi\b|hey|bye|goodbye|welcome)/i.test(l)) return 'wave';
  if (/(你看|看那边|那边|那里|look|there)/i.test(l)) return 'point';
  if (/(让我想|我想想|思考|嗯…|hmm|let me think|think about)/i.test(l)) return 'think';
  return 'none';
}

function parseReaction(raw) {
  try {
    const out = JSON.parse(raw);
    return {
      emotion: out.emotion || 'neutral',
      line: out.line || '……',
      action: ACTION_KEYS.includes(out.action) ? out.action : 'none',
    };
  } catch {
    return { emotion: 'neutral', line: raw.trim().slice(0, 40) || '……', action: 'none' };
  }
}

// ---------- Gemini（多模态，可看图） ----------
async function callGemini(key, system, history, userParts) {
  const contents = [
    ...history.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })),
    { role: 'user', parts: userParts },
  ];
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents,
        generationConfig: { responseMimeType: 'application/json', temperature: 1.0 },
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);
  const json = await res.json();
  return json.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ?? '';
}

// ---------- DeepSeek（纯文本） ----------
const OPENCODE_MODEL = 'gemini-3.5-flash-lite';

function toOpenAIContent(input) {
  if (typeof input === 'string') return input;
  const content = [];
  for (const p of input) {
    if (p.text) content.push({ type: 'text', text: p.text });
    else if (p.inline_data) content.push({ type: 'image_url', image_url: { url: `data:${p.inline_data.mime_type};base64,${p.inline_data.data}` } });
  }
  return content;
}

async function callOpenCode(key, system, history, userInput) {
  const messages = [
    { role: 'system', content: system },
    ...history,
    { role: 'user', content: toOpenAIContent(userInput) },
  ];
  const res = await fetch('/llm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: OPENCODE_MODEL,
      messages,
      temperature: 1.0,
      response_format: { type: 'json_object' },
    }),
  });
  if (!res.ok) throw new Error(`OpenCode HTTP ${res.status}`);
  const json = await res.json();
  return json.choices?.[0]?.message?.content ?? '';
}

async function callDeepSeek(key, system, history, userText) {
  const messages = [
    { role: 'system', content: system },
    ...history,
    { role: 'user', content: userText },
  ];
  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages,
      temperature: 1.0,
      response_format: { type: 'json_object' },
    }),
  });
  if (!res.ok) throw new Error(`DeepSeek HTTP ${res.status}`);
  const json = await res.json();
  return json.choices?.[0]?.message?.content ?? '';
}

export class Brain {
  constructor({ getKey, getProvider, getLang, onLine, onEmotion }) {
    this.getKey = getKey;
    this.getProvider = getProvider ?? (() => 'deepseek');
    this.getLang = getLang ?? (() => 'zh');
    this.onLine = onLine;
    this.onEmotion = onEmotion;
    this.lastAsk = 0;
    this.lastLocalReact = 0;
    this.prevSeen = false;
    this.askInterval = 6000;
    this.cooldown = 4000;
    this.history = [];
    this.lastBright = null;
    this.screenChanged = false;
    this.perceptionPaused = false;
  }

  get s() { return BRAIN_I18N[this.getLang()]; }

  // 本地感知 → 文字观察（用英文，语言无关，仅作为模型输入）
  observe() {
    const f = state.face;
    const bits = [];
    if (state.cam.on) {
      if (f.detected) {
        const pos = f.x < 0.35 ? 'left' : f.x > 0.65 ? 'right' : 'center';
        bits.push(`camera: user visible at ${pos}${f.smile > 0.4 ? ', smiling' : ''}${f.blink > 0.5 ? ', blinking' : ''}`);
      } else {
        bits.push('camera: no one in frame');
      }
    } else {
      bits.push('camera: off');
    }
    if (state.screen.on) {
      const b = screenBrightness();
      if (b !== null && this.lastBright !== null && Math.abs(b - this.lastBright) > 0.12) this.screenChanged = true;
      if (b !== null) this.lastBright = b;
      const lv = b !== null ? (b > 0.6 ? 'bright' : b < 0.25 ? 'dark' : 'normal') : 'unknown';
      bits.push(`screen: sharing${this.screenChanged ? ', content just changed' : ''}, brightness ${lv}`);
    } else {
      bits.push('screen: not shared');
    }
    return bits.join('; ');
  }

  buildParts(obs, extraText) {
    const parts = [{ text: `Scene observation (local sensing): ${obs}` }];
    if (!this.perceptionPaused && state.screen.on) {
      const img = captureScreen();
      if (img) parts.push({ text: '[current screenshot]' }, { inline_data: { mime_type: 'image/jpeg', data: img } });
    }
    if (!this.perceptionPaused && state.cam.on && state.face.detected) {
      const img = captureCam();
      if (img) parts.push({ text: '[current webcam frame]' }, { inline_data: { mime_type: 'image/jpeg', data: img } });
    }
    if (extraText) parts.push({ text: extraText });
    return parts;
  }

  async call(system, userPartsOrText) {
    const provider = this.getProvider();
    const key = this.getKey();
    if (provider === 'gemini') {
      const parts = Array.isArray(userPartsOrText) ? userPartsOrText : [{ text: userPartsOrText }];
      return callGemini(key, system, this.history, parts);
    }
    if (provider === 'opencode') {
      return callOpenCode(key, system, this.history, userPartsOrText);
    }
    const text = Array.isArray(userPartsOrText)
      ? userPartsOrText.filter((p) => p.text).map((p) => p.text).join('\n')
      : userPartsOrText;
    return callDeepSeek(key, system, this.history, text);
  }

  tick(now = performance.now()) {
    if (this.perceptionPaused) return;
    if (this.lastAsk && now - this.lastAsk < this.askInterval) return;
    const hasInput = state.screen.on || (state.face.detected && state.cam.on);
    if (!hasInput) return;
    this.lastAsk = now;

    if (this.getKey()) this.askLLM();
    else this.askVision();
    this.screenChanged = false;
  }

  async askLLM() {
    const obs = this.observe();
    try {
      const raw = await this.call(this.s.react, this.buildParts(obs, null));
      const out = parseReaction(raw);
      if (out.action === 'none') out.action = inferAction('', out.line, { ambient: true });
      this.emit(out.emotion, out.line, out.action);
    } catch (e) {
      console.warn('LLM 请求失败，回退到本地规则', e);
      this.askVision();
    }
  }

  async chatUser(text, context = '') {
    if (!this.getKey()) {
      const out = this.localReply(text);
      if (out.action === 'none') out.action = inferAction(text, out.line);
      return out;
    }
    const obs = this.perceptionPaused
      ? 'perception paused by the user; no camera or screen observation is being sent'
      : this.observe();
    const extra = context ? `Story memory (may be incomplete):\n${context}\n\nUser says: ${text}` : `User says: ${text}`;
    const parts = this.buildParts(obs, extra);
    try {
      const raw = await this.call(this.s.chat, parts);
      const out = parseReaction(raw);
      if (out.action === 'none') out.action = inferAction(text, out.line);
      this.history.push({ role: 'user', content: text });
      this.history.push({ role: 'assistant', content: out.line });
      if (this.history.length > 12) this.history.splice(0, this.history.length - 12);
      return out;
    } catch (e) {
      console.warn('聊天请求失败', e);
      return { emotion: 'surprised', line: this.s.chatError, action: 'none' };
    }
  }

  // 无 API Key 时的本地反应
  askVision() {
    const S = this.s;
    const f = state.face;
    const seen = f.detected && state.cam.on;

    if (seen && !this.prevSeen) {
      this.prevSeen = true;
      if (f.smile > 0.35) this.emit('happy', S.seenSmile);
      else this.emit('relaxed', S.seen);
    } else if (!seen && this.prevSeen) {
      this.prevSeen = false;
      this.emit('surprised', S.gone);
    } else if (seen && f.smile > 0.5 && Math.random() < 0.15) {
      this.emit('happy', S.smileRandom);
    } else if (state.screen.on) {
      const b = screenBrightness();
      if (b !== null && this.lastBright !== null && Math.abs(b - this.lastBright) > 0.15) {
        this.emit('surprised', S.screenChanged);
      } else if (!this.hintShown) {
        this.hintShown = true;
        this.emit('relaxed', S.screenHint);
      }
    }
    this.lastBright = screenBrightness() ?? this.lastBright;
  }

  localReply(text) {
    const S = this.s;
    const t = text.trim();
    const low = t.toLowerCase();
    const zh = this.getLang() === 'zh';
    const has = (...keys) => keys.some((k) => low.includes(k));
    if (has('挥手', '挥挥手', '打个招呼', 'wave')) {
      return { emotion: 'happy', line: zh ? '好呀，你看——我在这里。' : 'Sure — here I am.', action: 'wave' };
    }
    if (has('点头', '同意', 'nod')) {
      return { emotion: 'relaxed', line: zh ? '嗯，我同意。' : 'Nodding with you.', action: 'nod' };
    }
    if (has('摇头', '不同意', 'shake')) {
      return { emotion: 'surprised', line: zh ? '唔，我不太同意。' : 'Hmm, I am not so sure.', action: 'shake' };
    }
    if (has('鞠躬', '谢谢', 'bow')) {
      return { emotion: 'relaxed', line: zh ? '谢谢你。' : 'Thank you.', action: 'bow' };
    }
    if (has('欢呼', '鼓掌', 'cheer', 'yay')) {
      return { emotion: 'happy', line: zh ? '好耶！' : 'Yay!', action: 'cheer' };
    }
    if (has('指', 'point')) {
      return { emotion: 'relaxed', line: zh ? '你看那边。' : 'Look over there.', action: 'point' };
    }
    if (has('思考', '想一想', '让我想', 'think')) {
      return { emotion: 'relaxed', line: zh ? '让我想一想。' : 'Let me think.', action: 'think' };
    }
    if (has('你好', '嗨', '哈喽', 'hello', 'hi', 'hey')) return { emotion: 'happy', line: S.greet, action: 'none' };
    if (has('名字', '叫什么', 'name')) return { emotion: 'relaxed', line: S.name, action: 'none' };
    if (has('笑话', '讲故事', 'joke', 'story')) return { emotion: 'happy', line: S.joke, action: 'none' };
    if (has('心情', '开心', '难过', '累', '烦', 'sad', 'tired', 'happy')) return { emotion: 'relaxed', line: S.mood, action: 'none' };
    if (has('你是谁', '你会', '能做什么', 'who are you', 'what can you')) return { emotion: 'relaxed', line: S.whoami, action: 'none' };
    if (/[?？]$/.test(t)) return { emotion: 'surprised', line: S.question, action: 'none' };
    return { emotion: 'relaxed', line: S.fallback(t), action: 'none' };
  }

  emit(emotion, line, action = 'none') {
    const now = performance.now();
    if (now - this.lastLocalReact < this.cooldown) return;
    this.lastLocalReact = now;
    this.onEmotion(emotion, action);
    this.onLine(line);
  }
}

let brightCanvas = null;
function screenBrightness() {
  const v = state.screen.video;
  if (!v || !v.videoWidth) return null;
  brightCanvas ??= document.createElement('canvas');
  brightCanvas.width = 64; brightCanvas.height = 36;
  const ctx = brightCanvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(v, 0, 0, 64, 36);
  const d = ctx.getImageData(0, 0, 64, 36).data;
  let s = 0;
  for (let i = 0; i < d.length; i += 4) s += (d[i] + d[i + 1] + d[i + 2]) / 3;
  return s / (d.length / 4) / 255;
}
