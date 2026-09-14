(function(){
'use strict';
if(window.SchoolInformationSource&&String(window.SchoolInformationSource.VERSION||'')==='13.0.0-RL156-directory-binding')return;
const VERSION='13.0.0-RL156-directory-binding';
const SUPABASE_URL=(localStorage.getItem('smartSchoolSupabaseUrl')||'https://cijhgvbtrvmmlcssgxht.supabase.co').replace(/\/$/,'');
const DEFAULT_SUPABASE_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpamhndmJ0cnZtbWxjc3NneGh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2OTY4MzUsImV4cCI6MjA5NDI3MjgzNX0.1sbfDvL1V12kj9oVcYJqYhj8NPuLpYjId7CO9QGj3bM';
const API_KEY=localStorage.getItem('smartSchoolSupabaseAnonKey')||DEFAULT_SUPABASE_KEY;
const safe=v=>String(v==null?'':v).trim();
const lower=v=>safe(v).toLowerCase();
const state={school:null,students:[],staff:[],updatedAt:'',schoolId:'',accessMode:'',academicYear:'1448',loading:null,cacheHydrated:false,revalidating:null,studentsCloudVerified:false};
const CACHE_DB='smart_school_information_cache_v3_rl23';
const CACHE_STORE='snapshots';
const CACHE_SCHEMA_VERSION=3;
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
 state.students=fromCache?[]:(Array.isArray(data.students)?data.students:[]).filter(x=>safe(x.student_status)!=='محذوف'&&(!sid||safe(x.school_id||sid)===sid));
 state.studentsCloudVerified=!fromCache;
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
async function callStructure(action,body={}){
 const admin=systemAdminRequested();const sid=targetSchoolId();
 const headers={'content-type':'application/json','apikey':API_KEY};const payload={...body,action};
 if(admin){if(!sid)throw new Error('SYSTEM_ADMIN_SCHOOL_REQUIRED');headers.authorization='Bearer '+await adminAccessToken();payload.schoolId=sid;}
 else{if(window.PlatformCloudSession?.ensure)await window.PlatformCloudSession.ensure();const token=safe(window.PlatformCloudSession?.token?.()||sessionStorage.getItem('platform_tab_session_token_v1')||sessionStorage.getItem('platform_session_token')||'');if(!token)throw new Error('SCHOOL_SESSION_REQUIRED');headers['x-platform-session']=token;}
 const r=await fetch(SUPABASE_URL+'/functions/v1/school-information-structure',{method:'POST',headers,body:JSON.stringify(payload),cache:'no-store'});
 const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||'تعذر قراءة الطلاب المعتمدين');
 const expected=targetSchoolId();if(data.schoolId&&expected&&safe(data.schoolId)!==safe(expected))throw new Error('SCHOOL_INFORMATION_RESPONSE_SCOPE_MISMATCH');return data;
}
async function refresh(){
 if(state.loading)return state.loading;
 state.loading=(async()=>{
   const academicYear=currentAcademicYear();
   const [base,studentsData]=await Promise.all([call('bootstrap',{academicYear}),callStructure('students-list-current-structure',{academicYear})]);
   const merged={...base,students:Array.isArray(studentsData.students)?studentsData.students:[],updatedAt:new Date().toISOString()};
   const snap=applySnapshotData(merged,academicYear,false);state.studentsCloudVerified=true;return snap;
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
   await hydratePersistentCache();
 }
 // RL23: لا تُسلَّم قائمة طلاب من الكاش. يجب إتمام قراءة سحابية في هذه الصفحة.
 if(!state.studentsCloudVerified){await refresh();return}
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



// RL156 — مركز المعلومات هو المصدر الموحد للأسماء والبيانات الأساسية في النماذج والسجلات.
function staffRoleText(u){return [u?.role,u?.role_label,u?.job_title,u?.position,u?.type].map(safe).filter(Boolean).join(' ')}
function managerFromSnapshot(snap){
 const school=snap?.school||{};
 const direct=safe(school.manager_name||school.manager||school.principal_name||school.director_name||'');
 if(direct)return direct;
 const row=(snap?.staff||[]).find(u=>/manager|school_manager|principal|مدير|مديرة/i.test(staffRoleText(u)));
 return safe(row?.name||row?.full_name||row?.display_name||'');
}
function schoolNameFromSnapshot(snap){const s=snap?.school||{};return safe(s.school_name||s.name||s.display_name||'')}
function educationFromSnapshot(snap){const s=snap?.school||{};return safe(s.education_department||s.education||s.directorate||s.edu_department||'')}
function displayPersonName(r){return safe(r?.student_name||r?.name||r?.full_name||r?.display_name||r?.username||r?.email||'')}
function uniqueNames(rows){const seen=new Set(),out=[];(rows||[]).forEach(r=>{const n=displayPersonName(r);const k=n.replace(/\s+/g,' ').trim();if(!k||seen.has(k))return;seen.add(k);out.push(k)});return out}
function directoryFromSnapshot(snap){
 const staff=Array.isArray(snap?.staff)?snap.staff:[];
 const students=Array.isArray(snap?.students)?snap.students:[];
 const teachers=staff.filter(isTeacher);
 const admins=staff.filter(isAdminEmployee);
 return {students:uniqueNames(students),teachers:uniqueNames(teachers),admins:uniqueNames(admins),staff:uniqueNames(staff),manager:managerFromSnapshot(snap),school:schoolNameFromSnapshot(snap),education:educationFromSnapshot(snap)};
}
function ensureDirectoryLists(doc,dir){
 if(!doc?.body)return {};
 const defs={students:dir.students,teachers:dir.teachers,admins:dir.admins,staff:dir.staff};
 const ids={students:'school-info-students-list',teachers:'school-info-teachers-list',admins:'school-info-admins-list',staff:'school-info-staff-list'};
 Object.keys(defs).forEach(kind=>{
   let dl=doc.getElementById(ids[kind]);
   if(!dl){dl=doc.createElement('datalist');dl.id=ids[kind];dl.className='school-info-directory-datalist';doc.body.appendChild(dl)}
   const sig=(defs[kind]||[]).join('\u0001');
   if(dl.dataset.signature!==sig){dl.innerHTML='';(defs[kind]||[]).forEach(n=>{const o=doc.createElement('option');o.value=n;dl.appendChild(o)});dl.dataset.signature=sig}
 });
 return ids;
}
function fieldContext(el){
 const bits=[];const push=v=>{v=safe(v);if(v)bits.push(v)};
 push(el.getAttribute?.('aria-label'));push(el.getAttribute?.('placeholder'));push(el.getAttribute?.('name'));push(el.getAttribute?.('data-field'));push(el.getAttribute?.('data-label'));
 const id=el.id;if(id){try{const lab=el.ownerDocument.querySelector('label[for="'+CSS.escape(id)+'"]');push(lab?.textContent)}catch(_){}}
 let p=el.parentElement,depth=0;while(p&&depth<3){push(p.querySelector?.(':scope > label')?.textContent);if(p.matches?.('td,th,tr,.field,.form-group,.recordFormGrid>div,.grid>div'))push(p.textContent);p=p.parentElement;depth++}
 return bits.join(' ').replace(/\s+/g,' ').trim();
}
function classifyPersonField(el){
 const c=fieldContext(el);
 if(!c)return '';
 if(/اسم\s*(الطالب|الطالبة|الطالب\/الطالبة)|الطالب\s*\/\s*الطالبة|اسم\s*المتعلم|المتعلم|المتعلمة/.test(c))return 'students';
 if(/اسم\s*(المعلم|المعلمة)|المعلم\/ة|معلم|معلمة/.test(c))return 'teachers';
 if(/اسم\s*(الموظف|الموظفة|الإداري|الإدارية)|موظف|موظفة|إداري|إدارية/.test(c))return 'admins';
 if(/عضو|عضوة|أعضاء|منفذ|منفذة|المسؤول|المسؤولة|الرئيس|الرئيسة|المقرر|المقررة|المكلف|المكلفة|الحضور|اسم\s*الشخص|اسم\s*المنسوب/.test(c))return 'staff';
 return '';
}
function isTextLike(el){if(!el||el.tagName!=='INPUT')return false;const t=lower(el.type||'text');return !['date','datetime-local','time','number','file','checkbox','radio','hidden','button','submit','reset','color','range'].includes(t)}
function looksPlaceholderValue(v){v=safe(v);return !v||/^(?:-+|\.+|اختر|اكتب|اسم\s*(?:المدرسة|المدير|المديرة)|مدير\s*المدرسة)$/i.test(v)}
function bindInformationFields(root=document,snapshot=null){
 try{
  const doc=root?.nodeType===9?root:(root?.ownerDocument||document),scope=root?.querySelectorAll?root:doc;
  const snap=snapshot||getSnapshotSync(),dir=directoryFromSnapshot(snap),ids=ensureDirectoryLists(doc,dir);
  scope.querySelectorAll('input,textarea,select').forEach(el=>{
    if(el.closest?.('.school-info-directory-datalist'))return;
    const c=fieldContext(el);
    if(!c)return;
    // البيانات الأساسية: نعكسها فقط على الخانات الفارغة/الافتراضية ولا نمحو إدخال المستخدم.
    if(isTextLike(el)&&/اسم\s*(المدرسة|المنشأة)/.test(c)&&dir.school&&looksPlaceholderValue(el.value)){el.value=dir.school;el.dispatchEvent(new Event('input',{bubbles:true}));el.dataset.schoolInfoBound='school'}
    if(isTextLike(el)&&/اسم\s*(مدير|مديرة)|مدير\/مديرة/.test(c)&&dir.manager&&looksPlaceholderValue(el.value)){el.value=dir.manager;el.dispatchEvent(new Event('input',{bubbles:true}));el.dataset.schoolInfoBound='manager'}
    if(isTextLike(el)&&/إدارة\s*التعليم/.test(c)&&dir.education&&looksPlaceholderValue(el.value)){el.value=dir.education;el.dispatchEvent(new Event('input',{bubbles:true}));el.dataset.schoolInfoBound='education'}
    const kind=classifyPersonField(el);
    if(kind&&isTextLike(el)&&ids[kind]){el.setAttribute('list',ids[kind]);el.dataset.schoolInfoDirectory=kind;el.autocomplete='off'}
  });
  ensureInformationPrintStyle(doc);
  return {ok:true,directory:dir};
 }catch(e){console.warn('[school-information bind fields]',e);return {ok:false,error:String(e?.message||e)}}
}
function ensureInformationPrintStyle(doc=document){
 try{
  if(!doc?.head||doc.getElementById('school-information-print-normalizer-rl156'))return;
  const st=doc.createElement('style');st.id='school-information-print-normalizer-rl156';st.textContent=`
  @media print{
    .school-info-directory-datalist,.noPrint,.no-print,.print-hidden,button,[role="dialog"].fixed,.modal-backdrop{display:none!important}
    input[data-school-info-directory],input[data-school-info-bound],select[data-school-info-directory],textarea[data-school-info-directory],
    input[list^="school-info-"]{border:0!important;outline:0!important;box-shadow:none!important;background:transparent!important;padding:0!important;color:#111!important;-webkit-text-fill-color:#111!important;appearance:none!important;-webkit-appearance:none!important}
    select{background-image:none!important;-webkit-appearance:none!important;appearance:none!important}
    input,textarea,select{box-shadow:none!important}
  }`;
  doc.head.appendChild(st);
 }catch(e){console.warn('[school-information print style]',e)}
}
let bindTimer=0;
function scheduleAutoBind(doc=document){clearTimeout(bindTimer);bindTimer=setTimeout(async()=>{try{const snap=await getSnapshot(false);bindInformationFields(doc,snap)}catch(e){console.warn('[school-information auto bind]',e)}},80)}
function autoBindDirectory(){
 const run=()=>scheduleAutoBind(document);
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
 try{const mo=new MutationObserver(()=>run());mo.observe(document.documentElement,{childList:true,subtree:true})}catch(_e){}
 window.addEventListener('school-information-updated',run);window.addEventListener('school-information-source-invalidated',run);
}

window.SchoolInformationSource={VERSION,refresh,load:getSnapshot,getSnapshot,getStudents,getStudentsByScope,getStaff,getTeachers,getAdministrativeEmployees,directoryFromSnapshot,bindInformationFields,ensureInformationPrintStyle,request:call,notifyUpdated,notifyStudentsUpdated,hydratePersistentCache,revalidateInBackground,
 context:()=>({systemAdmin:systemAdminRequested(),schoolId:targetSchoolId(),accessMode:systemAdminRequested()?'system_admin':'school_manager'})};
autoBindDirectory();
})();