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
  const appName = (env.TOSS_APP_NAME || 'christmas-tree-decorating').toLowerCase();
  const tossOrigins = /^[a-z0-9-]+$/.test(appName) ? [
    `https://${appName}.apps.tossmini.com`,
    `https://${appName}.private-apps.tossmini.com`,
    `https://${appName}.web.tossmini.com`,
    `https://${appName}.private-web.tossmini.com`,
  ] : [];
  return new Set(['http://localhost:4173', 'http://localhost:5173', ...tossOrigins, ...configured]);
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
async function treeState(env, user) {
  const firstId = randomId(16);
  await env.DB.prepare(`INSERT INTO treemoa_trees (id,user_id,slot,color)
    VALUES (?, ?, 1, 'green') ON CONFLICT(user_id,slot) DO NOTHING`).bind(firstId,user.id).run();
  const trees = await env.DB.prepare('SELECT id,slot,color,current_cycle FROM treemoa_trees WHERE user_id=? ORDER BY slot')
    .bind(user.id).all();
  const result = [];
  for (const tree of trees.results) {
    await env.DB.prepare('INSERT INTO treemoa_cycles (tree_id,cycle) VALUES (?,?) ON CONFLICT(tree_id,cycle) DO NOTHING')
      .bind(tree.id,tree.current_cycle).run();
    const cycle = await env.DB.prepare(`SELECT attendance_count,last_attendance_date,positions_json
      FROM treemoa_cycles WHERE tree_id=? AND cycle=?`).bind(tree.id,tree.current_cycle).first();
    const settlement = await env.DB.prepare(`SELECT reward_ref,amount,status FROM treemoa_settlements
      WHERE tree_id=? AND cycle=?`).bind(tree.id,tree.current_cycle).first();
    const index = tree.slot;
    const lastDate = cycle?.last_attendance_date || null;
    const count = cycle?.attendance_count || 0;
    const key = `${index}:${lastDate}:${count}${tree.current_cycle ? `:cycle-${tree.current_cycle}` : ''}`;
    result.push({
      id: tree.slot, serverId: tree.id, color: tree.color, count, lastDate,
      cycle: tree.current_cycle, positions: JSON.parse(cycle?.positions_json || '{}'),
      ...(settlement ? {rewardRecord: {key,rewardRef:settlement.reward_ref,amount:settlement.amount,status:settlement.status}} : {}),
    });
  }
  return {version:1,selected:0,trees:result};
}
async function getTrees(request, env, user) {
  if (!user.toss_user_key.startsWith('anon:'))
    return error(request, env, 'anonymous_session_required', 403);
  const state = await treeState(env,user);
  return json(request,env,{state});
}
async function createTree(request, env, user) {
  if (!user.toss_user_key.startsWith('anon:'))
    return error(request, env, 'anonymous_session_required', 403);
  const state = await treeState(env,user);
  if (state.trees.length >= 5) return error(request,env,'tree_slots_full',409);
  const previous = state.trees.at(-1);
  if (!previous || previous.count < 1)
    return error(request,env,'previous_tree_not_started',409);
  const slot = state.trees.length + 1;
  const colors = ['green','white','pink','blue','gold'];
  const color = colors[crypto.getRandomValues(new Uint8Array(1))[0] % colors.length];
  const id = randomId(16);
  await env.DB.prepare('INSERT INTO treemoa_trees (id,user_id,slot,color) VALUES (?,?,?,?)')
    .bind(id,user.id,slot,color).run();
  await env.DB.prepare('INSERT INTO treemoa_cycles (tree_id,cycle) VALUES (?,0)').bind(id).run();
  return json(request,env,{state:await treeState(env,user)});
}
function kstDate() {
  return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
}
async function attendTree(request, env, user) {
  if (!user.toss_user_key.startsWith('anon:'))
    return error(request,env,'anonymous_session_required',403);
  const body = await readJson(request);
  if (!Number.isInteger(body?.slot) || body.slot < 1 || body.slot > 5 ||
      !Number.isInteger(body?.cycle) || body.cycle < 0)
    return error(request,env,'invalid_tree',400);
  if (!env.REWARDED_AD_GROUP_ID)
    return error(request,env,'reward_ad_not_configured',503,'출석 광고 설정이 필요해요.');
  if (body.adGroupId !== env.REWARDED_AD_GROUP_ID || body.eventType !== 'userEarnedReward')
    return error(request,env,'reward_event_invalid',400,'광고를 끝까지 시청한 뒤 다시 시도해 주세요.');
  const tree = await env.DB.prepare('SELECT id,current_cycle,slot FROM treemoa_trees WHERE user_id=? AND slot=?')
    .bind(user.id,body.slot).first();
  if (!tree) return error(request,env,'tree_not_found',404);
  if (tree.current_cycle !== body.cycle)
    return error(request,env,'stale_tree',409,'트리 상태를 새로고침해 주세요.');
  const today = kstDate();
  const cycle = await env.DB.prepare('SELECT attendance_count,last_attendance_date FROM treemoa_cycles WHERE tree_id=? AND cycle=?')
    .bind(tree.id,body.cycle).first();
  if (!cycle) return error(request,env,'cycle_not_found',404);
  if (cycle.last_attendance_date === today)
    return error(request,env,'already_attended',409,'오늘은 이미 출석했어요.');
  if (cycle.attendance_count >= 30)
    return error(request,env,'tree_complete',409,'완성한 트리예요.');
  const nextDay = cycle.attendance_count + 1;
  const adId = randomId(16);
  const adHash = await sha256(user.id + ':' + adId);
  const statements = [
    env.DB.prepare(`INSERT INTO treemoa_ad_completions
      (id,user_id,tree_id,cycle,purpose,provider_receipt_hash,verified_at)
      VALUES (?,?,?,?,'attendance',?,?)`).bind(adId,user.id,tree.id,body.cycle,adHash,new Date().toISOString()),
    env.DB.prepare(`UPDATE treemoa_cycles SET attendance_count=attendance_count+1,last_attendance_date=?
      WHERE tree_id=? AND cycle=? AND attendance_count=? AND (last_attendance_date IS NULL OR last_attendance_date<?)`)
      .bind(today,tree.id,body.cycle,cycle.attendance_count,today),
    env.DB.prepare(`INSERT INTO treemoa_attendance (tree_id,cycle,attendance_date,day_number,ad_completion_id)
      SELECT tree_id,cycle,?,attendance_count,? FROM treemoa_cycles
      WHERE tree_id=? AND cycle=? AND attendance_count=? AND last_attendance_date=?`)
      .bind(today,adId,tree.id,body.cycle,nextDay,today),
    env.DB.prepare('UPDATE treemoa_ad_completions SET consumed_at=? WHERE id=?')
      .bind(new Date().toISOString(),adId),
    env.DB.prepare(`INSERT INTO treemoa_missions (user_id,mission_day,points)
      SELECT ?,30,20 WHERE ?=30 ON CONFLICT(user_id,mission_day) DO NOTHING`)
      .bind(user.id,nextDay),
  ];
  const results = await env.DB.batch(statements);
  if (results[1]?.meta?.changes !== 1 || results[2]?.meta?.changes !== 1)
    return error(request,env,'attendance_conflict',409,'출석 상태가 바뀌었어요. 화면을 새로고침해 주세요.');
  if (nextDay === 1 && tree.slot < 5) {
    const colors = ['green','white','pink','blue','gold'];
    const nextId = randomId(16);
    const color = colors[crypto.getRandomValues(new Uint8Array(1))[0] % colors.length];
    await env.DB.prepare(`INSERT INTO treemoa_trees (id,user_id,slot,color)
      SELECT ?,?,?,? WHERE EXISTS (SELECT 1 FROM treemoa_trees WHERE user_id=? AND slot=?)
      ON CONFLICT(user_id,slot) DO NOTHING`)
      .bind(nextId,user.id,tree.slot+1,color,user.id,tree.slot).run();
    const unlocked = await env.DB.prepare('SELECT id,current_cycle FROM treemoa_trees WHERE user_id=? AND slot=?')
      .bind(user.id,tree.slot+1).first();
    if (unlocked) await env.DB.prepare('INSERT INTO treemoa_cycles (tree_id,cycle) VALUES (?,?) ON CONFLICT(tree_id,cycle) DO NOTHING')
      .bind(unlocked.id,unlocked.current_cycle).run();
  }
  const mission = nextDay === 30 ? {
    day:30, points:20, status:'earned', configured:!!missionPromotionCode(env),
  } : null;
  return json(request,env,{state:await treeState(env,user),attendance:{day:nextDay,date:today},mission});
}
async function saveTreePositions(request, env, user) {
  if (!user.toss_user_key.startsWith('anon:'))
    return error(request, env, 'anonymous_session_required', 403);
  const body = await readJson(request);
  if (!Number.isInteger(body?.slot) || body.slot < 1 || body.slot > 5 ||
      !Number.isInteger(body?.cycle) || body.cycle < 0 ||
      !body.positions || typeof body.positions !== 'object' || Array.isArray(body.positions) ||
      JSON.stringify(body.positions).length > 12000)
    return error(request,env,'invalid_tree_positions',400);
  const tree = await env.DB.prepare('SELECT id,current_cycle FROM treemoa_trees WHERE user_id=? AND slot=?')
    .bind(user.id,body.slot).first();
  if (!tree || tree.current_cycle !== body.cycle)
    return error(request,env,'stale_tree',409);
  const result = await env.DB.prepare('UPDATE treemoa_cycles SET positions_json=? WHERE tree_id=? AND cycle=?')
    .bind(JSON.stringify(body.positions),tree.id,body.cycle).run();
  if (!result.meta?.changes) return error(request,env,'cycle_not_found',404);
  return json(request,env,{ok:true});
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
    if (url.pathname === '/api/trees' && request.method === 'GET') {
      try { return await getTrees(request,env,user); }
      catch (cause) {
        console.error('[treemoa.trees]',cause instanceof Error ? cause.name : 'unknown');
        return error(request,env,'trees_unavailable',503);
      }
    }
    if (url.pathname === '/api/trees' && request.method === 'POST') {
      try { return await createTree(request,env,user); }
      catch (cause) {
        console.error('[treemoa.trees.create]',cause instanceof Error ? cause.name : 'unknown');
        return error(request,env,'tree_create_failed',503);
      }
    }
    if (url.pathname === '/api/trees/attendance' && request.method === 'POST') {
      try { return await attendTree(request,env,user); }
      catch (cause) {
        console.error('[treemoa.attendance]',cause instanceof Error ? cause.name : 'unknown');
        return error(request,env,'attendance_unavailable',503);
      }
    }
    if (url.pathname === '/api/trees/positions' && request.method === 'POST') {
      try { return await saveTreePositions(request,env,user); }
      catch (cause) {
        console.error('[treemoa.trees.positions]',cause instanceof Error ? cause.name : 'unknown');
        return error(request,env,'tree_save_failed',503);
      }
    }
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
