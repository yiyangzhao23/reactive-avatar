import { describe, it, expect, vi, afterEach } from 'vitest';
import { onRequestPost } from '../../avatar-live/functions/api/chat.js';

const req = (body = '{}') =>
  new Request('https://example.com/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });

afterEach(() => vi.unstubAllGlobals());

describe('Pages Function /api/chat', () => {
  it('rejects a request without a visitor or server key', async () => {
    const res = await onRequestPost({ request: req(), env: {} });
    expect(res.status).toBe(400);
    expect(await res.text()).toContain('no API key');
  });

  it('rejects an insecure custom base URL', async () => {
    const body = JSON.stringify({
      llm: { provider: 'custom', api_key: 'test', model: 'm', base_url: 'http://evil.example' },
      messages: [],
    });
    const res = await onRequestPost({ request: req(body), env: {} });
    expect(res.status).toBe(400);
    expect(await res.text()).toContain('custom base_url');
  });

  it('forwards a custom request and strips response_format for Gemini', async () => {
    const calls = [];
    vi.stubGlobal('fetch', vi.fn(async (url, init) => {
      calls.push({ url, init });
      return new Response('{"choices":[{"message":{"content":"ok"}}]}', { status: 200 });
    }));
    const body = JSON.stringify({
      llm: { provider: 'gemini', api_key: 'test', model: 'gemini-test' },
      messages: [{ role: 'user', content: 'hi' }],
      response_format: { type: 'json_object' },
    });
    const res = await onRequestPost({ request: req(body), env: {} });
    expect(res.status).toBe(200);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain('generativelanguage.googleapis.com');
    expect(calls[0].init.headers.Authorization).toBe('Bearer test');
    expect(JSON.parse(calls[0].init.body).response_format).toBeUndefined();
  });
});
