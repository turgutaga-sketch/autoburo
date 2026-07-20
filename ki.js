// api/ki.js — NWASB Büro · KI-Proxy für Claude (Anthropic)
// Kurulum / Setup:
// 1) Bu dosyayı repoda "api" klasörüne koy:  repo/api/ki.js
// 2) Vercel → Project → Settings → Environment Variables:
//      ANTHROPIC_API_KEY = sk-ant-...   (Production + Preview)
// 3) Yeniden deploy et. Uygulama /api/ki adresini otomatik kullanır.
// Anahtar asla tarayıcıya gitmez — güvenle sunucuda kalır.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: { message: 'POST only' } });
    return;
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(500).json({ error: { message: 'ANTHROPIC_API_KEY fehlt in Vercel Environment Variables.' } });
    return;
  }
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(req.body)
    });
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (e) {
    res.status(500).json({ error: { message: String(e.message || e) } });
  }
}

export const config = { api: { bodyParser: { sizeLimit: '8mb' } } };
