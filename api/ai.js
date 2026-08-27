// POST /api/ai
// Body: { model: "gemini-2.5-flash", max_tokens: 1000, content: [ ...Anthropic-style content blocks... ] }
// Header: x-device-id: <per-device id the frontend generates>
//
// This is the ONLY place the real Gemini API key is used. Set it as the
// GEMINI_API_KEY environment variable in your hosting provider's dashboard —
// never put it in frontend code.
//
// The frontend was originally built against Anthropic's Messages API shape
// (content blocks in, { content: [{type:'text', text}] } out). Rather than
// touch index.html, this file translates in both directions so the rest of
// the app doesn't need to know which provider is behind it.

const { checkAndIncrement } = require('./_lib/quota');

const ALLOWED_MODELS = new Set([
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite'
]);

// Anthropic-style content blocks -> Gemini "parts"
function toGeminiParts(content) {
  return content.map((block) => {
    if (block.type === 'text') {
      return { text: block.text };
    }
    if (block.type === 'image' && block.source && block.source.type === 'base64') {
      return {
        inline_data: {
          mime_type: block.source.media_type || 'image/jpeg',
          data: block.source.data
        }
      };
    }
    // Unknown block type — drop it rather than sending something Gemini will reject.
    return null;
  }).filter(Boolean);
}

// Gemini response -> the { content: [{type:'text', text}] } shape the frontend expects
function toAnthropicStyleContent(geminiData) {
  const candidate = geminiData.candidates && geminiData.candidates[0];
  const parts = (candidate && candidate.content && candidate.content.parts) || [];
  const text = parts.map((p) => p.text || '').join('');
  return [{ type: 'text', text }];
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const deviceId = req.headers['x-device-id'];
  if (!deviceId) {
    res.status(400).json({ error: 'Missing x-device-id header' });
    return;
  }

  const quota = await checkAndIncrement(deviceId);
  if (!quota.allowed) {
    res.status(429).json({
      error: 'RATE_LIMIT',
      message: `Daily free AI limit reached (${quota.limit}/day) — resets tomorrow.`,
      used: quota.used,
      limit: quota.limit
    });
    return;
  }

  const { model, max_tokens, content } = req.body || {};
  const safeModel = ALLOWED_MODELS.has(model) ? model : 'gemini-2.5-flash';
  const safeMaxTokens = Math.min(parseInt(max_tokens, 10) || 1000, 4000);

  if (!Array.isArray(content) || content.length === 0) {
    res.status(400).json({ error: 'Missing content' });
    return;
  }

  const parts = toGeminiParts(content);
  if (parts.length === 0) {
    res.status(400).json({ error: 'No usable content blocks' });
    return;
  }

  try {
    const apiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${safeModel}:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts }],
          generationConfig: { maxOutputTokens: safeMaxTokens }
        })
      }
    );
    const data = await apiRes.json();
    if (data.error) {
      res.status(502).json({ error: data.error.message || 'Upstream API error' });
      return;
    }
    res.status(200).json({
      content: toAnthropicStyleContent(data),
      used: quota.used,
      limit: quota.limit
    });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Server error' });
  }
};
