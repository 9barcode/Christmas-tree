import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const target = process.argv[2];
if (!['--local', '--remote'].includes(target)) throw Error('Expected --local or --remote');
function wrangler(args, capture = false) {
  const result = spawnSync('npx', ['--no-install', 'wrangler', ...args], {
    encoding: 'utf8', stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit'
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw Error('Wrangler failed: ' + result.status);
  return result.stdout;
}
const output = wrangler(['d1', 'execute', 'podomoa-db', target, '--json',
  '--command', "SELECT name FROM sqlite_master WHERE type = 'table'"], true);
const responses = JSON.parse(output);
const names = new Set(responses.flatMap(response => response.results ?? []).map(row => row.name));
const suffixes = ['users', 'sessions', 'trees', 'cycles', 'ad_completions',
  'attendance', 'settlements', 'promotion_api_calls', 'd1_migrations'];
const renames = [];
for (const suffix of suffixes) {
  const oldName = 'treemoa_' + suffix;
  const newName = 'tree_' + suffix;
  if (!names.has(oldName)) continue;
  if (names.has(newName)) throw Error('Both tables exist; manual reconciliation required: ' + oldName + ', ' + newName);
  renames.push('ALTER TABLE "' + oldName + '" RENAME TO "' + newName + '";');
}
if (renames.length) {
  const directory = mkdtempSync(join(tmpdir(), 'tree-migration-'));
  try {
    const file = join(directory, 'rename.sql');
    writeFileSync(file, renames.join('\n'));
    wrangler(['d1', 'execute', 'podomoa-db', target, '--file', file]);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
wrangler(['d1', 'migrations', 'apply', 'podomoa-db', target]);
// Report one-time grant outcomes without logging anonymous keys or full user IDs.
const auditTables=JSON.parse(wrangler(['d1','execute','podomoa-db',target,'--json','--command',"SELECT name FROM sqlite_master WHERE name='tree_admin_decoration_grants'"],true));
if(auditTables.some(r=>r.results?.length)){
 const audit=JSON.parse(wrangler(['d1','execute','podomoa-db',target,'--json','--command',"SELECT g.id AS grant_id,substr(g.user_id,-8) AS account_suffix,g.owned_before,g.inserted_count,g.completed_at,(SELECT count(DISTINCT asset_id) FROM tree_factory_items i WHERE i.user_id=g.user_id AND i.sold_at IS NULL) AS owned_types,(SELECT count(*) FROM tree_factory_collection c WHERE c.user_id=g.user_id) AS collection_types FROM tree_admin_decoration_grants g ORDER BY g.id"],true));
 console.log('Decoration grant audit:',JSON.stringify(audit.flatMap(r=>r.results??[])));
}
