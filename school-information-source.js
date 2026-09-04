(function(){
'use strict';
if(window.SchoolInformationSource&&String(window.SchoolInformationSource.VERSION||'')==='10.0.0-live-commit-broadcast')return;
const VERSION='10.0.0-live-commit-broadcast';
const SUPABASE_URL=(localStorage.getItem('smartSchoolSupabaseUrl')||'https://cijhgvbtrvmmlcssgxht.supabase.co').replace(/\/$/,'');
const DEFAULT_SUPABASE_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpamhndmJ0cnZtbWxjc3NneGh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2OTY4MzUsImV4cCI6MjA5NDI3MjgzNX0.1sbfDvL1V12kj9oVcYJqYhj8NPuLpYjId7CO9QGj3bM';
const API_KEY=localStorage.getItem('smartSchoolSupabaseAnonKey')||DEFAULT_SUPABASE_KEY;
const safe=v=>String(v==null?'':v).trim();
const lower=v=>safe(v).toLowerCase();
const state={school:null,students:[],staff:[],updatedAt:'',schoolId:'',accessMode:'',academicYear:'1448',loading:null,cacheHydrated:false,revalidating:null};
const CACHE_DB='smart_school_information_cache_v1';
const CACHE_STORE='snapshots';
const CACHE_SCHEMA_VERSION=1;
const CACHE_MAX_AGE_MS=5*60*1000;
const UPDATE_CHANNEL='school-information-updates-v2';
const UPDATE_KEY='school_information_global_update_v2';
let updateChannel=null;
try{if('BroadcastChannel' in window)updateChannel=new BroadcastChannel(UPDATE_CHANNEL)}catch(_e){}
function publishCrossPageUpdate(detail){
 const payload={...(detail||{}),schoolId:safe(detail?.schoolId||targetSchoolId()),academicYear:safe(detail?.academicYear||currentAcademicYear()),at:Date.now()};
 try{updateChannel?.postMessage(payload)}catch(_e){}
 try{localStorage.setItem(UPDATE_KEY,JSON.stringify(payload))}catch(_e){}
 return payload;
}
function acceptsUpdate(detail){const sid=safe(detail?.schoolId),year=safe(detail?.academicYear);return !!sid&&sid===safe(targetSchoolId())&&(!year||year===safe(currentAcademicYear()))}
async function consumeCrossPageUpdate(detail){
 if(!acceptsUpdate(detail))return;
 state.updatedAt='1970-01-01T00:00:00.000Z';state.cacheHydrated=false;
 try{await refresh()}catch(e){console.warn('[school-information cross-page refresh]',e)}
}
try{if(updateChannel)updateChannel.onmessage=e=>consumeCrossPageUpdate(e.data||{})}catch(_e){}
window.addEventListener('storage',e=>{if(e.key!==UPDATE_KEY||!e.newValue)return;try{consumeCrossPageUpdate(JSON.parse(e.newValue))}catch(_e){}});
function cacheIdentity(sid,year){return safe(sid)+'::'+safe(year||'1448')}
function openCacheDb(){
 return new Promise((resolve,reject)=>{
   if(!('indexedDB' in window))return resolve(null);
   const req=indexedDB.open(CACHE_DB,CACHE_SCHEMA_VERSION);
   req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(CACHE_STORE))db.createObjectStore(CACHE_STORE,{keyPath:'key'})};
   req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
 });
}
async function readPersistentCache(sid,year){
 const key=cacheIdentity(sid,year);
 try{
   const db=await openCacheDb();if(!db)return null;
   return await new Promise((resolve,reject)=>{
     const tx=db.transaction(CACHE_STORE,'readonly'),r=tx.objectStore(CACHE_STORE).get(key);
     r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>reject(r.error);
   });
 }catch(e){console.warn('[school-information-cache read]',e);return null}
}
async function writePersistentCache(snapshot){
 try{
   if(!snapshot?.schoolId)return false;
   const db=await openCacheDb();if(!db)return false;
   const row={key:cacheIdentity(snapshot.schoolId,snapshot.academicYear),schoolId:snapshot.schoolId,academicYear:snapshot.academicYear,
     school:snapshot.school||null,students:Array.isArray(snapshot.students)?snapshot.students:[],staff:Array.isArray(snapshot.staff)?snapshot.staff:[],
     updatedAt:snapshot.updatedAt||new Date().toISOString(),cachedAt:new Date().toISOString(),accessMode:snapshot.accessMode||''};
   await new Promise((resolve,reject)=>{
     const tx=db.transaction(CACHE_STORE,'readwrite');tx.objectStore(CACHE_STORE).put(row);
     tx.oncomplete=()=>resolve(true);tx.onerror=()=>reject(tx.error);
   });
   try{localStorage.setItem('school_information_cache_version:'+snapshot.schoolId+':'+snapshot.academicYear,row.updatedAt)}catch(_){}
   return true;
 }catch(e){console.warn('[school-information-cache write]',e);return false}
}
function applySnapshotData(data,academicYear,fromCache=false){
 const sid=safe(data.schoolId||data.school?.id||targetSchoolId());
 state.school=data.school||null;
 state.students=(Array.isArray(data.students)?data.students:[]).filter(x=>safe(x.student_status)!=='محذوف'&&(!sid||safe(x.school_id||sid)===sid));
 state.staff=normalizeStaff(data.staff,sid);
 state.schoolId=sid;
 state.accessMode=safe(data.accessMode||(systemAdminRequested()?'system_admin':'school_manager'));
 state.academicYear=academicYear;
 state.updatedAt=safe(data.updatedAt||data.cachedAt||new Date().toISOString());
 state.cacheHydrated=true;
 if(!fromCache){
   const snap=getSnapshotSync();
   writePersistentCache(snap);
   try{window.dispatchEvent(new CustomEvent('school-information-updated',{detail:{schoolId:sid,academicYear,source:'cloud'}}))}catch(_){}
 }
 return getSnapshotSync();
}
async function hydratePersistentCache(){
 const sid=targetSchoolId(),year=currentAcademicYear();
 if(!sid)return false;
 if(state.cacheHydrated&&state.schoolId===sid&&state.academicYear===year)return !!state.updatedAt;
 const cached=await readPersistentCache(sid,year);
 if(!cached)return false;
 applySnapshotData(cached,year,true);
 try{window.dispatchEvent(new CustomEvent('school-information-ready',{detail:{schoolId:sid,academicYear:year,source:'cache'}}))}catch(_){}
 return true;
}
function cacheIsFresh(){
 const t=Date.parse(state.updatedAt||'');return !!t&&(Date.now()-t)<CACHE_MAX_AGE_MS;
}


