(function(){
'use strict';
if(window.SchoolInformationSource&&String(window.SchoolInformationSource.VERSION||'').includes('live-roster-v5'))return;
const VERSION='5.0.0-live-roster-v5-dual-context';
const SUPABASE_URL=(localStorage.getItem('smartSchoolSupabaseUrl')||'https://cijhgvbtrvmmlcssgxht.supabase.co').replace(/\/$/,'');
const DEFAULT_SUPABASE_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpamhndmJ0cnZtbWxjc3NneGh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2OTY4MzUsImV4cCI6MjA5NDI3MjgzNX0.1sbfDvL1V12kj9oVcYJqYhj8NPuLpYjId7CO9QGj3bM';
const API_KEY=localStorage.getItem('smartSchoolSupabaseAnonKey')||DEFAULT_SUPABASE_KEY;
const safe=v=>String(v==null?'':v).trim();
const lower=v=>safe(v).toLowerCase();
const state={school:null,students:[],staff:[],updatedAt:'',schoolId:'',accessMode:'',academicYear:'1448',loading:null};

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
   if(!u||!activeCurrentUser(u))return;
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
   const sid=safe(data.schoolId||data.school?.id||targetSchoolId());
   state.school=data.school||null;
   state.students=(Array.isArray(data.students)?data.students:[]).filter(x=>safe(x.student_status)!=='محذوف'&&(!sid||safe(x.school_id||sid)===sid));
   state.staff=normalizeStaff(data.staff,sid);
   state.schoolId=sid;state.accessMode=safe(data.accessMode||(systemAdminRequested()?'system_admin':'school_manager'));
   state.academicYear=academicYear;state.updatedAt=new Date().toISOString();
   return getSnapshotSync();
 })().finally(()=>{state.loading=null});
 return state.loading;
}
function getSnapshotSync(){
 const teachers=state.staff.filter(isTeacher);
 return {school:state.school,students:[...state.students],staff:[...state.staff],teachers,
   counts:{students:state.students.length,staff:state.staff.length,teachers:teachers.length},
   schoolId:state.schoolId,accessMode:state.accessMode,academicYear:state.academicYear,updatedAt:state.updatedAt};
}
async function ensureFresh(force){
 const sid=targetSchoolId(),year=currentAcademicYear();
 if(force||!state.updatedAt||state.schoolId!==sid||state.academicYear!==year)await refresh();
}
async function getSnapshot(force=false){await ensureFresh(force);return getSnapshotSync()}
async function getStudents(force=false){await ensureFresh(force);return [...state.students]}
async function getStaff(force=false){await ensureFresh(force);return [...state.staff]}
async function getTeachers(force=false){await ensureFresh(force);return state.staff.filter(isTeacher)}
async function getAdministrativeEmployees(force=false){await ensureFresh(force);return state.staff.filter(isAdminEmployee)}
function notifyUpdated(){state.updatedAt='';try{window.dispatchEvent(new CustomEvent('school-information-source-invalidated'))}catch(_){}}
window.SchoolInformationSource={VERSION,refresh,getSnapshot,getStudents,getStaff,getTeachers,getAdministrativeEmployees,request:call,notifyUpdated,
 context:()=>({systemAdmin:systemAdminRequested(),schoolId:targetSchoolId(),accessMode:systemAdminRequested()?'system_admin':'school_manager'})};
})();