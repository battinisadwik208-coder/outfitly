function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
  });
}

function textFromContent(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map((part) => part?.text || '').filter(Boolean).join('\n');
  return '';
}

export const config = { api: { bodyParser: { sizeLimit: '12mb' } } };

export default async function handler(request) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type' } });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const token = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_IMAGE_MODEL || 'google/gemini-2.5-flash-image';
  if (!token) return json({ error: 'OpenRouter is not configured on the server.' }, 503);

  try {
    const body = await request.json();
    if (!body.person || !body.outfit) return json({ error: 'person and outfit are required' }, 400);

    const prompt = `Create a realistic virtual try-on image. Use the first reference as the person photo and the second reference as the garment/outfit. Keep the person's identity, face, body shape, pose, lighting, and background consistent. Replace the clothing with the uploaded garment and preserve its color, cut, texture, logos, and details. Make the garment fit naturally. ${body.description ? `The uploaded file is named ${body.description}.` : ''}`;
    const response = await fetch('https://openrouter.ai/api/v1/images', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'https://outfitly.vercel.app',
        'X-Title': 'Outfitly'
      },
      body: JSON.stringify({
        model,
        prompt,
        input_references: [
          { type: 'image_url', image_url: { url: body.person } },
          { type: 'image_url', image_url: { url: body.outfit } }
        ],
        aspect_ratio: '3:4',
        size: '1K',
        output_format: 'png',
        n: 1
      })
    });

    const result = await response.json();
    if (!response.ok) return json({ error: result.error?.message || result.detail || `OpenRouter returned HTTP ${response.status}.`, provider: 'openrouter-image' }, response.status >= 400 && response.status < 500 ? response.status : 502);

    const image = result?.data?.[0];
    if (!image?.b64_json) return json({ error: 'OpenRouter returned no generated image.', provider: 'openrouter-image' }, 502);
    const mediaType = image.media_type || 'image/png';
    return json({ mode: 'openrouter-image', status: 'succeeded', output: `data:${mediaType};base64,${image.b64_json}`, analysis: textFromContent(result?.choices?.[0]?.message?.content), model, usage: result.usage || null });
  } catch (error) {
    return json({ error: error.message || 'Unexpected server error.' }, 500);
  }
}
