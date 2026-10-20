'use strict';
const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
async function generateReply(message, context = 'general') {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('AI is not configured. Add GEMINI_API_KEY in your server environment variables.');
  const model = (process.env.GEMINI_MODEL || DEFAULT_MODEL).replace(/[^a-zA-Z0-9._-]/g, '');
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
  const response = await fetch(endpoint, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: 'You are acey aj, a friendly coding tutor. Explain clearly, encourage safe and legal development, and state uncertainty. For code conversion, preserve behavior and note likely incompatibilities. Never claim code was executed unless it was. Do not assist with unauthorized access, malware, credential theft, or attacks.' }] },
      contents: [{ role: 'user', parts: [{ text: `Context: ${String(context).slice(0, 120)}\n\n${String(message).slice(0, 16000)}` }] }],
      generationConfig: { temperature: 0.35, maxOutputTokens: 1800 }
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = data?.error?.message || `Gemini request failed (${response.status})`;
    throw new Error(detail.slice(0, 500));
  }
  const reply = data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('\n').trim();
  if (!reply) throw new Error('The AI provider returned no text. Check model availability and API quota.');
  return { reply, model };
}
module.exports = { generateReply, DEFAULT_MODEL };
