/**
 * E2E live test suite — uses curl + cookies.
 */
const { execSync } = require('child_process');

const BASE = 'http://localhost:3000';
const COOKIE_JAR = '/tmp/omnivote-e2e-cookies.txt';

let passed = 0;
let failed = 0;
const results: string[] = [];

function api(method: string, path: string, body?: object, label = '') {
  const curlArgs = [
    `curl -s -w '\\n__HTTP_CODE__:%{http_code}'`,
    `-X ${method}`,
    `-b ${COOKIE_JAR}`, `-c ${COOKIE_JAR}`,
    `-H 'Content-Type: application/json'`,
  ];
  if (body) curlArgs.push(`-d '${JSON.stringify(body)}'`);
  curlArgs.push(`'${BASE}${path}'`);
  try {
    const raw = execSync(curlArgs.join(' '), { timeout: 15000, encoding: 'utf8' }).trim();
    const parts = raw.split('\n__HTTP_CODE__:');
    const status = parseInt(parts[1] || '0', 10);
    let data: any = {};
    try { data = JSON.parse(parts[0]); } catch {}
    return { status, data };
  } catch (e: any) {
    return { status: 0, data: { error: e.message } };
  }
}

function check(name: string, condition: boolean, detail = '') {
  if (condition) { passed++; results.push(`  ✅ ${name}${detail ? ` — ${detail}` : ''}`); }
  else { failed++; results.push(`  ❌ ${name}${detail ? ` — ${detail}` : ''}`); }
}

function section(title: string) { console.log(`\n── ${title} --`); }

