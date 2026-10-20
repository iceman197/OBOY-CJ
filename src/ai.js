
'use strict';

const DEFAULT_MODEL = process.env.GROK_MODEL || 'grok-4.7';

async function generateReply(message, context = 'general') {
  const key = process.env.XAI_API_KEY;

  if (!key) {
    throw new Error(
      'Grok is not configured. Add XAI_API_KEY in Render environment variables.'
    );
  }

  const model = (process.env.GROK_MODEL || DEFAULT_MODEL).trim();

  if (!/^[a-zA-Z0-9._-]+$/.test(model)) {
    throw new Error('Invalid GROK_MODEL setting.');
  }

  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content: 'You are acey aj, a friendly coding tutor. Explain clearly, encourage safe and legal development, and state uncertainty. For code conversion, preserve behavior and note likely incompatibilities. Never claim code was executed unless it was. Do not assist with unauthorized access, malware, credential theft, or attacks.'
        },
        {
          role: 'user',
          content: `Context: ${String(context).slice(0, 120)}\n\n${String(message).slice(0, 16000)}`
        }
      ],
      temperature: 0.35,
      max_tokens: 1800
    })
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const detail = data?.error?.message ||
      `Grok request failed (${response.status})`;
    throw new Error(detail.slice(0, 500));
  }

  const reply = data?.choices?.[0]?.message?.content;

  if (typeof reply !== 'string' || !reply.trim()) {
    throw new Error(
      'Grok returned no text. Check model access and API credits.'
    );
  }

  return { reply: reply.trim(), model };
}

module.exports = { generateReply, DEFAULT_MODEL };

