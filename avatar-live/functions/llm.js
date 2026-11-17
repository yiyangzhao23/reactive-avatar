// Pages Function: BYOK proxy for the OpenCode gateway (CORS workaround).
// The user's key is forwarded only; it is never stored or logged.

export async function onRequestPost({ request }) {
  const auth = request.headers.get('Authorization') || '';
  const body = await request.text();

  if (!auth.startsWith('Bearer ')) {
    return json({ error: 'missing key' }, 401);
  }
  if (body.length > 600000) {
    return json({ error: 'payload too large' }, 413);
  }

  const upstream = await fetch('https://opencode.ai/inference/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: auth },
    body,
  });
  const text = await upstream.text();
  return new Response(text, {
    status: upstream.status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
