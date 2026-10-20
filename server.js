'use strict';
require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const crypto = require('crypto');
const { generateReply, DEFAULT_MODEL } = require('./src/ai');
const app = express();
const PORT = Number(process.env.PORT) || 3000;
const publicDir = path.join(__dirname, 'public');
app.disable('x-powered-by');
// If deployed behind Render's proxy, trust only the single proxy hop Render adds.
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: { directives: {
  defaultSrc: ["'self'"], baseUri: ["'self'"], objectSrc: ["'none'"], frameAncestors: ["'self'"],
  scriptSrc: ["'self'", "'unsafe-inline'"], styleSrc: ["'self'", "'unsafe-inline'"],
  imgSrc: ["'self'", 'data:', 'https:'], connectSrc: ["'self'", 'https://generativelanguage.googleapis.com'],
  frameSrc: ["'self'", 'blob:'], upgradeInsecureRequests: null
} } }));
app.use(express.json({ limit: '40kb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));
const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 90, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Too many requests. Please wait a little and try again.' } });
app.use('/api/', apiLimiter);
const heartbeatLimiter = rateLimit({ windowMs: 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false });
const visitors = new Map();
const ONLINE_MS = 90 * 1000;
function visitorId(req) {
  // Never trust arbitrary client-provided IP headers. Express trust proxy is set for the hosting proxy.
  const raw = String(req.ip || req.socket.remoteAddress || 'unknown').slice(0, 100);
  return crypto.createHash('sha256').update(raw + (process.env.VISITOR_HASH_SALT || 'acey-aj-visitor-salt-change-me')).digest('hex').slice(0, 24);
}
function pruneVisitors() {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  for (const [id, v] of visitors) if (v.lastSeen < cutoff) visitors.delete(id);
}
app.get('/api/health', (req, res) => res.json({ ok: true, app: 'acey aj', aiConfigured: Boolean(process.env.GEMINI_API_KEY), model: process.env.GEMINI_MODEL || DEFAULT_MODEL }));
app.post('/api/heartbeat', heartbeatLimiter, (req, res) => {
  const id = visitorId(req);
  const now = Date.now();
  const existing = visitors.get(id);
  visitors.set(id, { lastSeen: now, firstSeen: existing?.firstSeen || now });
  pruneVisitors();
  res.json({ ok: true });
});
app.get('/api/visitors', (req, res) => {
  pruneVisitors();
  const now = Date.now();
  let online = 0;
  for (const v of visitors.values()) if (now - v.lastSeen <= ONLINE_MS) online++;
  const totalRecentlySeen = visitors.size;
  res.set('Cache-Control', 'no-store');
  res.json({ online, offline: Math.max(0, totalRecentlySeen - online), recentlySeen: totalRecentlySeen, updatedAt: new Date(now).toISOString() });
});
app.post('/api/ai', async (req, res) => {
  const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
  const context = typeof req.body?.context === 'string' ? req.body.context.trim().slice(0, 120) : 'general';
  if (!message) return res.status(400).json({ error: 'Please enter a message.' });
  if (message.length > 16000) return res.status(413).json({ error: 'Message is too long (maximum 16,000 characters).' });
  if (!process.env.GEMINI_API_KEY) return res.status(503).json({ error: 'AI backend is not configured. Add GEMINI_API_KEY to the hosting environment variables.' });
  try {
    const result = await generateReply(message, context);
    res.set('Cache-Control', 'no-store');
    res.json(result);
  } catch (err) {
    console.error('AI request failed:', String(err.message || err).slice(0, 300));
    res.status(502).json({ error: 'AI request failed. Check the model name, API key permissions, provider quota, and server logs.' });
  }
});
app.use(express.static(publicDir, { index: 'index.html', maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0 }));
app.get('*', (req, res) => res.sendFile(path.join(publicDir, 'index.html')));
app.listen(PORT, () => console.log(`acey aj listening on port ${PORT}`));
