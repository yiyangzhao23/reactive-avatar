// Pages Function: /api/chat — BYOK proxy for the virtual character.
// The visitor's key is forwarded only; it is never stored or logged.
const PRESETS = {
  openai: ['https://api.openai.com/v1/chat/completions', 'gpt-4o-mini'],
  gemini: ['https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', 'gemini-3.8-flash'],
  deepseek: ['https://api.deepseek.com/chat/completions', 'deepseek-chat'],
  openrouter: ['https://openrouter.ai/api/v1/chat/completions', 'deepseek/deepseek-chat'],
  opencode: ['https://opencode.ai/inference/openai/v1/chat/completions', 'gemini-3.5-flash-lite'],
};

function pickLlm(raw = {}, env = {}) {
  const provider = String(raw.provider || '').toLowerCase();
  let apiKey = String(raw.api_key || '').trim();
  let model = String(raw.model || '').trim();
  let baseUrl = String(raw.base_url || '').trim();

  if (!apiKey) {
    const envKey = {
      openai: env.OPENAI_API_KEY,
      gemini: env.GEMINI_API_KEY,
      deepseek: env.DEEPSEEK_API_KEY,
      openrouter: env.OPENROUTER_API_KEY,
    }[provider] || env.LLM_API_KEY || '';
    apiKey = String(envKey || '').trim();
    if (!apiKey) throw new Error('no API key: open 模型设置 or set a server key');
  }
  if (provider === 'custom') {
    if (!/^https:\/\//.test(baseUrl) && !/^http:\/\/(localhost|127\.0\.0\.1)/.test(baseUrl)) {
      throw new Error('custom base_url must be https:// or localhost');
    }
    if (!model) throw new Error('custom model is empty');
    return { provider, apiKey, model, baseUrl };
  }
  const p = provider in PRESETS ? provider : 'deepseek';
  const [url, defaultModel] = PRESETS[p];
  return { provider: p, apiKey, model: model || defaultModel, baseUrl: url };
}

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const llm = pickLlm(body.llm || {}, env || {});
    const payload = {
      model: llm.model,
      messages: body.messages || [],
      temperature: body.temperature ?? 0.7,
    };
    if (body.response_format && llm.provider !== 'gemini') {
      payload.response_format = body.response_format;
    }
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${llm.apiKey}`,
    };
    if (llm.provider === 'openrouter') {
      headers['HTTP-Referer'] = 'https://reactive-avatar.pages.dev';
      headers['X-Title'] = 'Reactive Avatar';
    }
    const upstream = await fetch(llm.baseUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message || String(e) }), {
      status: 400,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }
}
