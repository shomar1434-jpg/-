(function(){
'use strict';
if(window.SchoolInformationSource) return;

const CFG={
  url:()=>localStorage.getItem('smartSchoolSupabaseUrl')||'https://cijhgvbtrvmmlcssgxht.supabase.co',
  anon:()=>localStorage.getItem('smartSchoolSupabaseAnonKey')||'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpamhndmJ0cnZtbWxjc3NneGh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2OTY4MzUsImV4cCI6MjA5NDI3MjgzNX0.1sbfDvL1V12kj9oVcYJqYhj8NPuLpYjId7CO9QGj3bM'
};
const SECTION_MAP={'1':'أ','2':'ب','3':'ج','4':'د','5':'هـ','6':'و','7':'ز','8':'ح','9':'ط','10':'ي','11':'ك','12':'ل'};
const ROLE_AR={manager:'مدير/ة المدرسة',school_manager:'مدير/ة المدرسة',agent:'وكيل/ة',deputy:'وكيل/ة',teacher:'معلم/ة',student_advisor:'موجه/موجهة طلابية',counselor:'موجه/موجهة طلابية',activity_leader:'رائد/ة النشاط',admin_employee:'موظف/ة إداري/ة',administrative_employee:'موظف/ة إداري/ة',employee:'موظف/ة',health_advisor:'الموجه الصحي',kindergarten_teacher:'معلمة رياض الأطفال',principal:'مدير/ة المدرسة'};
const state={students:[],staff:[],administrativeStaff:[],loaded:false,loading:null,schoolId:'',year:'',updatedAt:'',version:'2.4.0-secure-school-information'};
const safe=v=>String(v==null?'':v).trim();
const norm=v=>safe(v).replace(/[إأآا]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[ـ\u064B-\u0652]/g,'').replace(/\s+/g,' ').toLowerCase();
function isSystemAdmin(){try{return !!(window.__VERIFIED_SYSTEM_ADMIN_CONTEXT__&&window.__VERIFIED_SYSTEM_ADMIN_CONTEXT__.verified===true)||(sessionStorage.getItem('system_admin_context')==='1'&&sessionStorage.getItem('system_admin_verified')==='true')}catch(_){return false}}
const readJson=k=>{try{return JSON.parse(localStorage.getItem(k)||sessionStorage.getItem(k)||'null')}catch(_){return null}};
const infoChannel=(()=>{try{return new BroadcastChannel('smart-school-information')}catch(_){return null}})();
function schoolId(){
  try{
    if(isSystemAdmin()) return safe(sessionStorage.getItem('system_admin_school_info_target_v1'));
    const sid=window.PlatformCloudSession&&PlatformCloudSession.schoolId?PlatformCloudSession.schoolId():'';return safe(sid);
  }catch(_){return ''}
}
function year(){return safe(localStorage.getItem('school_info_academic_year')||localStorage.getItem('academic_year')||localStorage.getItem('current_academic_year')||'1448')}
function noorSection(v){
  v=safe(v).replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/شعبة|الشعبة|الفصل|فصل|رقم/gi,'').trim();
  const m=v.match(/\d+/); if(m&&SECTION_MAP[String(Number(m[0]))]) return SECTION_MAP[String(Number(m[0]))];
  return SECTION_MAP[v]||v||'غير محدد';
}
function studentLocal(){
  if(isSystemAdmin())return [];
  const sid=schoolId(), yr=year(), out=[];
  const preferred=['schoolInformationCenter:'+sid+':'+yr,'school_information_center:'+sid+':'+yr,'sic_students:'+sid+':'+yr,'school_information_center_students'];
  const keys=[...preferred,...Object.keys(localStorage).filter(k=>/schoolInformationCenter:|school_information_center:|sic_students:/i.test(k)&&(!sid||k.includes(sid)))];
  [...new Set(keys)].forEach(k=>{try{const d=JSON.parse(localStorage.getItem(k)||'null'),rows=Array.isArray(d)?d:(d&&Array.isArray(d.students)?d.students:d&&Array.isArray(d.rows)?d.rows:[]);out.push(...rows)}catch(_){}});
  return out;
}
function sameSchool(u){const sid=schoolId(),us=safe(u.school_id||u.schoolId||u.current_school_id||u.active_school_id||u.school||'');return !!sid&&!!us&&sid===us}
function staffLocal(){
  if(isSystemAdmin())return [];
  const keys=['smartSchoolUnifiedOpsV2_users','offline_users_backup','smart_school_users','users','school_users','smartSchoolUsers'],out=[];
  keys.forEach(k=>{try{const d=JSON.parse(localStorage.getItem(k)||sessionStorage.getItem(k)||'null'),rows=Array.isArray(d)?d:(d&&Array.isArray(d.users)?d.users:[]);out.push(...rows)}catch(_){}});
  return out.filter(x=>x&&sameSchool(x)&&!/deleted|محذوف/.test(norm(x.status||x.user_status||'')));
}
function mapStudent(r){return {id:safe(r.id||r.student_id||r.student_number||r.national_id||r.student_name),name:safe(r.student_name||r.name||r.full_name),student_number:safe(r.student_number||r.noor_number||''),national_id:safe(r.national_id||r.identity||''),stage:safe(r.stage||r.school_stage||''),grade:safe(r.grade||r.class_grade||''),track:safe(r.track_name||r.track||''),section:noorSection(r.noor_section_code||r.section_name||r.section||''),noor_section_code:safe(r.noor_section_code||r.section||''),status:safe(r.student_status||r.status||'نشط')};}
function roleOf(u){return safe(u.role||u.user_role||u.type||u.account_type||u.section||'')}
function mapStaff(u){const role=roleOf(u);return {id:safe(u.id||u.user_id||u.uid||u.email||u.name),name:safe(u.name||u.full_name||u.display_name||u.username||u.teacher_name||u.email),role,role_label:safe(u.role_label||u.job_title||u.position||ROLE_AR[role]||role||'مستخدم'),email:safe(u.email||u.user_email||''),status:safe(u.status||u.user_status||''),school_id:safe(u.school_id||u.schoolId||'')};}
function dedupe(rows,keyFn){const m=new Map();rows.forEach(r=>{const k=keyFn(r);if(k&&!m.has(k))m.set(k,r)});return [...m.values()]}
async function secureCall(action,body={}){
  const sid=schoolId();let headers={'content-type':'application/json','apikey':CFG.anon()},payload=Object.assign({},body,{action});
  if(isSystemAdmin()){
    const sb=window.__SCHOOL_INFO_ADMIN_SB__;if(!sb||!sid)throw new Error('SYSTEM_ADMIN_SCHOOL_CONTEXT_REQUIRED');
    const sr=await sb.auth.getSession();const session=sr&&sr.data&&sr.data.session;if(!session||!session.access_token)throw new Error('SYSTEM_ADMIN_SESSION_REQUIRED');
    headers.authorization='Bearer '+session.access_token;payload.schoolId=sid;payload.accessMode='system_admin';
  }else{
    if(!window.PlatformCloudSession||!PlatformCloudSession.valid())throw new Error('SESSION_REQUIRED');headers['x-platform-session']=PlatformCloudSession.token();
  }
  const res=await fetch(CFG.url()+'/functions/v1/school-information',{method:'POST',headers,body:JSON.stringify(payload)});
  const data=await res.json().catch(()=>({}));if(!res.ok)throw new Error(data.error||('HTTP '+res.status));if(data.schoolId&&sid&&String(data.schoolId)!==String(sid))throw new Error('SCHOOL_SCOPE_MISMATCH');return data;
}
async function cloudStudents(){const sid=schoolId();if(!sid)return[];try{const q=await secureCall('students-list',{academicYear:year()});return q.students||[]}catch(_){return[]}}
async function cloudStaff(){const sid=schoolId();if(!sid)return[];try{const q=await secureCall('staff-list');return q.staff||[]}catch(_){return[]}}
async function cloudAdministrativeStaff(){const rows=await cloudStaff();return (rows||[]).filter(x=>['admin_employee','administrative_employee'].includes(norm(roleOf(x))))}
async function load(force){
  const sid=schoolId(),yr=year(); if(state.loaded&&!force&&state.schoolId===sid&&state.year===yr)return state;if(state.loading&&!force)return state.loading;
  state.loading=(async()=>{
    state.schoolId=sid;state.year=yr;
    const [cs,cu,ca]=await Promise.all([cloudStudents(),cloudStaff(),cloudAdministrativeStaff()]);
    state.students=dedupe([...studentLocal(),...cs].map(mapStudent).filter(x=>x.name&&!/محذوف/.test(norm(x.status))),x=>safe(x.student_number||x.national_id)||norm(x.name)+'|'+norm(x.grade)+'|'+norm(x.section));
    state.staff=dedupe([...staffLocal(),...cu].map(mapStaff).filter(x=>x.name),x=>safe(x.id)||norm(x.email)||norm(x.name)+'|'+norm(x.role));
    state.administrativeStaff=dedupe((ca||[]).map(mapStaff).filter(x=>x.name&&['admin_employee','administrative_employee'].includes(norm(x.role))),x=>safe(x.id)||norm(x.email)||norm(x.name));
    state.loaded=true;state.loading=null;state.updatedAt=new Date().toISOString();refreshLists();emit('school-information-ready',snapshot());emit('school-information-change',snapshot());return state;
  })();return state.loading;
}
function teachers(){return state.staff.filter(x=>/teacher|kindergarten_teacher|معلم|معلمة رياض/.test(norm(x.role+' '+x.role_label)))}
function administrativeEmployees(){
  // المصدر الوحيد للموظف الإداري هو الدور الصريح الناتج عن رابط التسجيل الإداري.
  // لا نعتمد على المسمى النصي، ولا على وجود خطة محلية، ولا على كون المستخدم عضوًا في المدرسة فقط.
  return state.administrativeStaff.slice();
}

function snapshot(){
  return {
    schoolId:state.schoolId||schoolId(),
    academicYear:state.year||year(),
    students:state.students.slice(),
    staff:state.staff.slice(),
    teachers:teachers().slice(),
    administrativeEmployees:administrativeEmployees().slice(),
    counts:{students:state.students.length,staff:state.staff.length,teachers:teachers().length,administrativeEmployees:administrativeEmployees().length},
    updatedAt:state.updatedAt||'',
    version:state.version
  };
}
function findStudent(q){
  q=norm(q); if(!q)return null;
  return state.students.find(x=>[x.id,x.student_number,x.national_id,x.name].some(v=>norm(v)===q))||null;
}
function findStaff(q){
  q=norm(q); if(!q)return null;
  return state.staff.find(x=>[x.id,x.email,x.name].some(v=>norm(v)===q))||null;
}
function emit(name,detail){
  const payload=detail||snapshot();
  try{window.dispatchEvent(new CustomEvent(name,{detail:payload}))}catch(_){}
  if(name==='school-information-updated'){try{infoChannel&&infoChannel.postMessage({type:'updated',schoolId:schoolId(),academicYear:year(),at:new Date().toISOString()})}catch(_){}}
}

function fieldText(el){
  let t=[el.id,el.name,el.placeholder,el.getAttribute('aria-label'),el.dataset&&el.dataset.label].filter(Boolean).join(' ');
  if(el.id){const l=document.querySelector('label[for="'+CSS.escape(el.id)+'"]');if(l)t+=' '+l.textContent}
  const p=el.closest('label');if(p)t+=' '+p.textContent;
  const wrap=el.closest('.field,.form-group,.ss-field,.input-group,.row>div,td,th');if(wrap){const l=wrap.querySelector('label,.label,.field-label');if(l)t+=' '+l.textContent}
  return norm(t);
}
function kind(el){
  const explicit=safe(el&&el.dataset&&el.dataset.sicKind);
  if(/^(student|teacher|staff|administrative_employee)$/.test(explicit))return explicit;
  const t=fieldText(el);
  if(/بحث|search|filter|تصفية/.test(t)&&!/اسم الطالب|اسم المعلم|اسم الموظف/.test(t)) return '';
  if(/اسم الطالب|الطالب\/الطالبه|الطالب|student name|student_name/.test(t)&&!/ولي الامر|اسم ولي/.test(t))return 'student';
  if(/اسم المعلم|المعلم\/المعلمه|المعلم|teacher name|teacher_name/.test(t))return 'teacher';
  if(/اسم الموظف.*الاداري|الموظف.*الاداري|الموظفه.*الاداري|administrative[_ \-]?employee|admin[_ \-]?employee/.test(t))return 'administrative_employee';
  if(/اسم العضو|عضو اللجنه|عضو المجلس|رئيس اللجنه|رئيس المجلس|امين اللجنه|امين المجلس|المكلف|اسم الموظف|الموظف|المنفذ|المسؤول|المسئول|رئيس الفريق|عضو الفريق|staff|employee|member/.test(t))return 'staff';
  return '';
}
function ensureDatalist(id){let d=document.getElementById(id);if(!d){d=document.createElement('datalist');d.id=id;(document.body||document.documentElement).appendChild(d)}return d}
function refreshLists(){
  const sd=ensureDatalist('sicStudentsList'),td=ensureDatalist('sicTeachersList'),ad=ensureDatalist('sicAdministrativeEmployeesList'),pd=ensureDatalist('sicStaffList');
  sd.innerHTML=state.students.map(x=>'<option value="'+escAttr(x.name)+'" label="'+escAttr([x.grade,x.section].filter(Boolean).join(' — '))+'"></option>').join('');
  td.innerHTML=teachers().map(x=>'<option value="'+escAttr(x.name)+'" label="'+escAttr(x.role_label)+'"></option>').join('');
  ad.innerHTML=administrativeEmployees().map(x=>'<option value="'+escAttr(x.name)+'" label="'+escAttr(x.role_label)+'"></option>').join('');
  pd.innerHTML=state.staff.map(x=>'<option value="'+escAttr(x.name)+'" label="'+escAttr(x.role_label)+'"></option>').join('');
  document.querySelectorAll('[data-sic-kind]').forEach(fillSelectIfNeeded);
}
function escAttr(v){return safe(v).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
function fillSelectIfNeeded(el){if(el.tagName!=='SELECT')return;const k=el.dataset.sicKind,rows=k==='student'?state.students:k==='teacher'?teachers():k==='administrative_employee'?administrativeEmployees():state.staff;if(!rows.length)return;const existing=new Set([...el.options].map(o=>norm(o.value||o.textContent)));rows.forEach(x=>{if(existing.has(norm(x.name)))return;const o=document.createElement('option');o.value=x.name;o.textContent=x.name+(k!=='student'&&x.role_label?' — '+x.role_label:'');o.dataset.sicId=x.id;o.dataset.sicManaged='1';el.dataset.sicSource='central';el.appendChild(o);existing.add(norm(x.name))})}
function findBySemantic(root,patterns){
  const els=[...root.querySelectorAll('input:not([type]),input[type="text"],input[type="search"],input[type="number"],select,textarea')];return els.find(e=>patterns.some(p=>p.test(fieldText(e))));
}
function setField(el,v){if(!el||v==null||safe(v)===''||safe(el.value)!=='')return; if(el.tagName==='SELECT'){let o=[...el.options].find(x=>norm(x.value||x.textContent)===norm(v));if(!o){o=document.createElement('option');o.value=v;o.textContent=v;el.appendChild(o)}el.value=o.value}else el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))}
function contextRoot(el){return el.closest('form,.modal,.dialog,[role="dialog"],.drawer,.card,.panel,.record-form,.form-card,tr')||document}
function autofill(el,k){
  const v=safe(el.value);if(!v)return;const row=(k==='student'?state.students:k==='teacher'?teachers():k==='administrative_employee'?administrativeEmployees():state.staff).find(x=>norm(x.name)===norm(v));if(!row)return;const root=contextRoot(el);
  if(k==='student'){
    setField(findBySemantic(root,[/المرحله|stage/]),row.stage);setField(findBySemantic(root,[/الصف(?!ه)|grade/]),row.grade);setField(findBySemantic(root,[/المسار|track/]),row.track);setField(findBySemantic(root,[/الشعبه|section/]),row.section);setField(findBySemantic(root,[/رقم الطالب|student number|student_number/]),row.student_number);setField(findBySemantic(root,[/رقم الهويه|السجل المدني|national/]),row.national_id);
  }else{
    setField(findBySemantic(root,[/الصفه|الدور|المسمى|الوظيفه|role|position/]),row.role_label);setField(findBySemantic(root,[/البريد|email/]),row.email);
  }
  try{el.dispatchEvent(new CustomEvent('school-information-selected',{bubbles:true,detail:{kind:k,record:row}}))}catch(_){}
}
function enhance(el){
  if(!el||el.nodeType!==1||el.dataset.sicEnhanced)return; if(!/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName))return;
  if(el.dataset.sicIgnore==='1'||el.hasAttribute('data-sic-ignore'))return;
  const k=kind(el);if(!k)return;el.dataset.sicEnhanced='1';el.dataset.sicKind=k;el.dataset.sicSource='central';el.title=(el.title?el.title+' — ':'')+'المصدر: مركز المعلومات المدرسية';
  if(el.tagName==='INPUT'&&['text','search',''].includes(el.type)){el.setAttribute('list',k==='student'?'sicStudentsList':k==='teacher'?'sicTeachersList':k==='administrative_employee'?'sicAdministrativeEmployeesList':'sicStaffList')}
  else fillSelectIfNeeded(el);
  el.addEventListener('focus',()=>load(false).then(()=>{if(el.tagName==='SELECT')fillSelectIfNeeded(el)}));el.addEventListener('change',()=>autofill(el,k));
}
function scan(root){if(!root)return;if(root.matches&&root.matches('input,select,textarea'))enhance(root);root.querySelectorAll&&root.querySelectorAll('input,select,textarea').forEach(enhance)}
function boot(){ensureDatalist('sicStudentsList');ensureDatalist('sicTeachersList');ensureDatalist('sicAdministrativeEmployeesList');ensureDatalist('sicStaffList');scan(document);load(false);
if(infoChannel)infoChannel.onmessage=e=>{if(e.data&&e.data.type==='updated'){state.loaded=false;load(true)}};new MutationObserver(ms=>ms.forEach(m=>m.addedNodes.forEach(n=>{if(n.nodeType===1)scan(n)}))).observe(document.documentElement,{childList:true,subtree:true});window.addEventListener('storage',e=>{if(/schoolInformationCenter|school_information_center|sic_students|users|school_users/i.test(e.key||''))load(true)});window.addEventListener('school-information-updated',()=>{state.loaded=false;load(true)});}
window.SchoolInformationSource={
  load,
  getStudents:async()=>{await load(false);return state.students.slice()},
  getStaff:async()=>{await load(false);return state.staff.slice()},
  getTeachers:async(force=false)=>{await load(!!force);return teachers().slice()},
  getAdministrativeEmployees:async()=>{await load(false);return administrativeEmployees().slice()},
  getSnapshot:async()=>{await load(false);return snapshot()},
  findStudent:async q=>{await load(false);return findStudent(q)},
  findStaff:async q=>{await load(false);return findStaff(q)},
  getSchoolId:schoolId,
  getAcademicYear:year,
  noorSection,
  refresh:async()=>{const s=await load(true);emit('school-information-updated',snapshot());return s},
  notifyUpdated:()=>{state.loaded=false;emit('school-information-updated',snapshot());return load(true)},
  state,
  version:'2.4.0-teacher-force-refresh'
};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
