
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

// Render proxy configuration.
app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'https://api.x.ai'],
      frameSrc: ["'self'", 'blob:'],
      upgradeInsecureRequests: null
    }
  }
}));

app.use(express.json({ limit: '40kb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 90,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    error: 'Too many requests. Please wait a little and try again.'
  }
});

app.use('/api/', apiLimiter);

const heartbeatLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false
});

// Temporary visitor tracking; resets when the server restarts.
const visitors = new Map();
const ONLINE_MS = 90 * 1000;

function visitorId(req) {
  const raw = String(
    req.ip || req.socket.remoteAddress || 'unknown'
  ).slice(0, 100);

  const salt = process.env.VISITOR_HASH_SALT;

  if (!salt) {
    throw new Error('VISITOR_HASH_SALT is not configured.');
  }

  return crypto
    .createHash('sha256')
    .update(raw + salt)
    .digest('hex')
    .slice(0, 24);
}

function pruneVisitors() {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;

  for (const [id, visitor] of visitors) {
    if (visitor.lastSeen < cutoff) {
      visitors.delete(id);
    }
  }
}

// Health check.
app.get('/api/health', (req, res) => {
  res.set('Cache-Control', 'no-store');

  res.json({
    ok: true,
    app: 'acey aj',
    aiProvider: 'xAI Grok',
    aiConfigured: Boolean(process.env.XAI_API_KEY),
    model: process.env.GROK_MODEL || DEFAULT_MODEL
  });
});

// Visitor heartbeat.
app.post('/api/heartbeat', heartbeatLimiter, (req, res) => {
  let id;

  try {
    id = visitorId(req);
  } catch (err) {
    return res.status(500).json({
      error: 'Visitor tracking is not configured.'
    });
  }

  const now = Date.now();
  const existing = visitors.get(id);

  visitors.set(id, {
    lastSeen: now,
    firstSeen: existing?.firstSeen || now
  });

  pruneVisitors();

  res.set('Cache-Control', 'no-store');
  res.json({ ok: true });
});

// Aggregate visitor counts only.
app.get('/api/visitors', (req, res) => {
  pruneVisitors();

  const now = Date.now();
  let online = 0;

  for (const visitor of visitors.values()) {
    if (now - visitor.lastSeen <= ONLINE_MS) {
      online++;
    }
  }

  const recentlySeen = visitors.size;

  res.set('Cache-Control', 'no-store');

  res.json({
    online,
    offline: Math.max(0, recentlySeen - online),
    recentlySeen,
    updatedAt: new Date(now).toISOString()
  });
});

// Grok AI endpoint.
app.post('/api/ai', async (req, res) => {
  const message =
    typeof req.body?.message === 'string'
      ? req.body.message.trim()
      : '';

  const context =
    typeof req.body?.context === 'string'
      ? req.body.context.trim().slice(0, 120)
      : 'general';

  if (!message) {
    return res.status(400).json({
      error: 'Please enter a message.'
    });
  }

  if (message.length > 16000) {
    return res.status(413).json({
      error: 'Message is too long (maximum 16,000 characters).'
    });
  }

  if (!process.env.XAI_API_KEY) {
    return res.status(503).json({
      error: 'Grok is not configured. Add XAI_API_KEY to Render environment variables.'
    });
  }

  try {
    const result = await generateReply(message, context);

    res.set('Cache-Control', 'no-store');
    res.json(result);
  } catch (err) {
    console.error(
      'Grok request failed:',
      String(err.message || err).slice(0, 300)
    );

    res.status(502).json({
      error: 'Grok request failed. Check the model ID, API key, xAI API access, credits, and server logs.'
    });
  }
});

// Serve the website.
app.use(express.static(publicDir, {
  index: 'index.html',
  maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0
}));

app.get('*', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`acey aj listening on port ${PORT}`);
});
          