function systemAdminRequested(){
 try{
  const q=new URLSearchParams(location.search||'');
  return q.get('systemAdmin')==='1'||q.get('systemAdminReturn')==='1'||
    !!window.__VERIFIED_SYSTEM_ADMIN_CONTEXT__?.verified;
 }catch(_){return false}
}
function currentAcademicYear(){
 try{
  const q=new URLSearchParams(location.search||'');
  return safe(q.get('academicYear')||document.getElementById('academicYear')?.value||
    localStorage.getItem('school_info_academic_year')||'1448');
 }catch(_){return '1448'}
}
function targetSchoolId(){
 const q=new URLSearchParams(location.search||'');
 if(systemAdminRequested()){
   return safe(q.get('schoolId')||q.get('school_id')||sessionStorage.getItem('system_admin_school_info_target_v1')||'');
 }
 const cloud=safe(window.PlatformCloudSession?.schoolId?.()||'');
 const tab=safe(sessionStorage.getItem('smart_school_tab_school_v1')||sessionStorage.getItem('current_school_id')||'');
 const explicit=safe(q.get('schoolId')||q.get('school_id')||'');
 const sid=cloud||tab;
 if(explicit&&sid&&explicit!==sid)throw new Error('SCHOOL_INFORMATION_SCHOOL_CONTEXT_MISMATCH');
 return sid||explicit;
}
function activeCurrentUser(u){
 const st=lower(u?.status||u?.member_status||u?.user_status||'');
 if(!st||st==='active'||st==='نشط')return !(u?.active===false||u?.is_active===false||u?.enabled===false);
 return false;
}
function normalizeStaff(rows,sid){
 const map=new Map();
 (Array.isArray(rows)?rows:[]).forEach(u=>{
   if(!u||!activeCurrentUser(u)||u.active!==true)return;
   const usid=safe(u.school_id||u.schoolId||sid);
   if(sid&&usid&&usid!==sid)return;
   const id=safe(u.user_id||u.id||'');
   const email=lower(u.email||u.user_email||u.microsoft_email||'');
   const name=safe(u.name||u.full_name||u.display_name||u.teacher_name||u.username||email);
   if(!id&&!email)return;
   const key=id||email;
   map.set(key,{...u,id:id||u.id,user_id:id||u.user_id,name,email,school_id:sid,status:'active'});
 });
 return [...map.values()];
}
function roleOf(u){return lower(u?.role||u?.user_role||u?.type||'')}
function isTeacher(u){
 const r=roleOf(u);
 return ['teacher','kindergarten_teacher'].includes(r)||/معلم|معلمة/.test(r);
}
function isAdminEmployee(u){
 const r=roleOf(u);
 return ['administrative_employee','admin_employee'].includes(r)||/اداري|إداري|ادارية|إدارية/.test(r);
}
async function adminAccessToken(){
 if(window.__VERIFIED_SYSTEM_ADMIN_CONTEXT__?.accessToken)return safe(window.__VERIFIED_SYSTEM_ADMIN_CONTEXT__.accessToken);
 const sb=window.__SCHOOL_INFO_ADMIN_SB__;
 if(sb?.auth){
   const s=await sb.auth.getSession();const tok=s?.data?.session?.access_token;if(tok)return tok;
 }
 if(window.supabase?.createClient){
   const client=window.supabase.createClient(SUPABASE_URL,API_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
   const s=await client.auth.getSession();const tok=s?.data?.session?.access_token;if(tok)return tok;
 }
 throw new Error('SYSTEM_ADMIN_SESSION_MISSING');
}
async function call(action,body={}){
 const admin=systemAdminRequested();
 const sid=targetSchoolId();
 const headers={'content-type':'application/json','apikey':API_KEY};
 const payload={...body,action};
 if(admin){
   if(!sid)throw new Error('SYSTEM_ADMIN_SCHOOL_REQUIRED');
   headers.authorization='Bearer '+await adminAccessToken();
   payload.schoolId=sid;
   payload.accessMode='system_admin';
 }else{
   if(window.PlatformCloudSession?.ensure)await window.PlatformCloudSession.ensure();
   const token=safe(window.PlatformCloudSession?.token?.()||
     sessionStorage.getItem('platform_tab_session_token_v1')||
     sessionStorage.getItem('platform_session_token')||'');
   if(!token)throw new Error('SCHOOL_SESSION_REQUIRED');
   headers['x-platform-session']=token;
   delete payload.schoolId;delete payload.accessMode;
 }
 const r=await fetch(SUPABASE_URL+'/functions/v1/school-information',{
   method:'POST',headers,body:JSON.stringify(payload),cache:'no-store'
 });
 const data=await r.json().catch(()=>({}));
 if(!r.ok){const e=new Error(data.error||'تعذر قراءة مركز المعلومات');e.code=data.code||('HTTP_'+r.status);throw e}
 const expected=targetSchoolId();
 if(data.schoolId&&expected&&safe(data.schoolId)!==safe(expected))throw new Error('SCHOOL_INFORMATION_RESPONSE_SCOPE_MISMATCH');
 return data;
}
async function refresh(){
 if(state.loading)return state.loading;
 state.loading=(async()=>{
   const academicYear=currentAcademicYear();
   const data=await call('bootstrap',{academicYear});
   return applySnapshotData({...data,updatedAt:new Date().toISOString()},academicYear,false);
 })().finally(()=>{state.loading=null});
 return state.loading;
}
function revalidateInBackground(){
 if(state.revalidating)return state.revalidating;
 state.revalidating=refresh().catch(e=>{console.warn('[school-information background refresh]',e);return getSnapshotSync()}).finally(()=>{state.revalidating=null});
 return state.revalidating;
}
function getSnapshotSync(){
 const teachers=state.staff.filter(isTeacher);
 return {school:state.school,students:[...state.students],staff:[...state.staff],teachers,
   counts:{students:state.students.length,staff:state.staff.length,teachers:teachers.length},
   schoolId:state.schoolId,accessMode:state.accessMode,academicYear:state.academicYear,updatedAt:state.updatedAt};
}
async function ensureFresh(force){
 const sid=targetSchoolId(),year=currentAcademicYear();
 const same=state.updatedAt&&state.schoolId===sid&&state.academicYear===year;
 if(force){await refresh();return}
 if(!same){
   const cached=await hydratePersistentCache();
   if(!cached){await refresh();return}
 }
 // البيانات المحفوظة تظهر فورًا. إن كانت قديمة تتم المزامنة بالخلفية دون تعطيل القسم.
 if(!cacheIsFresh())revalidateInBackground();
}
async function getSnapshot(force=false){await ensureFresh(force);return getSnapshotSync()}
async function getStudents(force=false){await ensureFresh(force);return [...state.students]}
async function getStaff(force=false){await ensureFresh(force);return [...state.staff]}
async function getTeachers(force=false){await ensureFresh(force);return state.staff.filter(isTeacher)}
async function getAdministrativeEmployees(force=false){await ensureFresh(force);return state.staff.filter(isAdminEmployee)}

function normalizeScope(scope){
 scope=scope||{};
 return {stage:safe(scope.stage),grade:safe(scope.grade),track_name:safe(scope.track_name||scope.track),section_name:safe(scope.section_name||scope.section)};
}
function studentMatchesScope(r,scope){const s=normalizeScope(scope);return (!s.stage||safe(r.stage)===s.stage)&&(!s.grade||safe(r.grade)===s.grade)&&(!s.track_name||safe(r.track_name)===s.track_name)&&(!s.section_name||safe(r.section_name)===s.section_name)}
async function getStudentsByScope(scope={},force=false){
 if(force)await refresh();else await ensureFresh(false);
 return state.students.filter(r=>studentMatchesScope(r,scope));
}
async function notifyStudentsUpdated(scope={},operation='update'){
 const detail={schoolId:state.schoolId||targetSchoolId(),academicYear:state.academicYear||currentAcademicYear(),scope:normalizeScope(scope),operation,version:Date.now()};
 state.updatedAt='1970-01-01T00:00:00.000Z';state.cacheHydrated=false;
 try{window.dispatchEvent(new CustomEvent('school-information:students-updated',{detail}))}catch(_){}
 // حدّث الصفحة الحالية أولًا وانتظر السحابة؛ لا نكتفي بإبطال الكاش.
 const snap=await refresh();
 publishCrossPageUpdate(detail);
 return snap;
}
function notifyUpdated(){
 const detail={schoolId:state.schoolId||targetSchoolId(),academicYear:state.academicYear||currentAcademicYear(),operation:'general',version:Date.now()};
 state.updatedAt='1970-01-01T00:00:00.000Z';state.cacheHydrated=false;
 try{window.dispatchEvent(new CustomEvent('school-information-source-invalidated',{detail}))}catch(_){}
 publishCrossPageUpdate(detail);
}

window.SchoolInformationSource={VERSION,refresh,load:getSnapshot,getSnapshot,getStudents,getStudentsByScope,getStaff,getTeachers,getAdministrativeEmployees,request:call,notifyUpdated,notifyStudentsUpdated,hydratePersistentCache,revalidateInBackground,
 context:()=>({systemAdmin:systemAdminRequested(),schoolId:targetSchoolId(),accessMode:systemAdminRequested()?'system_admin':'school_manager'})};
})();