function run() {
  // Clear cookies
  execSync(`rm -f ${COOKIE_JAR}`);

  console.log('╔══════════════════════════════════════════╗');
  console.log('  OmniVote E2E Live Test Suite');
  console.log('╚══════════════════════════════════════════╝');

  // ── 1. Auth ──
  section('1. Authentication');
  const login = api('POST', '/api/auth', { email: 'platform-admin@omnivote.ng', password: 'admin123' });
  const saTenantId = login.data?.user?.tenantId || '';
  check('SA login', login.status === 200 && !!login.data.user, `status=${login.status}`);
  check('SA role is SUPER_ADMIN', login.data.user?.role === 'SUPER_ADMIN', login.data.user?.role);
  check('SA has tenantId', !!saTenantId, saTenantId.slice(0, 12));

  const badLogin = api('POST', '/api/auth', { email: 'platform-admin@omnivote.ng', password: 'wrong' });
  check('Bad password → 401', badLogin.status === 401, `status=${badLogin.status}`);

  // ── 2. Dashboard (Critical Fix) ──
  section('2. Dashboard API (New Implementation)');
  const dash = api('GET', `/api/dashboard?tenantId=${saTenantId}`);
  check('Dashboard returns 200', dash.status === 200, `status=${dash.status}`);
  check('Has kpis object', !!dash.data.kpis, `keys: ${Object.keys(dash.data.kpis || {}).join(',')}`);
  check('KPI: totalAgents', typeof dash.data.kpis?.totalAgents === 'number', `val=${dash.data.kpis?.totalAgents}`);
  check('KPI: onlineAgents', typeof dash.data.kpis?.onlineAgents === 'number', `val=${dash.data.kpis?.onlineAgents}`);
  check('KPI: totalIncidents', typeof dash.data.kpis?.totalIncidents === 'number', `val=${dash.data.kpis?.totalIncidents}`);
  check('KPI: unreadAlerts', typeof dash.data.kpis?.unreadAlerts === 'number', `val=${dash.data.kpis?.unreadAlerts}`);
  check('KPI: criticalIncidents', typeof dash.data.kpis?.criticalIncidents === 'number', `val=${dash.data.kpis?.criticalIncidents}`);
  check('Has electionInfo', !!dash.data.electionInfo, `tier=${dash.data.electionInfo?.tier}`);
  check('Has election stats', !!dash.data.election, `PUs=${dash.data.election?.totalPollingUnits}`);
  check('Has pollingUnits array', Array.isArray(dash.data.pollingUnits), `count=${dash.data.pollingUnits?.length}`);
  check('Has stateAgg', !!dash.data.election?.stateAgg, `states=${Object.keys(dash.data.election?.stateAgg || {}).length}`);
  check('Has trends', !!dash.data.trends, `onlineAgents=${dash.data.trends?.onlineAgents?.value}`);
  check('mapBounds field exists', 'mapBounds' in dash.data, dash.data.mapBounds ? 'configured' : 'null');

  // ── 3. Tenant Isolation ──
  section('3. Tenant Isolation');
  const tenants = api('GET', '/api/tenants');
  const tenantList = tenants.data.tenants || [];
  check('SA lists tenants', tenants.status === 200 && tenantList.length >= 2, `${tenantList.length} tenants`);

  const otherTenant = tenantList.find((t: any) => t.id !== saTenantId);
  if (otherTenant) {
    const cross = api('GET', `/api/incidents?tenantId=${otherTenant.id}`);
    check('SA cross-tenant read OK', cross.status === 200, `status=${cross.status}, incidents=${cross.data.incidents?.length}`);
  }

  // Login as tenant admin
  execSync(`rm -f ${COOKIE_JAR}`);
  const taLogin = api('POST', '/api/auth', { email: 'admin@lagos-state.omnivote.ng', password: 'admin123' });
  const taTenantId = taLogin.data?.user?.tenantId || '';
  check('TA login', taLogin.status === 200 && !!taLogin.data.user, `status=${taLogin.status}`);

  if (taTenantId && saTenantId) {
    const own = api('GET', `/api/incidents?tenantId=${taTenantId}`);
    check('TA reads own tenant', own.status === 200, `status=${own.status}`);

    const blocked = api('GET', `/api/incidents?tenantId=${saTenantId}`);
    check('TA blocked from SA tenant', blocked.status === 403, `status=${blocked.status}`);
  }

  // ── 4. Scope Data ──
  section('4. Tenant Scopes');
  execSync(`rm -f ${COOKIE_JAR}`);
  api('POST', '/api/auth', { email: 'platform-admin@omnivote.ng', password: 'admin123' });
  const tenantsAgain = api('GET', '/api/tenants');
  const tList = tenantsAgain.data.tenants || [];
  const withScope = tList.filter((t: any) => t.scope).length;
  check('Tenants have scope field', withScope >= 2, `${withScope}/${tList.length} tenants`);
  const scopeTypes = [...new Set(tList.map((t: any) => t.scope).filter(Boolean))];
  check('Multiple scope types present', scopeTypes.length >= 2, scopeTypes.join(', '));

  // ── 5. Security ──
  section('5. Security (Role Enforcement)');
  execSync(`rm -f ${COOKIE_JAR}`);
  const faLogin = api('POST', '/api/auth', { email: 'tunde@lagos-island.omnivote.ng', password: 'admin123' });
  const faTid = faLogin.data?.user?.tenantId || '';

  if (faTid) {
    const faSettings = api('GET', `/api/tenant-settings?tenantId=${faTid}`);
    check('FA blocked from tenant-settings', faSettings.status === 403, `status=${faSettings.status}`);

    const faTenants = api('GET', '/api/tenants');
    check('FA blocked from tenants list', faTenants.status === 403, `status=${faTenants.status}`);

    const faDash = api('GET', `/api/dashboard?tenantId=${faTid}`);
    check('FA can access dashboard', faDash.status === 200, `status=${faDash.status}`);

    const noTid = api('GET', '/api/incidents');
    check('Missing tenantId → 400', noTid.status === 400, `status=${noTid.status}`);
  }

  // ── 6. Route Health ──
  section('6. Route Health (SA)');
  execSync(`rm -f ${COOKIE_JAR}`);
  api('POST', '/api/auth', { email: 'platform-admin@omnivote.ng', password: 'admin123' });
  const saTid = saTenantId;
  const routes = [
    `/api/alerts?tenantId=${saTid}`,
    `/api/geofence?tenantId=${saTid}`,
    `/api/reports?all=true&tenantId=${saTid}`,
    `/api/security?tenantId=${saTid}`,
    `/api/situation-room?tenantId=${saTid}`,
    `/api/pvt?tenantId=${saTid}`,
    `/api/evidence?tenantId=${saTid}`,
    `/api/engagement?tenantId=${saTid}`,
    `/api/honeypot?tenantId=${saTid}`,
    `/api/flashpoint?tenantId=${saTid}`,
    `/api/osint?tenantId=${saTid}`,
    `/api/voter-suppression?tenantId=${saTid}`,
    `/api/results?tenantId=${saTid}`,
    `/api/campaigns?tenantId=${saTid}`,
  ];
  for (const r of routes) {
    const name = r.split('?')[0].replace('/api/', '');
    const res = api('GET', r);
    check(`${name}`, res.status === 200, `status=${res.status}`);
  }

  // ── Summary ──
  console.log('\n╔══════════════════════════════════════════╗');
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log('╚══════════════════════════════════════════╝\n');
  for (const r of results) console.log(r);
  process.exit(failed > 0 ? 1 : 0);
}

run();