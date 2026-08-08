(function(){
'use strict';
const VERSION='1.0.0',TIMEOUT=45000;
const config={
 base:()=> (localStorage.getItem('smartSchoolSupabaseUrl')||'https://cijhgvbtrvmmlcssgxht.supabase.co').replace(/\/$/,'')+'/functions/v1/platform-core',
 anon:()=>localStorage.getItem('smartSchoolSupabaseAnonKey')||'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpamhndmJ0cnZtbWxjc3NneGh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2OTY4MzUsImV4cCI6MjA5NDI3MjgzNX0.1sbfDvL1V12kj9oVcYJqYhj8NPuLpYjId7CO9QGj3bM',
 token:()=>localStorage.getItem('platform_file_session_token')||''
};
async function ensure(){if(config.token())return config.token();if(window.PlatformCloudSession?.ensure){await window.PlatformCloudSession.ensure();if(config.token())return config.token()}throw new Error('الجلسة السحابية غير متاحة. سجّل الخروج ثم ادخل مجددًا.');}
async function request(action,body,method='POST'){
 await ensure();const c=new AbortController(),t=setTimeout(()=>c.abort(),TIMEOUT);
 try{const headers={apikey:config.anon(),'x-platform-session':config.token(),'x-client-version':VERSION};let payload;
  if(method!=='GET'){headers['content-type']='application/json';payload=JSON.stringify(body||{})}
  const r=await fetch(`${config.base()}?action=${encodeURIComponent(action)}`,{method,headers,body:payload,signal:c.signal});
  const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||`فشلت عملية Platform Core (${r.status})`);return j;
 }catch(e){throw e?.name==='AbortError'?new Error('انتهت مهلة الاتصال بمحرك المنصة.'):e}finally{clearTimeout(t)}
}
const cache={bootstrap:null,at:0};
async function bootstrap(force=false){if(!force&&cache.bootstrap&&Date.now()-cache.at<30000)return cache.bootstrap;const data=await request('bootstrap',{},'GET');cache.bootstrap=data;cache.at=Date.now();window.dispatchEvent(new CustomEvent('platformcore:ready',{detail:data}));return data;}
const api={
 VERSION,request,bootstrap,
 health:()=>request('health',{},'GET'),
 registry:(moduleKey,recordType)=>request('registry',{moduleKey,recordType}),
 myAssignments:()=>request('my-assignments',{}),
 workspace:taskId=>request('workspace',{taskId}),
 emitRecordEvent:payload=>request('record-event',payload),
 dashboard:(filters={})=>request('dashboard',{filters}),
 markNotificationRead:id=>request('mark-notification-read',{id}),
 invalidate(){cache.bootstrap=null;cache.at=0},
 openAssignment(taskId){location.href='central_task_center.html?mode=assignee&task_id='+encodeURIComponent(taskId)}
};
window.PlatformCore=api;
window.addEventListener('cloudtasks:changed',()=>api.invalidate());
})();
