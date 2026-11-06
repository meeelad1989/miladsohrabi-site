#!/usr/bin/env node
/*
 * Local mock login API — for testing the login page and the stuffing runner
 * end to end on your own machine. No dependencies; Node 18+.
 *
 *   node server.js            # listens on http://localhost:8787
 *   PORT=9000 node server.js
 *
 * It accepts POST /api/login { username, password } and returns 200 for one
 * known test account, 401 otherwise. It also applies a trivial per-IP rate
 * limit so you can see lockout behaviour locally. This is a stand-in for a
 * real backend; it does no real authentication and stores nothing.
 */
'use strict';
const http = require('http');

const PORT = process.env.PORT || 8787;

// Single dummy account so a "success" path exists to test against. Not real.
const VALID = { username: 'test@example.com', password: 'correct-horse' };

// Naive in-memory rate limit: N attempts per IP per window.
const WINDOW_MS = 60 * 1000;
const MAX_ATTEMPTS = 10;
const hits = new Map(); // ip -> { count, resetAt }

function rateLimited(ip) {
  const now = Date.now();
  let rec = hits.get(ip);
  if (!rec || now > rec.resetAt) {
    rec = { count: 0, resetAt: now + WINDOW_MS };
    hits.set(ip, rec);
  }
  rec.count += 1;
  return rec.count > MAX_ATTEMPTS;
}

function send(res, status, obj, extraHeaders) {
  const body = JSON.stringify(obj);
  res.writeHead(status, Object.assign({
    'Content-Type': 'application/json',
    // Permissive CORS so the local login.html (file:// or any port) can call it.
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  }, extraHeaders || {}));
  res.end(body);
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  if (req.method !== 'POST' || req.url !== '/api/login') {
    return send(res, 404, { error: 'not_found' });
  }

  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown')
    .split(',')[0].trim();

  let raw = '';
  req.on('data', (c) => {
    raw += c;
    if (raw.length > 1e4) req.destroy(); // guard against huge bodies
  });
  req.on('end', () => {
    if (rateLimited(ip)) {
      return send(res, 429, { error: 'too_many_attempts', retry_after_s: 60 },
        { 'Retry-After': '60' });
    }
    let body;
    try { body = JSON.parse(raw || '{}'); }
    catch { return send(res, 400, { error: 'bad_json' }); }

    const ok = body.username === VALID.username && body.password === VALID.password;
    // Tiny delay so success/failure aren't trivially timing-distinguishable.
    setTimeout(() => {
      if (ok) send(res, 200, { ok: true, token: 'mock-session-' + Date.now() });
      else send(res, 401, { ok: false, error: 'invalid_credentials' });
    }, 120);
  });
});

server.listen(PORT, () => {
  console.log('Mock login API on http://localhost:' + PORT + '/api/login');
  console.log('Valid test account: ' + VALID.username + ' / ' + VALID.password);
  console.log('Rate limit: ' + MAX_ATTEMPTS + ' attempts / ' + (WINDOW_MS / 1000) + 's per IP');
});
