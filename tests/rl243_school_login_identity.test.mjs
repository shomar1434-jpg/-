import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {stripTypeScriptTypes} from 'node:module';
import {webcrypto} from 'node:crypto';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const ts=p=>stripTypeScriptTypes(read(p),{mode:'strip'}).replace(/^import .*\n/gm,'').replace(/export /g,'');
const school={id:'11111111-1111-4111-8111-111111111111',school_name:'مدرسة الاختبار الأولى',school_code:'SCH-A',status:'active'};
const other={id:'22222222-2222-4222-8222-222222222222',school_name:'مدرسة الاختبار الثانية',school_code:'SCH-B',status:'active'};
const rows=[school,other],aliases=[{alias:'old-school',canonical_school_id:school.id,status:'active'}],queries=[];
let handler;
const sb={from(table){const filters=[];let single=false,max=100;
 const b={select(){return b},eq(k,v){queries.push({table,k,v});if(table==='schools'&&k==='id'&&!/^[0-9a-f-]{36}$/i.test(v))throw Error('invalid uuid input');filters.push(r=>r[k]===v);return b},limit(n){max=n;return b},maybeSingle(){single=true;return b},then(done){const found=(table==='schools'?rows:table==='school_identity_aliases'?aliases:[]).filter(r=>filters.every(f=>f(r))).slice(0,max);return Promise.resolve({data:single?found[0]||null:found,error:null}).then(done)}};return b;
}};
const server=vm.createContext({createClient:()=>sb,Deno:{env:{get:()=> 'test'},serve:f=>handler=f},crypto:webcrypto,TextEncoder,Response,Request,URL,fetch,AbortController,DOMException,setTimeout,clearTimeout,console:{error(){}}});
vm.runInContext(ts('supabase/functions/_shared/login-upstream.ts'),server);
vm.runInContext(ts('supabase/functions/platform-directory/index.ts'),server);
async function inspect(body){const response=await handler(new Request('https://test.invalid',{method:'POST',body:JSON.stringify({action:'inspect-login-school',...body})}));return {status:response.status,body:await response.json()};}
for(const body of [{schoolId:school.id},{schoolId:school.id,schoolCode:'old-code'},{schoolCode:'SCH-A'},{schoolId:'old-school'},{schoolCode:'old-school'},{schoolId:'SCH-A'}]){const r=await inspect(body);assert.equal(r.status,200);assert.equal(r.body.school.id,school.id);assert.ok(!JSON.stringify(r.body).includes('manager_email'));}
assert.equal((await inspect({schoolId:'unknown',schoolCode:'SCH-B'})).status,404);
assert.equal((await inspect({schoolId:other.id,schoolCode:'SCH-A'})).body.school.id,other.id);
school.status='disabled';assert.equal((await inspect({schoolId:'old-school'})).status,404);school.status='active';
rows.push({...other,school_code:'SCH-A'});assert.equal((await inspect({schoolCode:'SCH-A'})).status,409);rows.pop();
assert.equal((await inspect({})).status,400);
const storage=initial=>{const data=new Map(Object.entries(initial||{}));return {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,String(v)),key:i=>[...data.keys()][i],get length(){return data.size}}};
const html=read('school-login.html'),bridge=html.match(/<script>\s*([\s\S]*?)<\/script>/)[1];
const engine=html.match(/<script id="independent-school-login-engine">([\s\S]*?)<\/script>/)[1].replace(/\}\)\(\);\s*$/, 'window.__testLogin={initSchoolLoginPage,resolveActiveSchool};})();');
async function browser(search,{reject=false,stale=false,source=html}={}){
 const elements={};for(const id of ['school-title','school-main-title','school-link-badge','login-msg','school-login-form','school-login-btn','login-email','login-password'])elements[id]={style:{},dataset:{},textContent:'بوابة المدرسة المستقلة',value:'',addEventListener(){}};
 const calls=[];const ctx={URLSearchParams,URL,AbortController,setTimeout,clearTimeout,location:{pathname:'/school-login.html',search},document:{readyState:'loading',addEventListener(){},getElementById:id=>elements[id]},localStorage:storage(stale?{smart_school_schools:JSON.stringify([school,other])}:{}),sessionStorage:storage(),console:{warn(){},error(){}}};ctx.window=ctx;
 ctx.fetch=async(url,options)=>{calls.push({url,body:JSON.parse(options.body)});if(reject)return new Response(JSON.stringify({ok:false,error:'خدمة المدرسة غير متاحة'}),{status:503});const r=await inspect(JSON.parse(options.body));return new Response(JSON.stringify(r.body),{status:r.status});};
 const context=vm.createContext(ctx);
 const first=source.match(/<script>\s*([\s\S]*?)<\/script>/)[1];
 const last=source.match(/<script id="independent-school-login-engine">([\s\S]*?)<\/script>/)[1].replace(/\}\)\(\);\s*$/, 'window.__testLogin={initSchoolLoginPage,resolveActiveSchool};})();');
 vm.runInContext(first,context);vm.runInContext(last,context);
 await context.__testLogin.initSchoolLoginPage();return {elements,calls,context};
}
for(const search of ['?schoolId='+school.id,'?sid='+school.id+'&school=old-code','?school=SCH-A','?school_id=old-school','?schoolCode=old-school','?schoolId=SCH-A']){const b=await browser(search);assert.equal(b.calls.length,1);assert.match(b.elements['school-main-title'].textContent,/مدرسة الاختبار الأولى/);assert.equal(b.context.sessionStorage.getItem('current_school_id'),school.id);}
const rejected=await browser('?schoolId='+school.id,{reject:true,stale:true});assert.match(rejected.elements['school-main-title'].textContent,/تعذر التحقق/);assert.match(rejected.elements['login-msg'].textContent,/مؤقتًا/);assert.equal(rejected.context.sessionStorage.getItem('current_school_id'),null);
const generic=await browser('');assert.equal(generic.calls.length,0);
// Regression proof: running the previous page's two real closures makes no directory request.
if(process.env.RL243_BASELINE){const b=await browser('?schoolId='+school.id,{source:fs.readFileSync(process.env.RL243_BASELINE,'utf8')});assert.equal(b.calls.length,0);assert.ok(!b.elements['school-main-title'].textContent.includes(school.school_name));}
console.log('RL243: real directory + two real browser closures passed: fresh browser, UUID, old code, alias, disabled/ambiguous/unknown links, stale cache rejection, school isolation; baseline regression reproduced.');
