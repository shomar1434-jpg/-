const fs = require('fs');
const vm = require('vm');
const path = require('path');

const root = path.resolve(__dirname, '..');
const operational = fs.readFileSync(path.join(root, 'interactive_operational_plan.html'), 'utf8');
const nafs = fs.readFileSync(path.join(root, 'nafs_results_analysis.html'), 'utf8');

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`missing function ${name}`);
  const bodyStart = source.indexOf('{', start);
  let depth = 0;
  let quote = '';
  let escaped = false;
  for (let i = bodyStart; i < source.length; i += 1) {
    const char = source[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '"' || char === "'" || char === '`') { quote = char; continue; }
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`unterminated function ${name}`);
}

function storage(values = {}) {
  return { getItem(key) { return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : null; } };
}

function context({ cloud = '', tab = '', local = '', query = '' } = {}) {
  return {
    window: { PlatformCloudSession: { schoolId: () => cloud } },
    sessionStorage: storage({ platform_tab_session_school_id_v1: tab }),
    localStorage: storage({ active_school_id: local }),
    location: { search: query ? `?schoolId=${query}` : '' },
    URLSearchParams,
    String,
    Error
  };
}

function evaluateFunction(source, name, ctx) {
  const sandbox = context(ctx);
  vm.createContext(sandbox);
  vm.runInContext(`${extractFunction(source, name)}; result=${name}();`, sandbox);
  return sandbox.result;
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) throw new Error(`${label}: expected ${expected}, got ${actual}`);
}

const A = 'school-a';
const B = 'school-b';

assertEqual(evaluateFunction(nafs, 'nafsSchoolId', { tab: B, local: A }), B, 'Nafis tab identity must beat stale local identity');
assertEqual(evaluateFunction(nafs, 'nafsSchoolId', { cloud: B, tab: B, local: A }), B, 'Nafis cloud identity must remain authoritative');
assertEqual(evaluateFunction(nafs, 'nafsSchoolId', { query: B, local: A }), B, 'Nafis link identity must beat stale local identity');
assertEqual(evaluateFunction(nafs, 'nafsSchoolId', {}), '', 'Nafis must not invent a school identity');

assertEqual(evaluateFunction(operational, 'operationalPlanSchoolId', { tab: B, local: A }), B, 'Operational plan tab identity must beat stale local identity');
assertEqual(evaluateFunction(operational, 'operationalPlanSchoolId', { query: B, local: A }), B, 'Operational plan link identity must beat stale local identity');
assertEqual(evaluateFunction(operational, 'operationalPlanSchoolId', {}), '', 'Operational plan must not invent a school identity');

const opIdFunction = extractFunction(operational, 'operationalPlanSchoolId');
const guardFunction = extractFunction(operational, 'requireOperationalPlanScope');

function guardScenario({ openedAs, cloud = '', tab = '', local = '' }) {
  const sandbox = context({ cloud, tab, local });
  vm.createContext(sandbox);
  vm.runInContext(`${opIdFunction}\nconst OPERATIONAL_PLAN_SCHOOL_ID=${JSON.stringify(openedAs)};\nconst ACTIVE_PLAN_KEY=OPERATIONAL_PLAN_SCHOOL_ID?'key':'';\n${guardFunction}\ntry{result={ok:true,value:requireOperationalPlanScope()}}catch(error){result={ok:false,message:error.message}}`, sandbox);
  return sandbox.result;
}

assertEqual(guardScenario({ openedAs: B, tab: B, local: A }).ok, true, 'matching tab scope must save');
assertEqual(guardScenario({ openedAs: B, cloud: A, tab: B, local: A }).ok, false, 'cloud mismatch must block save');
assertEqual(guardScenario({ openedAs: '', local: '' }).ok, false, 'missing school scope must block save');

console.log(JSON.stringify({ ok: true, scenarios: 10, schools: [A, B] }, null, 2));
