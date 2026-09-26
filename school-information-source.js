(function(){
'use strict';
const VERSION='15.1.0-RL221-teacher-scope-canonical-match';
if(window.SchoolInformationSource&&String(window.SchoolInformationSource.VERSION||'')===VERSION)return;
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
    window.SchoolBaseSettings?.read?.().year||localStorage.getItem('setting_academic_year')||
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
const ROLE_LABELS={manager:'مدير/مديرة المدرسة',school_manager:'مدير/مديرة المدرسة',principal:'مدير/مديرة المدرسة',
 agent:'وكيل/وكيلة المدرسة',deputy:'وكيل/وكيلة المدرسة',teacher:'معلم/معلمة',kindergarten_teacher:'معلم/معلمة رياض الأطفال',
 administrative_employee:'موظف/موظفة إدارية',admin_employee:'موظف/موظفة إدارية',student_counselor:'موجه/موجهة طلابية',
 activity_leader:'رائد/رائدة النشاط',health_advisor:'موجه/موجهة صحية'};
function jobTitleOf(u){return safe(u?.job_title||u?.jobTitle||u?.role_label||ROLE_LABELS[roleOf(u)]||u?.role||'')}
function studentName(r){return safe(r?.student_name||r?.name||r?.full_name)}
function personName(r){return safe(r?.name||r?.full_name||r?.display_name||r?.teacher_name||r?.username||r?.email)}
function uniqueValues(rows,key){return [...new Set(rows.map(r=>safe(typeof key==='function'?key(r):r?.[key])).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar'))}
function directorySync(){
 const students=state.students.map(r=>({...r,id:safe(r.id),name:studentName(r),nationalId:safe(r.national_id),studentNumber:safe(r.student_number),
  stage:safe(r.stage),grade:safe(r.grade),track:safe(r.track_name),section:safe(r.section_name),kind:'student'})).filter(r=>r.name);
 const staff=state.staff.map(r=>({...r,id:safe(r.user_id||r.id),userId:safe(r.user_id||r.id),name:personName(r),
  role:roleOf(r),roleLabel:safe(r.role_label||ROLE_LABELS[roleOf(r)]||r.role),jobTitle:jobTitleOf(r),kind:isTeacher(r)?'teacher':(isAdminEmployee(r)?'employee':'staff')})).filter(r=>r.name);
 const teachers=staff.filter(r=>r.kind==='teacher'),employees=staff.filter(r=>r.kind==='employee');
 return {students,staff,teachers,employees,stages:uniqueValues(students,'stage'),grades:uniqueValues(students,'grade'),
  tracks:uniqueValues(students,'track'),sections:uniqueValues(students,'section'),jobTitles:uniqueValues(staff,'jobTitle'),
  schoolId:state.schoolId,academicYear:state.academicYear,updatedAt:state.updatedAt};
}
async function getDirectory(force=false){await ensureFresh(force);return directorySync()}

const LIST_IDS={student:'sis-students',teacher:'sis-teachers',employee:'sis-employees',staff:'sis-staff',stage:'sis-stages',grade:'sis-grades',track:'sis-tracks',section:'sis-sections',jobTitle:'sis-job-titles'};
const RELATED_ONLY_TYPES=new Set(['nationalId','studentNumber','email','phone','specialization']);
let bindingObserver=null,bindingTimer=0,bindingBusy=false;
function normalizedText(v){return safe(v).replace(/[\u064B-\u065F\u0670]/g,'').replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي').replace(/\s+/g,' ').toLowerCase()}
function tableHeaderContext(el){
 const cell=el.closest?.('td,th');const table=cell?.closest?.('table');if(!cell||!table)return '';
 const index=cell.cellIndex;
 const rows=[...table.querySelectorAll('thead tr, tr')];
 const header=rows.find(r=>r!==cell.parentElement&&r.cells&&r.cells.length>index);
 return normalizedText(header?.cells?.[index]?.textContent||'');
}
function fieldContext(el){
 const direct=[el.getAttribute('data-info-type'),el.getAttribute('data-school-info'),el.getAttribute('aria-label'),el.getAttribute('placeholder'),el.name,el.id].filter(Boolean).join(' ');
 const escapedId=el.id&&window.CSS?.escape?window.CSS.escape(el.id):safe(el.id).replace(/["\\]/g,'\\$&');
 const doc=el.ownerDocument||document;
 const label=el.id?doc.querySelector('label[for="'+escapedId+'"]')?.textContent:'';
 const cell=el.closest('td,th,.form-group,.field,.input-group,.card,.row');
 return normalizedText([direct,label,tableHeaderContext(el),cell?.querySelector('label,th,.label,.field-label')?.textContent||''].join(' '));
}
function inferFieldType(el){
 const explicit=safe(el.getAttribute('data-info-type')||el.getAttribute('data-school-info'));
 if(LIST_IDS[explicit]||RELATED_ONLY_TYPES.has(explicit))return explicit;
 const c=fieldContext(el);
 const tableText=normalizedText(el.closest?.('table')?.textContent||'');
 if(!c||/(عدد|تاريخ|يوم|هاتف|جوال|بريد|رقم|اسم المدرسه|اسم البرنامج|اسم اللجنه|اسم الفريق)/.test(c))return '';
 if(/(اسم الطالب|اسم الطالبه|الطالب\/ـه|الطالب والطالبه|الطلاب\/الطالبات)/.test(c))return 'student';
 if(/(اسم المعلم|اسم المعلمه|المعلم\/المعلمه|المعلم المنتظر|المعلمة المنتظرة)/.test(c))return 'teacher';
 if(/(اسم الموظف|اسم الموظفه)/.test(c))return 'employee';
 if(/(المسمي الوظيفي|المسمى الوظيفي|الوظيفه)/.test(c))return 'jobTitle';
 if(/(اسم العضو|الاعضاء|الأعضاء|المكلف|المنفذ|المسؤول|المساند|رئيس اللجنه|رئيس الفريق)/.test(c))return 'staff';
 if(/(^|\s)(الاسم|اسم)(\s|$)/.test(c)){
  if(/(السجل المدني|الهويه|الهوية|الصف|الشعبه|الشعبة|الطالب|الطالبه)/.test(tableText))return 'student';
  if(/(الوظيفه|الوظيفة|المسمي|المسمى|اللجنه|اللجنة|الفريق|المعلم|الموظف)/.test(tableText))return 'staff';
 }
 if(/(^|\s)(المرحله|مرحله)(\s|$)/.test(c))return 'stage';
 if(/(^|\s)(الصف|صف دراسي)(\s|$)/.test(c)&&!/الصفه/.test(c))return 'grade';
 if(/(^|\s)(الفصل|الشعبه)(\s|$)/.test(c))return 'section';
 if(/(^|\s)(المسار|التخصص)(\s|$)/.test(c))return 'track';
 return '';
}
function valuesForType(dir,type){
 if(type==='student')return dir.students.map(r=>({value:r.name,id:r.id,entity:r}));
 if(type==='teacher')return dir.teachers.map(r=>({value:r.name,id:r.id,entity:r}));
 if(type==='employee')return dir.employees.map(r=>({value:r.name,id:r.id,entity:r}));
 if(type==='staff')return dir.staff.map(r=>({value:r.name,id:r.id,entity:r}));
 const key={stage:'stages',grade:'grades',track:'tracks',section:'sections',jobTitle:'jobTitles'}[type];
 return (dir[key]||[]).map(value=>({value,id:'',entity:null}));
}
function ensureDatalist(type,items,doc=document){
 let list=doc.getElementById(LIST_IDS[type]);if(!list){list=doc.createElement('datalist');list.id=LIST_IDS[type];doc.body?.appendChild(list)}
 if(!list)return;
 const signature=items.map(item=>safe(item.id)+'\u001f'+safe(item.value)).join('\u001e');
 if(list.dataset.sisSignature===signature)return;
 list.replaceChildren(...items.map(item=>{const o=doc.createElement('option');o.value=item.value;if(item.id)o.dataset.entityId=item.id;return o}));
 list.dataset.sisSignature=signature;
}
const stableDropdownStates=new WeakMap();
function ensureStableDropdownStyles(doc){
 if(doc.getElementById('sis-stable-dropdown-styles'))return;
 const style=doc.createElement('style');style.id='sis-stable-dropdown-styles';
 style.textContent=`
  .sis-stable-dropdown{position:fixed;display:none;box-sizing:border-box;z-index:2147483646;background:#fff;border:1px solid #0f9f98;border-radius:10px;box-shadow:0 12px 32px rgba(15,52,68,.22);max-height:280px;overflow:auto;overscroll-behavior:contain;padding:6px;text-align:right;direction:rtl;color:#153f53;font-family:inherit}
  .sis-stable-dropdown[data-open="1"]{display:block}
  .sis-stable-option{display:block;width:100%;border:0;background:transparent;color:inherit;text-align:right;direction:rtl;border-radius:7px;padding:9px 11px;cursor:pointer;font:inherit;line-height:1.35}
  .sis-stable-option:hover,.sis-stable-option[data-active="1"]{background:#e8f8f6;color:#075f5a}
  .sis-stable-option small{display:block;margin-top:2px;color:#67808c;font-size:.82em}
  .sis-stable-empty{padding:12px;color:#71838c;text-align:center}
 `;
 (doc.head||doc.documentElement).appendChild(style);
}
function stableDropdownState(doc){
 let state=stableDropdownStates.get(doc);if(state)return state;
 ensureStableDropdownStyles(doc);
 const menu=doc.createElement('div');menu.className='sis-stable-dropdown';menu.dataset.sisDropdownRoot='1';menu.setAttribute('role','listbox');
 doc.body.appendChild(menu);
 state={menu,input:null,type:'',items:[],active:-1};stableDropdownStates.set(doc,state);
 const view=doc.defaultView||window;
 doc.addEventListener('pointerdown',event=>{
  if(!state.input)return;
  if(event.target===state.input||menu.contains(event.target))return;
  closeStableDropdown(doc);
 },true);
 view.addEventListener('resize',()=>positionStableDropdown(doc));
 view.addEventListener('scroll',()=>positionStableDropdown(doc),true);
 return state;
}
function closeStableDropdown(doc){
 const state=stableDropdownStates.get(doc);if(!state)return;
 if(state.input){state.input.setAttribute('aria-expanded','false');state.input.removeAttribute('aria-activedescendant')}
 state.menu.dataset.open='0';state.menu.replaceChildren();state.input=null;state.items=[];state.active=-1;
}
function positionStableDropdown(doc){
 const state=stableDropdownStates.get(doc);if(!state?.input||state.menu.dataset.open!=='1')return;
 const view=doc.defaultView||window,rect=state.input.getBoundingClientRect();
 const width=Math.max(rect.width,260),gap=4,below=view.innerHeight-rect.bottom-gap,above=rect.top-gap;
 state.menu.style.width=Math.min(width,Math.max(180,view.innerWidth-16))+'px';
 state.menu.style.left=Math.max(8,Math.min(rect.left,view.innerWidth-Math.min(width,view.innerWidth-16)-8))+'px';
 state.menu.style.maxHeight=Math.max(120,Math.min(280,Math.max(below,above)-8))+'px';
 if(below>=160||below>=above)state.menu.style.top=(rect.bottom+gap)+'px';
 else state.menu.style.top=Math.max(8,rect.top-Math.min(280,above)-gap)+'px';
}
function stableOptionDetails(item,type){
 const entity=item?.entity;if(!entity)return '';
 if(type==='student')return [entity.stage,entity.grade,entity.section].filter(Boolean).join(' — ');
 return safe(entity.jobTitle||entity.roleLabel||'');
}
function selectStableDropdownItem(doc,index){
 const state=stableDropdownStates.get(doc),item=state?.items?.[index],input=state?.input;if(!item||!input)return;
 input.dataset.sisSelectedValue=normalizedText(item.value);if(item.id)input.dataset.sisEntityId=item.id;
 emitFieldValue(input,item.value);closeStableDropdown(doc);input.focus({preventScroll:true});
}
function setStableDropdownActive(doc,index){
 const state=stableDropdownStates.get(doc);if(!state||!state.items.length)return;
 state.active=Math.max(0,Math.min(index,state.items.length-1));
 [...state.menu.querySelectorAll('.sis-stable-option')].forEach((button,i)=>button.dataset.active=i===state.active?'1':'0');
 const active=state.menu.querySelector('.sis-stable-option[data-active="1"]');
 if(active){state.input?.setAttribute('aria-activedescendant',active.id);active.scrollIntoView({block:'nearest'})}
}
function openStableDropdown(input,type,query=''){
 const doc=input.ownerDocument||document,state=stableDropdownState(doc),needle=normalizedText(query);
 const all=valuesForType(directorySync(),type),seen=new Set();
 const items=all.filter(item=>{const key=normalizedText(item.value);if(!key||seen.has(key)||needle&&!key.includes(needle))return false;seen.add(key);return true}).slice(0,200);
 state.input=input;state.type=type;state.items=items;state.active=-1;state.menu.replaceChildren();
 if(!items.length){const empty=doc.createElement('div');empty.className='sis-stable-empty';empty.textContent='لا توجد نتائج مطابقة';state.menu.appendChild(empty)}
 else items.forEach((item,index)=>{
  const button=doc.createElement('button');button.type='button';button.className='sis-stable-option';button.id='sis-option-'+Date.now()+'-'+index;button.setAttribute('role','option');
  const label=doc.createElement('span');label.textContent=item.value;button.appendChild(label);
  const details=stableOptionDetails(item,type);if(details){const small=doc.createElement('small');small.textContent=details;button.appendChild(small)}
  button.addEventListener('pointerdown',event=>{event.preventDefault();event.stopPropagation();selectStableDropdownItem(doc,index)});
  state.menu.appendChild(button);
 });
 state.menu.dataset.open='1';input.setAttribute('aria-expanded','true');positionStableDropdown(doc);
}
function bindStableDropdown(input,type){
 input.removeAttribute('list');input.setAttribute('autocomplete','off');input.setAttribute('role','combobox');input.setAttribute('aria-autocomplete','list');input.setAttribute('aria-haspopup','listbox');input.setAttribute('aria-expanded','false');
 input.dataset.sisStableDropdownType=type;
 if(input.dataset.sisStableDropdownBound==='1')return;
 input.dataset.sisStableDropdownBound='1';
 input.addEventListener('focus',()=>openStableDropdown(input,input.dataset.sisStableDropdownType,''));
 input.addEventListener('click',()=>openStableDropdown(input,input.dataset.sisStableDropdownType,''));
 input.addEventListener('input',()=>{delete input.dataset.sisSelectedValue;openStableDropdown(input,input.dataset.sisStableDropdownType,input.value)});
 input.addEventListener('keydown',event=>{
  const doc=input.ownerDocument||document,state=stableDropdownStates.get(doc);
  if(event.key==='Escape'){closeStableDropdown(doc);return}
  if(event.key==='ArrowDown'||event.key==='ArrowUp'){
   event.preventDefault();if(!state||state.input!==input)openStableDropdown(input,input.dataset.sisStableDropdownType,input.value);
   const next=stableDropdownStates.get(doc),step=event.key==='ArrowDown'?1:-1;setStableDropdownActive(doc,next.active<0?(step>0?0:next.items.length-1):next.active+step);return;
  }
  if(event.key==='Enter'&&state?.input===input&&state.active>=0){event.preventDefault();selectStableDropdownItem(doc,state.active)}
 });
}
function findRelatedField(el,type){
 const scope=el.closest('tr,.row,.form-row,.grid,.card,.form-group')||el.parentElement;
 if(!scope)return null;
 return [...scope.querySelectorAll('input,select')].find(x=>x!==el&&inferFieldType(x)===type)||null;
}
function emitFieldValue(el,value){
 const view=el?.ownerDocument?.defaultView||window;
 el.value=value;
 el.dispatchEvent(new view.Event('input',{bubbles:true}));
 el.dispatchEvent(new view.Event('change',{bubbles:true}));
}
function fillIfSafe(el,value){if(!el||!value)return;const old=safe(el.value);if(old&&!el.dataset.sisAutofilled)return;el.dataset.sisAutofilled='1';emitFieldValue(el,value)}
function attachResolution(el,type,dir){
 if(el.dataset.sisResolutionBound==='1'||!['student','teacher','employee','staff'].includes(type))return;
 el.dataset.sisResolutionBound='1';
 el.addEventListener('change',()=>{
  const match=valuesForType(directorySync(),type).find(x=>normalizedText(x.value)===normalizedText(el.value));
  if(!match?.entity){delete el.dataset.sisEntityId;delete el.dataset.sisEntityKind;return}
  el.dataset.sisEntityId=match.id;el.dataset.sisEntityKind=match.entity.kind||type;
  if(type==='student'){
   fillIfSafe(findRelatedField(el,'stage'),match.entity.stage);fillIfSafe(findRelatedField(el,'grade'),match.entity.grade);
   fillIfSafe(findRelatedField(el,'section'),match.entity.section);fillIfSafe(findRelatedField(el,'track'),match.entity.track);
   fillIfSafe(findRelatedField(el,'nationalId'),match.entity.nationalId);fillIfSafe(findRelatedField(el,'studentNumber'),match.entity.studentNumber);
  }else{
   fillIfSafe(findRelatedField(el,'jobTitle'),match.entity.jobTitle);
   fillIfSafe(findRelatedField(el,'email'),safe(match.entity.email||match.entity.user_email));
   fillIfSafe(findRelatedField(el,'phone'),safe(match.entity.phone||match.entity.mobile||match.entity.mobile_number));
   fillIfSafe(findRelatedField(el,'specialization'),safe(match.entity.specialization||match.entity.specialty));
  }
 });
}
const observedDocuments=new WeakSet();
function observeBindingRoot(doc){
 if(!doc?.body||observedDocuments.has(doc))return;
 observedDocuments.add(doc);
 const view=doc.defaultView||window;
 const observer=new view.MutationObserver(m=>{
  const meaningful=m.some(change=>{
   if(!change.addedNodes.length)return false;
   if(change.target?.closest?.('datalist[id^="sis-"],[data-sis-dropdown-root="1"]'))return false;
   return [...change.addedNodes].some(node=>{
    if(node.nodeType!==1)return false;
    if(node.matches?.('datalist[id^="sis-"],datalist[id^="sis-"] *,[data-sis-dropdown-root="1"],[data-sis-dropdown-root="1"] *'))return false;
    return true;
   });
  });
  if(!meaningful)return;
  clearTimeout(bindingTimer);bindingTimer=setTimeout(()=>bindInformationFields(doc),120);
 });
 observer.observe(doc.body,{childList:true,subtree:true});
}
function bindChildFrames(root){
 const frames=[];if(root?.querySelectorAll)frames.push(...root.querySelectorAll('iframe'));
 frames.forEach(frame=>{
  if(frame.dataset.sisFrameBound!=='1'){frame.dataset.sisFrameBound='1';frame.addEventListener('load',()=>{try{bindInformationFields(frame.contentDocument)}catch(e){console.warn('[school-information iframe binding]',e)}})}
  try{if(frame.contentDocument?.body)setTimeout(()=>bindInformationFields(frame.contentDocument),0)}catch(e){console.warn('[school-information iframe access]',e)}
 });
}
async function bindInformationFields(root=document){
 if(bindingBusy)return;bindingBusy=true;
 try{
  let dir;try{dir=await getDirectory(false)}catch(e){console.warn('[school-information bindings unavailable]',e);return}
  const doc=root?.nodeType===9?root:(root?.ownerDocument||document);
  const fields=[];if(root?.matches?.('input,select,textarea'))fields.push(root);if(root?.querySelectorAll)fields.push(...root.querySelectorAll('input,select,textarea'));
  fields.forEach(el=>{
   if(el.disabled||['hidden','password','email','date','number','file','checkbox','radio','button','submit'].includes(lower(el.type)))return;
   const type=inferFieldType(el);if(!type)return;el.dataset.sisBinding=type;
   if(RELATED_ONLY_TYPES.has(type))return;
   const items=valuesForType(dir,type);
   if(el.tagName==='SELECT'){
    const selected=el.value;el.querySelectorAll('option[data-sis-generated="1"]').forEach(o=>o.remove());
    const existing=new Set([...el.options].map(o=>normalizedText(o.value)));
    items.forEach(item=>{if(existing.has(normalizedText(item.value)))return;const o=doc.createElement('option');o.value=item.value;o.textContent=item.value;o.dataset.sisGenerated='1';if(item.id)o.dataset.entityId=item.id;el.appendChild(o)});
    if([...el.options].some(o=>o.value===selected))el.value=selected;
   }else if(el.tagName!=='TEXTAREA')bindStableDropdown(el,type);
   attachResolution(el,type,dir);
  });
  observeBindingRoot(doc);
  bindChildFrames(root);
 }finally{bindingBusy=false}
}
function refreshBindings(){return bindInformationFields(document)}
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
function canonicalStage(v){
 const t=normalizedText(v).replace(/^المرحله\s+/,'').replace(/^مرحله\s+/,'');
 if(/رياض\s*ال?اطفال|روضه|تمهيدي/.test(t))return 'kindergarten';
 if(/طفوله\s*مبكره/.test(t))return 'early';
 if(/ابتدا[يئ]/.test(t))return 'primary';
 if(/متوسط/.test(t))return 'middle';
 if(/ثانو|مسارات/.test(t))return 'high';
 return t;
}
function canonicalGrade(v){
 let t=normalizedText(v).replace(/^(المرحله|مرحله)\s+/,'').replace(/^(الصف|صف)\s+/,'');
 t=t.replace(/\s+(?:ال)?(?:ابتدا[يئ]\S*|متوسط\S*|ثانو\S*)\s*$/,'').trim();
 const rules=[[/^(ال)?اول$|^1$|^١$/,'grade_1'],[/^(ال)?ثاني$|^(ال)?ثانى$|^2$|^٢$/,'grade_2'],[/^(ال)?ثالث$|^3$|^٣$/,'grade_3'],[/^(ال)?رابع$|^4$|^٤$/,'grade_4'],[/^(ال)?خامس$|^5$|^٥$/,'grade_5'],[/^(ال)?سادس$|^6$|^٦$/,'grade_6']];
 for(const [re,key] of rules)if(re.test(t))return key;
 return t;
}
function canonicalSection(v){
 return normalizedText(v).replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/^(الفصل|فصل|الشعبه|شعبه)\s*/,'').replace(/^0+(?=\d)/,'');
}
function canonicalTrack(v){
 const t=normalizedText(v).replace(/^المسار\s+/,'');
 if(!t)return '';
 if(/عام|مشترك/.test(t))return 'general';
 if(/حاسب|هندسه/.test(t))return 'computer_engineering';
 if(/صحه|حياه/.test(t))return 'health_life';
 if(/اداره|اعمال/.test(t))return 'business';
 if(/شرعي/.test(t))return 'sharia';
 return t;
}
function studentMatchesScope(r,scope){
 const s=normalizeScope(scope);
 return (!s.stage||canonicalStage(r.stage)===canonicalStage(s.stage))
  &&(!s.grade||canonicalGrade(r.grade)===canonicalGrade(s.grade))
  &&(!s.track_name||canonicalTrack(r.track_name)===canonicalTrack(s.track_name))
  &&(!s.section_name||canonicalSection(r.section_name)===canonicalSection(s.section_name));
}
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

window.SchoolInformationSource={VERSION,refresh,load:getSnapshot,getSnapshot,getDirectory,getStudents,getStudentsByScope,getStaff,getTeachers,getAdministrativeEmployees,bindInformationFields,refreshBindings,inferFieldType,request:call,notifyUpdated,notifyStudentsUpdated,hydratePersistentCache,revalidateInBackground,
 context:()=>({systemAdmin:systemAdminRequested(),schoolId:targetSchoolId(),accessMode:systemAdminRequested()?'system_admin':'school_manager'})};
['school-information-updated','school-information:students-updated','school-information-ready','school-information-source-invalidated'].forEach(name=>window.addEventListener(name,()=>{clearTimeout(bindingTimer);bindingTimer=setTimeout(refreshBindings,80)}));
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',refreshBindings,{once:true});else setTimeout(refreshBindings,0);
})();
