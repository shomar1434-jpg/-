import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../platform-cloud-session.js',import.meta.url),'utf8');

class StorageMock{
  constructor(seed={}){this.data={...seed}}
  getItem(k){return Object.prototype.hasOwnProperty.call(this.data,k)?String(this.data[k]):null}
  setItem(k,v){this.data[k]=String(v)}
  removeItem(k){delete this.data[k]}
  key(i){return Object.keys(this.data)[i]??null}
  get length(){return Object.keys(this.data).length}
}

async function run({response,requiredPath='/deputy_weekly_teacher_followup.html',recentRole='agent'}){
  const future=new Date(Date.now()+60*60*1000).toISOString();
  const sessionStorage=new StorageMock({
    platform_tab_session_token_v1:'fresh-tab-token',
    platform_tab_session_expires_at_v1:future,
    platform_tab_session_user_v1:'agent-user',
    platform_tab_session_school_v1:'school-52',
    smart_school_tab_school_v1:'school-52',
    smart_school_tab_role_v1:'agent',
    platform_verified_school_context_v1:JSON.stringify({schoolId:'school-52',userId:'agent-user',role:recentRole,verifiedAt:Date.now()})
  });
  const localStorage=new StorageMock();
  const listeners={};
  const replaced=[];
  const document={
    readyState:'loading',visibilityState:'visible',hidden:false,
    documentElement:{dataset:{},style:{},classList:{add(){}}},
    head:{appendChild(){}},body:{appendChild(){}},
    createElement(){return {id:'',textContent:'',style:{},classList:{add(){}}}},
    addEventListener(type,fn){listeners[type]=fn},
  };
  const location={pathname:requiredPath,search:'',href:'https://example.test'+requiredPath,replace(v){replaced.push(v)}};
  const context={
    window:null,Storage:StorageMock,sessionStorage,localStorage,document,location,
    navigator:{maxTouchPoints:0},CustomEvent:class{constructor(type,init){this.type=type;this.detail=init?.detail}},
    URLSearchParams,URL,Date,JSON,Math,Promise,Error,TypeError,Object,String,Boolean,Number,Array,Set,Map,
    console:{warn(){},error(){},log(){}},queueMicrotask(fn){Promise.resolve().then(fn)},
    setInterval(){return 1},clearInterval(){},setTimeout,clearTimeout,
    fetch:async()=>({ok:response.ok,status:response.status,json:async()=>response.body||{}}),
  };
  context.window=context;
  context.window.addEventListener=()=>{};
  context.window.dispatchEvent=()=>true;
  context.window.top=context.window;
  context.window.parent=context.window;
  vm.runInNewContext(source,context,{filename:'platform-cloud-session.js'});
  assert.equal(sessionStorage.getItem('platform_tab_session_expires_v1'),future,'legacy expiry key is migrated in-tab');
  await listeners.DOMContentLoaded?.();
  await new Promise(resolve=>setTimeout(resolve,10));
  return {context,replaced};
}

{
  const {context,replaced}=await run({response:{ok:false,status:401,body:{code:'SESSION_INVALID',error:'invalid'}}});
  assert.deepEqual(replaced,[],'a recoverable failure after a recent verified login must not eject the agent');
  assert.equal(context.document.documentElement.dataset.platformRoleVerified,'1');
  assert.equal(context.document.documentElement.dataset.platformSessionDegraded,'1');
}

{
  const memberships={current:{schoolId:'school-52',userId:'agent-user',role:'agent'},memberships:[{schoolId:'school-52',userId:'agent-user',role:'agent',status:'active'}]};
  const {context,replaced}=await run({response:{ok:true,status:200,body:memberships}});
  assert.deepEqual(replaced,[],'an active agent remains on teacher follow-up');
  assert.equal(context.document.documentElement.dataset.platformRoleVerified,'1');
}

{
  const memberships={current:{schoolId:'school-52',userId:'agent-user',role:'teacher'},memberships:[{schoolId:'school-52',userId:'agent-user',role:'teacher',status:'active'}]};
  const {replaced}=await run({response:{ok:true,status:200,body:memberships},recentRole:'teacher'});
  assert.ok(replaced.length===1,'a definitive wrong-role result is still denied');
}

console.log('RL234 agent follow-up session tests passed');
