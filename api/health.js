export default async function handler(request) {
  const configured = Boolean(process.env.OPENROUTER_API_KEY);
  return new Response(JSON.stringify({
    ok: true,
    provider: configured ? 'openrouter-image' : 'unconfigured',
    model: process.env.OPENROUTER_IMAGE_MODEL || 'google/gemini-2.5-flash-image',
    configured
  }), {
    status: 200,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
  });
}
