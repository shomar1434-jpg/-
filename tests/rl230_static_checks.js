const fs = require('fs');
const vm = require('vm');
const path = require('path');

const root = path.resolve(__dirname, '..');
const operational = fs.readFileSync(path.join(root, 'interactive_operational_plan.html'), 'utf8');
const nafs = fs.readFileSync(path.join(root, 'nafs_results_analysis.html'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function checkInlineScripts(html, label) {
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
    .filter(match => match[1].trim());
  scripts.forEach((match, index) => {
    try { new vm.Script(match[1], { filename: `${label}:inline-${index + 1}.js` }); }
    catch (error) { throw new Error(`${label} inline script ${index + 1}: ${error.message}`); }
  });
  return scripts.length;
}

assert(!operational.includes('OPERATIONAL_PLAN_SCHOOL_ID||"unscoped-denied"'), 'unsafe unscoped plan key still exists');
assert(operational.includes('function requireOperationalPlanScope()'), 'operational plan scope guard is missing');
assert(operational.includes('requireOperationalPlanScope();\n    setSaveStatus("saving"'), 'saveAll is not protected by the scope guard');
assert(operational.includes('if(!ACTIVE_PLAN_KEY){'), 'unscoped startup is not blocked');

assert(nafs.includes('function validateNafsSavedPayload(saved)'), 'Nafis payload validation is missing');
assert(nafs.includes("window.addEventListener('unhandledrejection'"), 'Nafis startup rejection handler is missing');
assert(nafs.includes("document.getElementById('view-' + viewId)||document.getElementById('view-pdfInput')"), 'Nafis safe view fallback is missing');
assert(nafs.indexOf("sessionStorage.getItem('platform_tab_session_school_id_v1')") < nafs.indexOf("localStorage.getItem('active_school_id')"), 'Nafis does not prioritize the tab-scoped school identity');

const operationalScripts = checkInlineScripts(operational, 'interactive_operational_plan.html');
const nafsScripts = checkInlineScripts(nafs, 'nafs_results_analysis.html');

console.log(JSON.stringify({
  ok: true,
  operationalInlineScripts: operationalScripts,
  nafsInlineScripts: nafsScripts,
  checks: 8
}, null, 2));
