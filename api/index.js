'use strict';
// The whole backend in one file: login + files. Used by index.html and dashboard.html
const crypto = require('crypto');

const DB_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const DB_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const MAX = 700000, WEEK = 7 * 24 * 3600 * 1000;

async function db(cmd) {
  if (!DB_URL || !DB_TOKEN) throw new Error('Database not connected yet (see README step 3).');
  const r = await fetch(DB_URL, { method: 'POST', headers: { Authorization: 'Bearer ' + DB_TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify(cmd) });
  const j = await r.json();
  if (!r.ok || j.error) throw new Error(j.error || 'Database error');
  return j.result;
}
const secret = () => process.env.SESSION_SECRET || crypto.createHash('sha256').update('rv|' + process.env.OWNER_USERNAME + '|' + process.env.OWNER_PASSWORD).digest('hex');
const sign = v => crypto.createHmac('sha256', secret()).update(v).digest('hex');
const same = (a, b) => { a = crypto.createHash('sha256').update(String(a)).digest(); b = crypto.createHash('sha256').update(String(b)).digest(); return crypto.timingSafeEqual(a, b); };

function isOwner(req) {
  const m = /(?:^|;\s*)sid=([^;]+)/.exec(req.headers.cookie || '');
  if (!m) return false;
  const [exp, sig] = m[1].split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const want = sign(exp);
  return sig.length === want.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(want));
}
function send(res, code, obj, headers) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  for (const k in headers || {}) res.setHeader(k, headers[k]);
  res.end(JSON.stringify(obj));
}
const clean = n => String(n || 'untitled.txt').replace(/[\r\n\t]/g, ' ').trim().slice(0, 120) || 'untitled.txt';
const meta = f => ({ id: f.id, name: f.name, added: f.added, updated: f.updated, size: f.text.length });

module.exports = async (req, res) => {
  try {
    const q = req.query || {}, action = q.action, id = String(q.id || '');
    let body = req.body; if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } } body = body || {};

    if (req.method !== 'GET') {
      try { if (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) return send(res, 403, { error: 'Bad origin' }); }
      catch (e) { return send(res, 403, { error: 'Bad origin' }); }
    }
    const own = isOwner(req);

    if (action === 'me') return send(res, 200, { owner: own });

    if (action === 'login' && req.method === 'POST') {
      if (!process.env.OWNER_USERNAME || !process.env.OWNER_PASSWORD) return send(res, 500, { error: 'Login not set up yet (see README step 4).' });
      const key = 'rl:' + String(req.headers['x-forwarded-for'] || 'x').split(',')[0].trim();
      const n = await db(['INCR', key]);
      if (n === 1) await db(['EXPIRE', key, 600]);
      if (n > 8) return send(res, 429, { error: 'Too many tries. Wait 10 minutes.' });
      const ok = same(body.password || '', process.env.OWNER_PASSWORD) & same(String(body.username || '').toLowerCase(), process.env.OWNER_USERNAME.toLowerCase());
      if (!ok) return send(res, 401, { error: 'Wrong username or password' });
      await db(['DEL', key]);
      const exp = String(Date.now() + WEEK);
      return send(res, 200, { ok: true }, { 'Set-Cookie': 'sid=' + exp + '.' + sign(exp) + '; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=' + WEEK / 1000 });
    }
    if (action === 'logout' && req.method === 'POST') return send(res, 200, { ok: true }, { 'Set-Cookie': 'sid=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0' });

    if (action === 'list' && req.method === 'GET') {
      const flat = (await db(['HGETALL', 'files'])) || [], out = [];
      for (let i = 1; i < flat.length; i += 2) { try { out.push(meta(JSON.parse(flat[i]))); } catch (e) { /* skip */ } }
      return send(res, 200, out.sort((a, b) => (a.added + a.id < b.added + b.id ? -1 : 1)));
    }
    if (action === 'create' && req.method === 'POST') {
      if (!own) return send(res, 401, { error: 'Owner only' });
      const text = String(body.text || '');
      if (text.length > MAX) return send(res, 413, { error: 'File too big (max about 700 KB).' });
      const day = new Date().toISOString().slice(0, 10);
      const f = { id: crypto.randomBytes(6).toString('hex'), name: clean(body.name), text, added: day, updated: day };
      await db(['HSET', 'files', f.id, JSON.stringify(f)]);
      return send(res, 201, meta(f));
    }
    if (['get', 'update', 'remove'].includes(action)) {
      if (!/^[a-f0-9]{12}$/.test(id)) return send(res, 404, { error: 'Not found' });
      const raw = await db(['HGET', 'files', id]);
      if (!raw) return send(res, 404, { error: 'Not found' });
      const f = JSON.parse(raw);
      if (action === 'get') return send(res, 200, Object.assign(meta(f), { text: f.text }));
      if (!own) return send(res, 401, { error: 'Owner only' });
      if (action === 'remove') { await db(['HDEL', 'files', id]); return send(res, 200, { ok: true }); }
      if (body.name !== undefined) f.name = clean(body.name);
      if (body.text !== undefined) { if (String(body.text).length > MAX) return send(res, 413, { error: 'Text too big.' }); f.text = String(body.text); }
      f.updated = new Date().toISOString().slice(0, 10);
      await db(['HSET', 'files', id, JSON.stringify(f)]);
      return send(res, 200, meta(f));
    }
    send(res, 404, { error: 'Not found' });
  } catch (e) { console.error(e); send(res, 500, { error: e.message || 'Server error' }); }
};
