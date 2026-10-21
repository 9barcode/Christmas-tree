import {handleBM} from './bm.js';
import {handleMissions} from './missions.js';
import { publicAdConfig } from './config.js';
// Mission writes require a verified Toss anonymous session and server-derived attendance.
const requiredTables = [
  'tree_bm_slots', 'tree_bm_requests', 'tree_bm_credits', 'tree_bm_payments',
  'tree_users', 'tree_sessions', 'tree_trees', 'tree_cycles',
  'tree_ad_completions', 'tree_attendance', 'tree_settlements',
  'tree_promotion_api_calls',
  'tree_mission_progress', 'tree_promotion_missions', 'tree_mission_payments', 'tree_mission_api_calls',
];
export default {
  async fetch(request, env, context) {
    const bmResponse = await handleBM(request, env);
    if (bmResponse) return bmResponse;
    const missionResponse = await handleMissions(request, env, context);
    if (missionResponse) return missionResponse;
    const path = new URL(request.url).pathname;
    if (path === '/api/config') {
      const headers = { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store', Allow: 'GET, OPTIONS' };
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
      if (request.method !== 'GET') return Response.json({error: 'method_not_allowed'}, {status: 405, headers});
      return Response.json({ads: publicAdConfig(env)}, {headers});
    }
    if (path !== '/api/health') return Response.json({error: 'not_found'}, {status: 404});
    if (request.method !== 'GET') return Response.json({error: 'method_not_allowed'}, {status: 405, headers: {Allow: 'GET'}});
    try {
      const {results} = await env.DB.prepare(
        `SELECT name FROM sqlite_master WHERE type = 'table' AND name IN (${requiredTables.map(() => '?').join(',')})`
      ).bind(...requiredTables).all();
      const present = new Set(results.map(row => row.name));
      const ready = requiredTables.every(name => present.has(name));
      return Response.json({service: 'treemoa', database: ready ? 'ready' : 'migration_required'},
        {status: ready ? 200 : 503, headers: {'Cache-Control': 'no-store'}});
    } catch (error) {
      console.error('treemoa database health check failed', error);
      return Response.json({service: 'treemoa', database: 'unavailable'},
        {status: 503, headers: {'Cache-Control': 'no-store'}});
    }
  },
};
