import { describe, it, expect, vi, afterEach } from 'vitest';
import { onRequestPost } from '../../avatar-live/functions/llm.js';

const req = (body = '{}', headers = {}) =>
  new Request('https://example.com/llm', { method: 'POST', headers, body });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Pages Function /llm', () => {
  it('rejects a missing or malformed key', async () => {
    const res = await onRequestPost({ request: req() });
    expect(res.status).toBe(401);
    const text = await res.text();
    expect(text).toContain('missing key');
  });

  it('rejects oversized payloads', async () => {
    const res = await onRequestPost({
      request: req('x'.repeat(600001), { Authorization: 'Bearer test' }),
    });
    expect(res.status).toBe(413);
  });

  it('forwards only to the OpenCode gateway with the user key', async () => {
    const calls = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url, init) => {
        calls.push({ url, init });
        return new Response('{"ok":true}', {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      })
    );

    const res = await onRequestPost({
      request: req('{"model":"m","messages":[]}', {
        Authorization: 'Bearer user-key',
        'Content-Type': 'application/json',
      }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://opencode.ai/inference/openai/v1/chat/completions');
    expect(calls[0].init.method).toBe('POST');
    expect(calls[0].init.headers.Authorization).toBe('Bearer user-key');
    expect(calls[0].init.body).toBe('{"model":"m","messages":[]}');
  });

  it('passes upstream error status through', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{"error":"bad"}', { status: 401 }))
    );
    const res = await onRequestPost({
      request: req('{}', { Authorization: 'Bearer bad' }),
    });
    expect(res.status).toBe(401);
  });
});
