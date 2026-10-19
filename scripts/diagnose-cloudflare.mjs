import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const token = process.env.CLOUDFLARE_API_TOKEN;
const account = process.env.CLOUDFLARE_ACCOUNT_ID;
const directory = process.env.DIAGNOSTICS_DIR;
if (!token || !account || !directory) throw Error('Missing Cloudflare credentials or diagnostics directory');
const endpoints = [
  '/workers/services/treemoa',
  '/workers/services/treemoa/environments/production/bindings',
  '/workers/services/treemoa/environments/production/routes?show_zonename=true',
  '/workers/domains/records?page=0&per_page=5&service=treemoa&environment=production',
  '/workers/services/treemoa/environments/production/subdomain',
  '/workers/services/treemoa/environments/production',
  '/workers/scripts/treemoa/schedules',
];
function redact(value) {
  let text = String(value ?? '');
  for (const secret of [token, account]) text = text.split(secret).join('[REDACTED]');
  return text.replace(/Bearer\s+[^\s"',}]+/gi, 'Bearer [REDACTED]').slice(0, 1000);
}
mkdirSync(directory, { recursive: true });
const results = [];
for (const endpoint of endpoints) {
  const record = { method: 'GET', path: '/accounts/[REDACTED]' + endpoint };
  try {
    const response = await fetch('https://api.cloudflare.com/client/v4/accounts/' + encodeURIComponent(account) + endpoint, {
      method: 'GET',
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
      signal: AbortSignal.timeout(15000),
      redirect: 'error',
    });
    record.status = response.status;
    record.ray = redact(response.headers.get('cf-ray'));
    // Never log response results: bindings and other configuration may contain secrets.
    const payload = await response.json().catch(() => null);
    record.success = payload?.success ?? response.ok;
    record.errors = Array.isArray(payload?.errors) ? payload.errors.map(error => ({
      code: typeof error.code === 'number' ? error.code : null,
      message: redact(error.message),
    })) : [];
  } catch (error) {
    record.status = null;
    record.error = redact(error.message);
  }
  results.push(record);
  console.log(JSON.stringify(record));
  // Persist every completed request, including when a later request times out.
  writeFileSync(join(directory, 'cloudflare-api-checks.json'), JSON.stringify(results, null, 2) + '\n');
}
if (process.env.GITHUB_STEP_SUMMARY) {
  const lines = ['### Cloudflare API diagnostics', '', '| GET path | HTTP status | Error codes |',
    '| --- | --- | --- |', ...results.map(result =>
      '| ' + result.path + ' | ' + (result.status ?? 'network error') + ' | ' +
      (result.errors ?? []).map(error => error.code).join(', ') + ' |'), ''];
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join('\n'));
}
// Read-only diagnosis never hides the original deployment failure.
