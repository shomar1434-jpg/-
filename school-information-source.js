(function(){
'use strict';
if(window.SchoolInformationSource&&String(window.SchoolInformationSource.VERSION||'')==='12.2.0-RL25-full-record-name-linking')return;
const VERSION='12.2.0-RL25-full-record-name-linking';
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



/* RL24 — الربط التلقائي لحقول الأسماء بمركز المعلومات المدرسي
   القاعدة: لا قوائم ثابتة ولا أسماء مكتوبة يدويًا عندما يكون الحقل حقل اختيار اسم.
   يحتفظ الربط بعنصر input الأصلي حتى لا يكسر الحفظ/التحقق/EventListeners القديمة. */
const INFO_LINK={
  listIds:{student:'sic-auto-students',teacher:'sic-auto-teachers',admin:'sic-auto-admin-employees',staff:'sic-auto-staff'},
  datasets:{student:[],teacher:[],admin:[],staff:[]},
  loading:null,observer:null,scanTimer:null
};
function fieldText(el){
  if(!el)return '';
  const bits=[el.id,el.name,el.getAttribute?.('placeholder'),el.getAttribute?.('aria-label'),el.getAttribute?.('data-label'),el.getAttribute?.('data-info-field')];
  try{
    const id=safe(el.id);if(id){const lab=document.querySelector('label[for="'+CSS.escape(id)+'"]');if(lab)bits.push(lab.textContent)}
    const wrap=el.closest('label');if(wrap)bits.push(wrap.textContent);
    const parent=el.parentElement;if(parent){
      const direct=[...parent.children].filter(x=>x!==el&&['LABEL','SPAN','DIV','TH','TD'].includes(x.tagName)).slice(0,4);
      direct.forEach(x=>bits.push(x.textContent));
    }
    // RL25: سجلات المدير/الوكيل تُبنى ديناميكياً داخل جداول؛ نضيف سياق الصف والرأس
    // حتى يمكن تمييز حقل «الاسم» العام إذا كان تابعاً لمعلم/وكيل/عضو لجنة/مكلف.
    const cell=el.closest('td,th');
    if(cell){
      bits.push(cell.textContent);
      const row=cell.closest('tr');
      if(row){
        bits.push(row.textContent);
        const table=row.closest('table');
        const head=table?.querySelector('thead')||table?.querySelector('tr');
        if(head&&head!==row)bits.push(head.textContent);
        const idx=[...row.children].indexOf(cell);
        if(idx>=0&&table){
          const hr=table.querySelector('thead tr')||table.querySelector('tr');
          const hc=hr?.children?.[idx];if(hc)bits.push(hc.textContent);
        }
      }
    }
    const block=el.closest('.ref-paragraph,.nameLine,.form-row,.field-row,.grid,.row,.card,fieldset');
    if(block)bits.push(block.textContent);
  }catch(_e){}
  return bits.map(safe).join(' ').replace(/\s+/g,' ').trim();
}
function explicitInfoSource(el){
  const v=lower(el?.getAttribute?.('data-info-source')||el?.getAttribute?.('data-school-info-source')||'');
  if(['student','students','طالب','طلاب'].includes(v))return 'student';
  if(['teacher','teachers','معلم','معلمين','معلمات'].includes(v))return 'teacher';
  if(['employee','employees','admin','administrative_employee','موظف','موظفين','إداري','إداريين'].includes(v))return 'admin';
  if(['staff','منسوب','منسوبين'].includes(v))return 'staff';
  return '';
}
function semanticSource(el){
  const explicit=explicitInfoSource(el);if(explicit)return explicit;
  if(!el||!['INPUT','SELECT'].includes(el.tagName))return '';
  const type=lower(el.type||'text');
  if(el.tagName==='INPUT'&&!['text','search',''].includes(type))return '';
  const t=fieldText(el);
  // استبعاد حقول البحث العامة والحقول التي لا تمثل "اسمًا مختارًا".
  const isSearch=type==='search'||/بحث|ابحث|search/i.test(t);
  if(isSearch&&!/اسم\s*(الطالب|الطالبة|المعلم|المعلمة|الموظف|الإداري|الاداري|المنسوب)/.test(t))return '';
  if(/ولي\s*الأمر|اسم\s*المدرسة|مدير\s*المدرسة|اسم\s*البرنامج|اسم\s*النشاط|اسم\s*اللجنة|اسم\s*الفريق/.test(t))return '';
  if(/اسم\s*(الطالب|الطالبة|الطالب\/ة)|student[_\s-]*(name)?\b|care_student_name|studentname/i.test(t))return 'student';
  if(/اسم\s*(المعلم|المعلمة|المعلم\/ة)|teacher[_\s-]*(name)?\b|teachername/i.test(t))return 'teacher';
  if(/اسم\s*(الموظف|الموظفة|الإداري|الإدارية|الاداري|الادارية)|employee[_\s-]*(name)?\b|empname/i.test(t))return 'admin';
  if(/اسم\s*(المنسوب|المنسوبة)|staff[_\s-]*(name)?\b/i.test(t))return 'staff';
  // RL25: الحقول العامة «الاسم» داخل سجلات اللجان والزيارات والتكليفات والهياكل
  // تُربط بمنسوبي المدرسة عندما يثبت السياق أنها تخص شخصاً من المدرسة.
  const genericName=/(^|\s)(الاسم|اسم)\s*[:：\/]?/i.test(t);
  const schoolPerson=/(وكيل|وكيلة|مدير\/?مديرة|مدير المدرسة|مديرة المدرسة|معلم|معلمة|مرشد|مرشدة|موجه|موجهة|رائد|رائدة|منسق|منسقة|المكلف|المكلفة|مكلف|مكلفة|رئيس اللجنة|رئيسة اللجنة|عضو اللجنة|أعضاء اللجنة|عضو الفريق|أعضاء الفريق|منفذ|منفذة|مسؤول|مسؤولة|الموظف المختص|الموظفة المختصة|مقدم الطلب|مقدمة الطلب)/i.test(t);
  const externalPerson=/(ولي\s*الأمر|الزائر|المورد|المتعهد|اسم\s*الجهة|اسم\s*المدرسة|اسم\s*البرنامج|اسم\s*النشاط|اسم\s*الوثيقة)/i.test(t);
  if(genericName&&schoolPerson&&!externalPerson)return 'staff';
  // رؤوس الجداول التي تستخدم «المكلف/الرئيس/الأعضاء» دون كلمة «اسم» هي أيضاً حقول أشخاص.
  if(!externalPerson&&/(^|\s)(المكلف|المكلفة|الرئيس|الرئيسة|الأعضاء|العضو|المنسق|المنسقة)($|\s|[:：\/])/i.test(t))return 'staff';
  return '';
}
function displayStudentName(r){return safe(r?.student_name||r?.name||r?.full_name||r?.studentName)}
function displayPersonName(r){return safe(r?.name||r?.full_name||r?.display_name||r?.teacher_name||r?.username||r?.email)}
function studentMeta(r){return [r?.stage,r?.grade,r?.section_name||r?.classroom||r?.section,r?.track_name||r?.track].map(safe).filter(Boolean).join(' • ')}
function ensureList(kind){
  const id=INFO_LINK.listIds[kind];let dl=document.getElementById(id);
  if(!dl){dl=document.createElement('datalist');dl.id=id;dl.setAttribute('data-school-information-auto','1');document.body.appendChild(dl)}
  return dl;
}
function rebuildLists(){
  const students=INFO_LINK.datasets.student||[],teachers=INFO_LINK.datasets.teacher||[],adminRows=INFO_LINK.datasets.admin||[],staffRows=INFO_LINK.datasets.staff||[];
  const build=(kind,rows,nameFn,metaFn)=>{
    const dl=ensureList(kind),seen=new Set(),frag=document.createDocumentFragment();dl.textContent='';
    rows.forEach(r=>{const n=nameFn(r);if(!n)return;const key=lower(n);if(seen.has(key))return;seen.add(key);const o=document.createElement('option');o.value=n;const meta=metaFn?metaFn(r):safe(r?.email||'');if(meta)o.label=meta;frag.appendChild(o)});dl.appendChild(frag);
  };
  build('student',students,displayStudentName,studentMeta);build('teacher',teachers,displayPersonName,r=>safe(r?.email||r?.subject||''));build('admin',adminRows,displayPersonName,r=>safe(r?.role||r?.email||''));build('staff',staffRows,displayPersonName,r=>safe(r?.role||r?.email||''));
}
async function loadLinkData(force=false){
  if(INFO_LINK.loading)return INFO_LINK.loading;
  INFO_LINK.loading=(async()=>{
    const [students,teachers,adminRows,staffRows]=await Promise.all([getStudents(!!force),getTeachers(!!force),getAdministrativeEmployees(!!force),getStaff(!!force)]);
    INFO_LINK.datasets.student=Array.isArray(students)?students:[];
    INFO_LINK.datasets.teacher=Array.isArray(teachers)?teachers:[];
    INFO_LINK.datasets.admin=Array.isArray(adminRows)?adminRows:[];
    INFO_LINK.datasets.staff=Array.isArray(staffRows)?staffRows:[];
    rebuildLists();return INFO_LINK.datasets;
  })().catch(e=>{console.warn('[school-information auto dropdowns]',e);return INFO_LINK.datasets}).finally(()=>{INFO_LINK.loading=null});
  return INFO_LINK.loading;
}
function setControlValue(el,value){
  if(!el||value==null)return false;const v=safe(value);if(!v)return false;
  if(el.tagName==='SELECT'){
    const opts=[...el.options];let opt=opts.find(o=>safe(o.value)===v||safe(o.textContent)===v);
    if(!opt)return false;el.value=opt.value;
  }else el.value=v;
  try{el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))}catch(_e){}
  return true;
}
function semanticOfRelated(el){
  const t=fieldText(el).toLowerCase();
  if(/المرحلة|stage\b/.test(t))return 'stage';
  if(/الصف(?!حة)|grade\b/.test(t))return 'grade';
  if(/الفصل|الشعبة|section\b|classroom\b|class[_-]?name/.test(t))return 'section';
  if(/المسار|track\b/.test(t))return 'track';
  if(/السجل\s*المدني|الهوية|national[_-]?id|civil[_-]?id/.test(t))return 'national_id';
  if(/رقم\s*الطالب|student[_-]?(number|no|id)\b/.test(t))return 'student_number';
  return '';
}
function relatedContainers(el){
  const a=[];let n=el?.parentElement;let hops=0;
  while(n&&n!==document.body&&hops++<5){if(n.matches('tr,.form-row,.form-grid,.grid,.row,.field-row,.panel,.card,form,fieldset'))a.push(n);n=n.parentElement}
  return a.length?a:[el?.parentElement].filter(Boolean);
}
function fillStudentContext(el,row){
  if(!row)return;
  const values={stage:safe(row.stage),grade:safe(row.grade),section:safe(row.section_name||row.classroom||row.section),track:safe(row.track_name||row.track),national_id:safe(row.national_id||row.civil_id),student_number:safe(row.student_number||row.student_no||row.noor_number)};
  const done=new Set();
  for(const container of relatedContainers(el)){
    const fields=[...container.querySelectorAll('input,select')].filter(x=>x!==el&&!x.disabled);
    for(const f of fields){const key=semanticOfRelated(f);if(!key||done.has(key)||!values[key])continue;if(setControlValue(f,values[key]))done.add(key)}
    if(done.has('grade')&&done.has('section'))break;
  }
  try{el.dispatchEvent(new CustomEvent('school-information-student-selected',{bubbles:true,detail:{student:row,schoolId:state.schoolId,academicYear:state.academicYear}}))}catch(_e){}
}
function bindInput(el,kind){
  if(el.dataset.sicAutoLinked==='1')return false;
  el.dataset.sicAutoLinked='1';el.dataset.sicSource=kind;
  el.setAttribute('autocomplete','off');el.setAttribute('list',INFO_LINK.listIds[kind]);
  const onPick=()=>{
    if(kind!=='student')return;
    const v=lower(el.value),row=(INFO_LINK.datasets.student||[]).find(r=>lower(displayStudentName(r))===v);
    if(row)fillStudentContext(el,row);
  };
  el.addEventListener('change',onPick);el.addEventListener('blur',onPick);
  return true;
}
function bindSelect(el,kind){
  if(el.dataset.sicAutoLinked==='1')return false;
  // نحترم القوائم التي تديرها الصفحة بنفسها. التلقائي يعمل على select الفارغ أو المعلّم صراحةً data-info-source.
  const explicit=!!explicitInfoSource(el);const meaningful=[...el.options].filter(o=>safe(o.value)||safe(o.textContent)).length;
  if(!explicit&&meaningful>1)return false;
  el.dataset.sicAutoLinked='1';el.dataset.sicSource=kind;
  const refill=()=>{
    const current=safe(el.value);[...el.options].filter(o=>o.dataset?.sicOption==='1').forEach(o=>o.remove());
    const rows=kind==='student'?INFO_LINK.datasets.student:(kind==='teacher'?INFO_LINK.datasets.teacher:(kind==='admin'?INFO_LINK.datasets.admin:INFO_LINK.datasets.staff));
    rows.forEach(r=>{const name=kind==='student'?displayStudentName(r):displayPersonName(r);if(!name)return;const o=document.createElement('option');o.dataset.sicOption='1';o.value=name;o.dataset.sicId=safe(r.id||r.student_id||r.user_id||'');o.textContent=kind==='student'?(name+(studentMeta(r)?' — '+studentMeta(r):'')):name;o.dataset.sicName=name;el.appendChild(o)});
    if(current&&[...el.options].some(o=>o.value===current))el.value=current;
  };
  el._sicRefill=refill;refill();
  if(kind==='student')el.addEventListener('change',()=>{const o=el.selectedOptions?.[0];if(!o)return;const name=lower(o.dataset.sicName||o.textContent.split(' — ')[0]);const row=(INFO_LINK.datasets.student||[]).find(r=>lower(displayStudentName(r))===name);if(row)fillStudentContext(el,row)});
  return true;
}
async function bindInformationFields(root=document){
  const nodes=[];
  if(root?.matches?.('input,select'))nodes.push(root);
  try{nodes.push(...root.querySelectorAll?.('input,select')||[])}catch(_e){}
  const candidates=nodes.map(el=>[el,semanticSource(el)]).filter(x=>x[1]&&x[0].dataset.sicAutoLinked!=='1');
  if(!candidates.length)return {bound:0};
  await loadLinkData(false);
  let bound=0;
  candidates.forEach(([el,kind])=>{if(el.tagName==='INPUT')bound+=bindInput(el,kind)?1:0;else if(el.tagName==='SELECT')bound+=bindSelect(el,kind)?1:0});
  return {bound};
}
function refreshBoundSelects(){document.querySelectorAll('select[data-sic-auto-linked="1"]').forEach(el=>{try{el._sicRefill?.()}catch(_e){}})}
function scheduleInfoScan(root=document){clearTimeout(INFO_LINK.scanTimer);INFO_LINK.scanTimer=setTimeout(()=>bindInformationFields(root).catch(()=>{}),60)}
function bootInfoAutoLink(){
  scheduleInfoScan(document);
  if(!INFO_LINK.observer&&document.documentElement){INFO_LINK.observer=new MutationObserver(ms=>{for(const m of ms){for(const n of m.addedNodes||[]){if(n.nodeType===1){scheduleInfoScan(n);return}}}});INFO_LINK.observer.observe(document.documentElement,{childList:true,subtree:true})}
  window.addEventListener('school-information-updated',()=>loadLinkData(true).then(()=>{refreshBoundSelects();scheduleInfoScan(document)}).catch(()=>{}));
  window.addEventListener('school-information:students-updated',()=>loadLinkData(true).then(()=>{refreshBoundSelects();scheduleInfoScan(document)}).catch(()=>{}));
  window.addEventListener('school-information-source-invalidated',()=>loadLinkData(true).then(()=>{refreshBoundSelects();scheduleInfoScan(document)}).catch(()=>{}));
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bootInfoAutoLink,{once:true});else bootInfoAutoLink();

window.SchoolInformationSource={VERSION,refresh,load:getSnapshot,getSnapshot,getStudents,getStudentsByScope,getStaff,getTeachers,getAdministrativeEmployees,request:call,notifyUpdated,notifyStudentsUpdated,hydratePersistentCache,revalidateInBackground,bindInformationFields,refreshInformationDropdowns:()=>loadLinkData(true).then(()=>{refreshBoundSelects();return bindInformationFields(document)}),
 context:()=>({systemAdmin:systemAdminRequested(),schoolId:targetSchoolId(),accessMode:systemAdminRequested()?'system_admin':'school_manager'})};
})();