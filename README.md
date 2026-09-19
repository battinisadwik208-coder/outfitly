# Outfitly

A polished virtual try-on MVP: upload a person, upload an outfit, generate an AI try-on image, compare before/after, and download the result.

## Online deployment

The hosted version is designed for Vercel:

```bash
npm install
npm run build
```

Add these Vercel environment variables. `OPENROUTER_API_KEY` is server-only and must never use the `VITE_` prefix:

```text
OPENROUTER_API_KEY=your-openrouter-key
OPENROUTER_IMAGE_MODEL=google/gemini-2.5-flash-image
OPENROUTER_SITE_URL=https://your-outfitly-domain.vercel.app
```

The browser sends resized base64 images to `/api/try-on`. The Vercel function forwards them to OpenRouter's image API using `input_references`, then returns the generated image to the browser. The OpenRouter key never reaches the frontend.

OpenRouter image generation is metered by the selected model/account. If the account has no available credits, the API returns a clear error instead of silently claiming a result.

## Local development

```bash
npm install
npm run dev
```

For local API testing, use the server-only `.env` file and run the existing Node server. Never commit `.env` or place secrets in `VITE_*` variables.

## Product decisions

- Uploaded images are processed in memory and are not persisted by this app.
- Generate is disabled until both images are selected.
- Images are resized in the browser before the online request to reduce payload size.
- The result can be exported as a PNG from the browser.
