import http from 'node:http';
import { randomUUID } from 'node:crypto';

const port = Number(process.env.PORT || 8787);
const requestyToken = process.env.REQUESTY_API_KEY;
const requestyModel = process.env.REQUESTY_MODEL || 'vertex/gemini-3.1-flash-image';
const openRouterToken = process.env.OPENROUTER_API_KEY;
const openRouterModel = process.env.OPENROUTER_VISION_MODEL || process.env.OPENROUTER_IMAGE_MODEL;

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json', 'access-control-allow-origin': '*' });
  res.end(JSON.stringify(body));
}

async function collect(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

function imagePart(url) {
  return { type: 'image_url', image_url: { url } };
}

function textFromContent(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map((part) => part.text || '').filter(Boolean).join('\n');
  return '';
}

function requestyImage(result) {
  const images = result?.choices?.[0]?.message?.images;
  const first = Array.isArray(images) ? images[0] : null;
  return first?.image_url?.url || first?.url || null;
}

function requestyText(result) {
  return textFromContent(result?.choices?.[0]?.message?.content);
}

async function callRequesty(body) {
  const response = await fetch('https://router.requesty.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${requestyToken}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.REQUESTY_SITE_URL || 'http://localhost:5173',
      'X-Title': 'Outfitly'
    },
    body: JSON.stringify({
      model: requestyModel,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: 'Create a realistic virtual try-on image. Keep the person identity, face, body shape, pose, lighting, and background from the first image. Replace only the clothing with the garment from the second image. Preserve garment color, cut, texture, logos, and details. Return the edited image and a short styling note.' },
          imagePart(body.person),
          imagePart(body.outfit)
        ]
      }],
      image_config: { aspect_ratio: '3:4', image_size: '1K' }
    })
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error?.message || result.detail || `Requesty returned HTTP ${response.status}.`);
  return result;
}

async function callOpenRouterAnalysis(body) {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openRouterToken}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'http://localhost:5173',
      'X-Title': 'Outfitly'
    },
    body: JSON.stringify({
      model: openRouterModel,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: 'Analyze the person photo and garment photo. Give concise notes on garment type, colors, fit compatibility, styling suggestions, and image quality. Do not claim the garment is actually worn.' },
          imagePart(body.person),
          imagePart(body.outfit)
        ]
      }],
      max_tokens: 350
    })
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error?.message || result.detail || `OpenRouter returned HTTP ${response.status}.`);
  return result;
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type' });
    return res.end();
  }

  if (req.method === 'GET' && req.url === '/api/health') {
    const provider = requestyToken ? 'requesty-image' : openRouterToken && openRouterModel ? 'openrouter-vision-analysis' : 'local-preview';
    return json(res, 200, { ok: true, provider, model: provider === 'requesty-image' ? requestyModel : provider === 'openrouter-vision-analysis' ? openRouterModel : null, configured: provider !== 'local-preview' });
  }

  if (req.method === 'POST' && req.url === '/api/try-on') {
    try {
      const body = JSON.parse(await collect(req));
      if (!body.person || !body.outfit) return json(res, 400, { error: 'person and outfit are required' });

      if (requestyToken) {
        const result = await callRequesty(body);
        const output = requestyImage(result);
        const analysis = requestyText(result);
        if (output) return json(res, 200, { mode: 'requesty-image', status: 'succeeded', id: result.id || randomUUID(), output, analysis, model: requestyModel, usage: result.usage || null });
        return json(res, 502, { error: 'Requesty returned no generated image. Check that the selected model has image output enabled.', provider: 'requesty-image', response: result });
      }

      if (openRouterToken && openRouterModel) {
        const result = await callOpenRouterAnalysis(body);
        return json(res, 200, { mode: 'openrouter-analysis', status: 'succeeded', id: result.id || randomUUID(), analysis: textFromContent(result.choices?.[0]?.message?.content) || 'No written analysis returned.', model: openRouterModel, usage: result.usage || null });
      }

      return json(res, 200, { mode: 'local-preview', status: 'succeeded', id: randomUUID(), analysis: null, message: 'No AI provider configured; using the zero-cost local preview.' });
    } catch (error) {
      return json(res, 500, { error: error.message });
    }
  }

  json(res, 404, { error: 'Not found' });
});

server.listen(port, () => console.log(`Outfitly API listening on http://localhost:${port}`));
