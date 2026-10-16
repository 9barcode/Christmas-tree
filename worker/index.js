import { missionPromotionCode } from './promotion-codes.js';

const requiredTables = [
  'treemoa_users', 'treemoa_sessions', 'treemoa_trees', 'treemoa_cycles',
  'treemoa_ad_completions', 'treemoa_attendance', 'treemoa_settlements',
  'treemoa_promotion_api_calls', 'treemoa_missions',
  'treemoa_promotion_payments', 'treemoa_promotion_rate_limits',
];
const TOSS_ANON_VERIFY_URL = 'https://apps-in-toss-api.toss.im/api-partner/v1/apps-in-toss/users/anon-key/verify';

function allowedOrigins(env) {
  const configured = (env.ALLOWED_ORIGINS || '').split(',').map(x => x.trim()).filter(Boolean);
  return new Set(['http://localhost:4173', 'http://localhost:5173', ...configured]);
}
function json(request, env, body, status = 200) {
  const headers = new Headers({
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    vary: 'Origin',
  });
  const origin = request.headers.get('Origin');
  if (origin && allowedOrigins(env).has(origin)) {
    headers.set('access-control-allow-origin', origin);
    headers.set('access-control-allow-methods', 'GET, POST, DELETE, OPTIONS');
    headers.set('access-control-allow-headers', 'content-type, authorization');
    headers.set('access-control-max-age', '86400');
  }
  return new Response(status === 204 ? null : JSON.stringify(body), {status, headers});
}
function error(request, env, code, status, message) {
  return json(request, env, {error: code, ...(message ? {message} : {})}, status);
}
async function readJson(request) {
  const text = await request.text();
  if (text.length > 8192) return null;
  try { return JSON.parse(text); } catch { return null; }
}
function randomId(bytes = 24) {
  const data = crypto.getRandomValues(new Uint8Array(bytes));
  return [...data].map(n => n.toString(16).padStart(2, '0')).join('');
}
async function sha256(value) {
  const data = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(data)].map(n => n.toString(16).padStart(2, '0')).join('');
}
async function issueSession(request, env, user) {
  const token = randomId();
  const expiresAt = new Date(Date.now() + 7 * 86400000).toISOString();
  await env.DB.prepare('INSERT INTO treemoa_sessions (token_hash,user_id,expires_at) VALUES (?,?,?)')
    .bind(await sha256(token), user.id, expiresAt).run();
  return json(request, env, {token, tokenType: 'Bearer', expiresAt, user: {id: user.id}});
}
async function currentUser(request, env) {
  const match = (request.headers.get('Authorization') || '').match(/^Bearer ([a-f0-9]{48})$/i);
  if (!match) return null;
  return env.DB.prepare(`SELECT u.id,u.toss_user_key,s.token_hash
    FROM treemoa_sessions s JOIN treemoa_users u ON u.id=s.user_id
    WHERE s.token_hash=? AND s.expires_at>?`)
    .bind(await sha256(match[1]), new Date().toISOString()).first();
}
async function anonymousLogin(request, env) {
  const body = await readJson(request);
  if (typeof body?.hash !== 'string' || !/^[a-zA-Z0-9_+\/=\-]{16,256}$/.test(body.hash))
    return error(request, env, 'invalid_anonymous_hash', 400);
  if (!env.TOSS_MTLS) return error(request, env, 'toss_login_not_configured', 503,
    'Cloudflare Worker mTLS binding TOSS_MTLS is required.');
  try {
    const response = await env.TOSS_MTLS.fetch(TOSS_ANON_VERIFY_URL, {
      method: 'POST',
      headers: {'content-type': 'application/json', 'x-anon-key': body.hash},
      signal: AbortSignal.timeout(10000),
    });
    const result = await response.json();
    if (!response.ok || result.resultType !== 'SUCCESS' ||
        (result.success !== true && result.success !== 'true'))
      return error(request, env, 'invalid_anonymous_hash', 401);
    const tossUserKey = 'anon:' + body.hash;
    await env.DB.prepare('INSERT INTO treemoa_users (id,toss_user_key) VALUES (?,?) ON CONFLICT(toss_user_key) DO NOTHING')
      .bind(randomId(16), tossUserKey).run();
    const user = await env.DB.prepare('SELECT id,toss_user_key FROM treemoa_users WHERE toss_user_key=?')
      .bind(tossUserKey).first();
    if (!user) return error(request, env, 'database_unavailable', 503);
    return issueSession(request, env, user);
  } catch (cause) {
    console.error('[treemoa.auth]', cause instanceof Error ? cause.name : 'unknown');
    return error(request, env, 'toss_login_unavailable', 502);
  }
}
async function health(request, env) {
  try {
    const {results} = await env.DB.prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name IN (${requiredTables.map(() => '?').join(',')})`
    ).bind(...requiredTables).all();
    const present = new Set(results.map(row => row.name));
    const ready = requiredTables.every(name => present.has(name));
    return json(request, env, {service: 'treemoa', database: ready ? 'ready' : 'migration_required'},
      ready ? 200 : 503);
  } catch (cause) {
    console.error('[treemoa.health]', cause instanceof Error ? cause.name : 'unknown');
    return json(request, env, {service: 'treemoa', database: 'unavailable'}, 503);
  }
}
async function promotions(request, env, user) {
  if (!user.toss_user_key.startsWith('anon:'))
    return error(request, env, 'anonymous_session_required', 403);
  const row = await env.DB.prepare(`SELECT mission_day AS day,points,status,tested_at,
      claim_token FROM treemoa_missions WHERE user_id=? AND mission_day=30`)
    .bind(user.id).first();
  if (!row) return json(request, env, {missions: []});
  return json(request, env, {missions: [{
    day: 30,
    points: 20,
    status: row.status,
    configured: !!missionPromotionCode(env),
    processing: !!row.claim_token && row.status !== 'paid',
    testMode: !!missionPromotionCode(env) && env.TOSS_PROMOTION_MODE !== 'live',
    tested: !!row.tested_at,
  }]});
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return json(request, env, {}, 204);
    if (url.pathname === '/api/health')
      return request.method === 'GET' ? health(request, env) : error(request, env, 'method_not_allowed', 405);
    if (url.pathname === '/api/auth/anonymous' && request.method === 'POST')
      return anonymousLogin(request, env);
    if (url.pathname === '/api/auth/anonymous') return error(request, env, 'method_not_allowed', 405);
    let user;
    try { user = await currentUser(request, env); }
    catch { return error(request, env, 'database_unavailable', 503); }
    if (!user) return error(request, env, 'unauthorized', 401);
    if (url.pathname === '/api/promotions' && request.method === 'GET') {
      try { return await promotions(request, env, user); }
      catch (cause) {
        console.error('[treemoa.promotions]', cause instanceof Error ? cause.name : 'unknown');
        return error(request, env, 'missions_unavailable', 503);
      }
    }
    if (url.pathname === '/api/auth/session' && request.method === 'DELETE') {
      await env.DB.prepare('DELETE FROM treemoa_sessions WHERE token_hash=?')
        .bind(user.token_hash).run();
      return json(request, env, {ok: true});
    }
    return error(request, env, 'not_found', 404);
  },
};
