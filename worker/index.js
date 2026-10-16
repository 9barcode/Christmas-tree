// No write endpoints are exposed until Toss authentication and ad verification exist.
const requiredTables = [
  'treemoa_users', 'treemoa_sessions', 'treemoa_trees', 'treemoa_cycles',
  'treemoa_ad_completions', 'treemoa_attendance', 'treemoa_settlements',
  'treemoa_promotion_api_calls',
];
export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
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
