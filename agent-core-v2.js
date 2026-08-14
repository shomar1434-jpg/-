(function(){
'use strict';
if(window.__SCHOOL_AGENT_CORE_V2__)return;window.__SCHOOL_AGENT_CORE_V2__=true;
const VERSION='2.0.0';
const LS={conv:'school_agent_v2_conversations',memory:'school_agent_v2_memory',audit:'school_agent_v2_audit',actions:'school_agent_v2_actions'};
const sensitive=/password|token|secret|anonkey|service_role|api[_-]?key/i;
function parse(v,d){try{return JSON.parse(v||'')}catch(e){return d}}
function clean(v){return String(v==null?'':v).replace(/\s+/g,' ').trim()}
function get(keys){for(const k of keys){try{const v=localStorage.getItem(k)||sessionStorage.getItem(k);if(v)return v}catch(e){}}return''}
function uuid(){return crypto.randomUUID?crypto.randomUUID():'a'+Date.now()+Math.random().toString(36).slice(2)}
function file(){return(location.pathname.split('/').pop()||'index.html').toLowerCase()}
const roots={manager:'leadership',agent:'agency',teacher:'performance',student_advisor:'student_advisor',health_advisor:'health_advisor',activity_leader:'activity_leader',kindergarten_teacher:'kindergarten_teacher',administrative_employee:'administrative_employee'};
function inferRoleFromFile(){const f=file();for(const k of Object.keys(roots))if(f.indexOf(k)>-1)return roots[k];if(/wakil|deputy/.test(f))return'agency';return''}
function activeYear(){return clean(get(['smartSchoolActiveAcademicYear','platformAcademicYear','academic_year','school_year']))||'1448'}
function yearStatus(y=activeYear()){try{const rows=parse(localStorage.getItem('smartSchoolAcademicYearsV1'),'[]');const r=rows.find(x=>String(x.year)===String(y));return r?.status||'active'}catch(e){return'active'}}
function context(){
 const rawRole=get(['smart_school_active_role','platform_file_session_role','currentRole','user_role','role'])||inferRoleFromFile();
 const role=(window.AgentRoleProfiles?AgentRoleProfiles.normalize(rawRole):rawRole)||'performance';
 const schoolId=get(['active_school_id','platform_file_session_school_id','current_school_id','school_id']);
 const sessionSchool=get(['platform_file_session_school_id']);
 const userId=get(['platform_file_session_user_id','currentUserId','current_user_id','user_id']);
 const membershipId=get(['smart_school_active_membership_id']);
 const schoolName=get(['current_school_name','school_name','persist_school','active_school_name']);
 const userName=get(['currentUserName','current_user_name','userName','teacherName','managerName','persist_name_m']);
 const userEmail=get(['currentUserEmail','current_user_email','userEmail','email']);
 const delegated=new URLSearchParams(location.search||'').get('delegated')==='1'||!!get(['delegated_task_id']);
 const adapter=window.AgentSectionAdapters?.current?.()||{id:'workspace',label:'مساحة العمل'};return {version:VERSION,schoolId,sessionSchoolId:sessionSchool,schoolName,userId,userName,userEmail,role,rawRole,membershipId,academicYear:activeYear(),academicYearStatus:yearStatus(),module:adapter.id,moduleLabel:adapter.label,file:file(),title:clean(document.title),url:location.pathname+location.search,delegated,taskId:new URLSearchParams(location.search||'').get('task_id')||get(['delegated_task_id'])||'',timestamp:new Date().toISOString()};
}
function assertContext(c){if(!c.schoolId)throw new Error('تعذر تحديد المدرسة الحالية. أعد الدخول أو اختر المدرسة.');if(c.sessionSchoolId&&String(c.sessionSchoolId)!==String(c.schoolId))throw new Error('تم اكتشاف اختلاف بين جلسة السحابة والمدرسة الحالية. أعد تحميل الصفحة قبل استخدام الوكيل.');return c}
function visiblePage(){const nodes=[...document.querySelectorAll('h1,h2,h3,h4,p,label,th,td,button,[data-agent-context]')].filter(x=>!x.closest('#agentV2Modal')&&x.offsetParent!==null);return nodes.map(x=>clean(x.innerText)).filter(Boolean).slice(0,140).join('\n').slice(0,12000)}
function fields(){return[...document.querySelectorAll('input,textarea,select,[contenteditable="true"]')].filter(x=>!x.closest('#agentV2Modal')&&x.type!=='password'&&x.type!=='hidden'&&!x.disabled).slice(0,100).map((x,i)=>{let label='';if(x.id){try{label=clean(document.querySelector('label[for="'+CSS.escape(x.id)+'"]')?.innerText)}catch(e){}}if(!label)label=clean(x.getAttribute('aria-label')||x.placeholder||x.name||x.id||'حقل '+(i+1));return{id:x.id||'',name:x.name||'',label,value:clean(x.value||x.innerText||'').slice(0,1000),type:x.tagName.toLowerCase()}})}
function localRecords(){
 const keys=['reports_archive','category_goals','central_school_tasks_'+context().schoolId,'meetings','readiness_data','school_readiness_data','staff_discipline_state'];const out={};
 keys.forEach(k=>{try{const v=localStorage.getItem(k);if(v)out[k]=parse(v,v)}catch(e){}});try{out.__section=window.AgentSectionAdapters?.collect?.()||{}}catch(e){}return out;
}
function scopedKey(base,c=context()){return base+':'+(c.schoolId||'none')+':'+(c.academicYear||'none')+':'+(c.userId||'anon')}
function audit(event,detail){const c=context(),row={id:uuid(),event,detail:detail||{},schoolId:c.schoolId,userId:c.userId,role:c.role,academicYear:c.academicYear,at:new Date().toISOString()};let rows=parse(localStorage.getItem(LS.audit),'[]');rows.unshift(row);localStorage.setItem(LS.audit,JSON.stringify(rows.slice(0,400)));return row}
function memory(){const c=context();return parse(localStorage.getItem(scopedKey(LS.memory,c)),'[]')}
function remember(text,tags){const c=assertContext(context()),rows=memory();rows.unshift({id:uuid(),text:clean(text).slice(0,4000),tags:tags||[],createdAt:new Date().toISOString(),schoolId:c.schoolId,academicYear:c.academicYear});localStorage.setItem(scopedKey(LS.memory,c),JSON.stringify(rows.slice(0,120)));audit('memory.add',{id:rows[0].id});return rows[0]}
function forgetMemory(id){const c=context(),rows=memory().filter(x=>x.id!==id);localStorage.setItem(scopedKey(LS.memory,c),JSON.stringify(rows));audit('memory.delete',{id})}
function conversations(){return parse(localStorage.getItem(scopedKey(LS.conv,context())),'[]')}
function saveConversation(conv){const c=context(),rows=conversations().filter(x=>x.id!==conv.id);rows.unshift(conv);localStorage.setItem(scopedKey(LS.conv,c),JSON.stringify(rows.slice(0,60)));return conv}
function proposedActions(){return parse(localStorage.getItem(scopedKey(LS.actions,context())),'[]')}
function riskFor(type){if(/delete|remove|approve|publish|send|archive_year|close_year|permission|role|school_switch/i.test(type))return'red';if(/create|update|fill|save|assign|draft/i.test(type))return'yellow';return'green'}
function proposeAction(type,payload,label){const c=assertContext(context()),a={id:uuid(),type,payload:payload||{},label:label||type,risk:riskFor(type),status:'pending',schoolId:c.schoolId,userId:c.userId,role:c.role,academicYear:c.academicYear,createdAt:new Date().toISOString()};const rows=proposedActions();rows.unshift(a);localStorage.setItem(scopedKey(LS.actions,c),JSON.stringify(rows.slice(0,100)));audit('action.proposed',{id:a.id,type:a.type,risk:a.risk});return a}
async function executeLocalAction(a){const c=assertContext(context());if(String(a.schoolId)!==String(c.schoolId)||String(a.academicYear)!==String(c.academicYear)||String(a.role)!==String(c.role))throw new Error('لا يمكن تنفيذ إجراء أُنشئ في سياق مدرسة/دور/عام مختلف.');
 if(a.type==='fill_fields'){const vals=a.payload?.fields||[];vals.forEach(v=>{let el=v.id&&document.getElementById(v.id);if(!el&&v.name)el=document.querySelector('[name="'+CSS.escape(v.name)+'"]');if(!el)return;if(el.matches('input,textarea,select')){el.value=v.value??'';el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))}else if(el.isContentEditable){el.innerText=v.value??'';el.dispatchEvent(new Event('input',{bubbles:true}))}});return{ok:true,count:vals.length}}
 if(a.type==='save_memory'){return await rememberCloud(a.payload?.text||'',a.payload?.tags||[],'user')}
 if(a.type==='create_task'||a.type==='create_task_draft'){
   if(!/leadership|agency/.test(c.role))throw new Error('إنشاء التكليفات من الوكيل متاح للمدير والوكيل فقط.');
   const base=(localStorage.getItem('smartSchoolSupabaseUrl')||'https://cijhgvbtrvmmlcssgxht.supabase.co').replace(/\/$/,'');const token=sessionToken();const r=await fetch(base+'/functions/v1/platform-tasks?action=create',{method:'POST',headers:{'content-type':'application/json','apikey':anon(),'x-platform-session':token},body:JSON.stringify(a.payload||{})});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'تعذر إنشاء التكليف.');return d;
 }
 throw new Error('هذا الإجراء يحتاج تكاملًا إضافيًا قبل تنفيذه.');
}
async function approveAction(id){const c=context(),rows=proposedActions(),a=rows.find(x=>x.id===id);if(!a)throw new Error('الإجراء غير موجود.');if(c.academicYearStatus==='archived')throw new Error('العام الدراسي الحالي مؤرشف للقراءة فقط. لا يمكن تنفيذ إجراء يغير البيانات.');const res=await executeLocalAction(a);a.status='executed';a.executedAt=new Date().toISOString();localStorage.setItem(scopedKey(LS.actions,c),JSON.stringify(rows));audit('action.executed',{id:a.id,type:a.type});return res}
function rejectAction(id){const c=context(),rows=proposedActions(),a=rows.find(x=>x.id===id);if(a){a.status='rejected';a.rejectedAt=new Date().toISOString();localStorage.setItem(scopedKey(LS.actions,c),JSON.stringify(rows));audit('action.rejected',{id:a.id,type:a.type})}}
function endpoint(){const base=(localStorage.getItem('smartSchoolSupabaseUrl')||'https://cijhgvbtrvmmlcssgxht.supabase.co').replace(/\/$/,'');return base+'/functions/v1/platform-agent'}
function anon(){return localStorage.getItem('smartSchoolSupabaseAnonKey')||'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpamhndmJ0cnZtbWxjc3NneGh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2OTY4MzUsImV4cCI6MjA5NDI3MjgzNX0.1sbfDvL1V12kj9oVcYJqYhj8NPuLpYjId7CO9QGj3bM'}
function sessionToken(){return window.PlatformCloudSession?.token?.()||get(['platform_file_session_token'])}
async function api(action,payload,opts){const c=assertContext(context()),token=sessionToken();if(!token)throw new Error('جلسة المنصة السحابية غير متاحة. سجّل الدخول مجددًا.');const body={action,context:c,payload:payload||{},client:{version:VERSION,page:{text:visiblePage(),fields:fields()},memory:memory().slice(0,20),localSummary:action==='chat'?localRecords():undefined}};const r=await fetch(endpoint(),{method:'POST',headers:{'content-type':'application/json','apikey':anon(),'x-platform-session':token},body:JSON.stringify(body)});const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||data.message||'تعذر الاتصال بوكيل المنصة.');audit('api.'+action,{requestId:data.requestId||'',tools:data.toolsUsed||[]});return data}
async function chat(message,convId){const c=assertContext(context());let conv=conversations().find(x=>x.id===convId)||{id:convId||uuid(),title:clean(message).slice(0,70)||'محادثة جديدة',messages:[],createdAt:new Date().toISOString(),schoolId:c.schoolId,role:c.role,academicYear:c.academicYear};conv.messages.push({role:'user',content:message,at:new Date().toISOString()});saveConversation(conv);const data=await api('chat',{message,conversation:conv.messages.slice(-16),conversationId:conv.id,title:conv.title});conv.messages.push({role:'assistant',content:data.answer||'',at:new Date().toISOString(),toolsUsed:data.toolsUsed||[],suggestedActions:data.suggestedActions||[]});conv.updatedAt=new Date().toISOString();saveConversation(conv);(data.suggestedActions||[]).forEach(x=>proposeAction(x.type,x.payload,x.label));return{conversation:conv,data}}
async function brief(){return api('brief',{})}
async function searchSchool(query){return api('chat',{message:'ابحث داخل بيانات المدرسة الحالية عن: '+query+'، واستخدم أداة البحث المناسبة. اعرض النتائج ذات الصلة فقط مع توضيح مصدرها، ولا تفترض شيئًا غير موجود.',conversation:[]})}
async function analyzeCurrent(){return api('analyze_current',{page:{text:visiblePage(),fields:fields()}})}
async function analyzeFile(fileObj,prompt){const max=12*1024*1024;if(fileObj.size>max)throw new Error('الحد الحالي لتحليل الملف من الواجهة 12MB.');const base64=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(String(r.result).split(',')[1]||'');r.onerror=rej;r.readAsDataURL(fileObj)});return api('file',{prompt:prompt||'حلل الملف في سياق العمل الحالي.',file:{name:fileObj.name,type:fileObj.type||'application/octet-stream',base64}})}
function proactiveSuggestions(){const c=context(),out=[];const fs=fields();const empty=fs.filter(f=>!f.value&&/اسم|عنوان|هدف|تاريخ|مدرسة|مجال|إجراء|وصف|نتيجة/.test(f.label||'')).length;if(empty>=3)out.push('يوجد '+empty+' حقول مهمة فارغة في الصفحة الحالية؛ يمكن للوكيل مساعدتك في استكمالها.');const acts=proposedActions().filter(a=>a.status==='pending').length;if(acts)out.push('لديك '+acts+' إجراء مقترح بانتظار المراجعة.');if(c.module==='readiness')out.push('يمكنني فحص الجاهزية الحالية وتحديد المهام أو الشواهد التي تحتاج متابعة.');if(c.module==='performance')out.push('يمكنني مراجعة اكتمال عناصر الأداء والشواهد قبل الحفظ.');if(c.module==='discipline')out.push('يمكنني تلخيص حركة الانضباط واكتشاف الأنماط المتكررة من البيانات المتاحة.');if(c.module==='meetings')out.push('يمكنني تحويل قرارات الاجتماع إلى مسودة مهام قابلة للمراجعة.');if(c.module==='health_advisor')out.push('يمكنني ربط التقرير بمجال الأداء الصحي والأهداف المناسبة دون الخروج عن دور التوجيه الصحي.');if(c.module==='kindergarten_teacher')out.push('يمكنني دعم تقارير رياض الأطفال وفق مجالات الأداء الـ19 دون استخدام منطق الاختبارات التقليدية.');return[...new Set(out)].slice(0,6)}
async function cloudMemory(){const d=await api('memory_list',{});return d.memories||[]}
async function rememberCloud(text,tags,scope){const d=await api('memory_add',{text,tags:tags||[],scope:scope||'user'});if(text)remember(text,tags||[]);return d.memory}
async function deleteCloudMemory(id){const d=await api('memory_delete',{id});forgetMemory(id);return d}
async function cloudHistory(){const d=await api('history',{});return d.conversations||[]}
async function cloudConversation(id){const d=await api('history_messages',{conversationId:id});return d}
function exportContext(){return{context:context(),profile:window.AgentRoleProfiles?.get(context().role)||{},page:{text:visiblePage(),fields:fields()},memory:memory(),actions:proposedActions(),audit:parse(localStorage.getItem(LS.audit),'[]').slice(0,80)}}
window.AgentCoreV2={VERSION,context,assertContext,fields,visiblePage,api,chat,brief,searchSchool,analyzeCurrent,analyzeFile,memory,remember,forgetMemory,proactiveSuggestions,cloudMemory,rememberCloud,deleteCloudMemory,cloudHistory,cloudConversation,conversations,saveConversation,proposedActions,proposeAction,approveAction,rejectAction,audit,exportContext};
window.dispatchEvent(new CustomEvent('agent-core-v2-ready',{detail:{version:VERSION}}));
})();
