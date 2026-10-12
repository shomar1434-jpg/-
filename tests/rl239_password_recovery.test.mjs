import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';import {stripTypeScriptTypes} from 'node:module';import {webcrypto} from 'node:crypto';
const code=stripTypeScriptTypes(fs.readFileSync(new URL('../supabase/functions/platform-session/password-recovery.ts',import.meta.url),'utf8'),{mode:'strip'}).replace(/export /g,'');
const ctx=vm.createContext({URL,console:{warn(){}},crypto:webcrypto,Date,Error});vm.runInContext(code+';globalThis.handle=handlePasswordRecovery;globalThis.gate=legacyRecoveryGate',ctx);
const id='12345678-1234-4234-8234-123456789abc',email='teacher@example.test',origin='https://school.test/school-login.html';
function mock(o={}){
 const calls=[],auth=o.existing?{id,email,app_metadata:o.managed?{platform_password_recovery_managed:true}:{}}:null;let current=auth;
 const q=table=>{const filters=[];const b={select(){return b},ilike(k,v){filters.push([k,v]);return b},eq(k,v){filters.push([k,v]);return b},limit(){return b},update(v){calls.push({table,update:v,filters});return b},maybeSingle(){return Promise.resolve({data:o.unknown?null:{id,email:o.conflict?'other@example.test':email},error:null})},then(resolve){return Promise.resolve({data:table==='users'?(o.unknown?[]:[{id,email}]):[],error:null}).then(resolve)}};return b};
 const admin={from:q,auth:{getUser:async t=>({data:{user:t==='valid'?{id,email,app_metadata:{existing:'keep'}}:null},error:null}),admin:{getUserById:async()=>current?{data:{user:current},error:null}:{data:{user:null},error:{status:404}},createUser:async v=>{calls.push({create:v});current={id:v.id,email:v.email};return {data:{user:current},error:null}},updateUserById:async(uid,v)=>{calls.push({uid,updateAuth:v});return {error:o.failUpdate?{}:null}},signOut:async(t,scope)=>{calls.push({signout:scope});return {error:null}}}}};
 const authClient={auth:{resetPasswordForEmail:async(e,v)=>{calls.push({send:e,redirect:v.redirectTo});return {error:o.failSend?{status:429}:null}}}};return {calls,admin,authClient};
}
async function run(action,o={},body={}){const m=mock(o);const request={headers:{get:()=>o.token||''}};const r=await ctx.handle({action,body:{email,redirectTo:origin+'?schoolId=a',password:'new-password-239',...body},request,...m,origin,requestId:'test'});return {...m,r};}
{
 const x=await run('request-password-recovery');assert.equal(x.r.status,200);assert.equal(x.calls[0].create.id,id);assert.equal(x.calls[0].create.email_confirm,false);assert.ok(x.calls[0].create.password.length>50);assert.equal(x.calls[1].send,email);
}
{const x=await run('request-password-recovery',{existing:true});assert.ok(!x.calls.some(c=>c.create));assert.equal(x.r.status,200)}
{const x=await run('request-password-recovery',{unknown:true});assert.ok(!x.calls.some(c=>c.create));assert.equal(x.r.status,200)}
for(const url of ['https://evil.test/school-login.html','https://school.test/other.html']){const x=await run('request-password-recovery',{}, {redirectTo:url});assert.equal(x.r.status,400);assert.equal(x.calls.length,0)}
{const x=await run('request-password-recovery',{failSend:true});assert.equal(x.r.status,429);assert.equal(x.r.body.ok,undefined)}
{const x=await run('complete-password-recovery');assert.equal(x.r.status,401);assert.equal(x.calls.length,0)}
{const x=await run('complete-password-recovery',{token:'valid',conflict:true});assert.equal(x.r.status,409);assert.equal(x.calls.length,0)}
{const x=await run('complete-password-recovery',{token:'valid'});assert.equal(x.r.status,200);assert.equal(x.calls[0].uid,id);assert.equal(x.calls[0].updateAuth.app_metadata.platform_password_recovery_managed,true);assert.equal(x.calls[0].updateAuth.app_metadata.existing,'keep');assert.equal(x.calls[1].table,'platform_sessions');assert.ok(x.calls[1].filters.some(([k,v])=>k==='user_id'&&v===id));assert.equal(x.calls[2].signout,'global');assert.ok(!x.calls.some(c=>c.table==='users'))}
{const x=await run('complete-password-recovery',{token:'valid',failUpdate:true});assert.equal(x.r.status,502);assert.equal(x.calls.length,1)}
for(const managed of [true,false]){const m=mock({existing:true,managed});assert.equal(await ctx.gate(m.admin,[{id}],null),managed);assert.equal(await ctx.gate(m.admin,[{id}],{id}),false)}
const session=fs.readFileSync(new URL('../supabase/functions/platform-session/index.ts',import.meta.url),'utf8');new vm.Script(stripTypeScriptTypes(session,{mode:'strip'}).replace(/^import .*\n/gm,''));
const yaml=fs.readFileSync(new URL('../.github/workflows/deploy-supabase-functions.yml',import.meta.url),'utf8');assert.match(yaml,/supabase\/functions\/platform-session\/\*\*/);assert.match(yaml,/supabase functions deploy platform-session/);assert.match(yaml,/supabase functions deploy \\/);
console.log('RL239 recovery provisioning, redirects, unknown accounts, rate limit, token validation, password authority and session revocation tests passed.');
