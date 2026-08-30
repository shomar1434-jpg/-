(function(){
'use strict';
if(window.PlatformRecordSaveEngine)return;
const VERSION='2.1.0-records-final-performance';
const safe=v=>String(v==null?'':v).trim();
const clean=v=>safe(v).replace(/[^\p{L}\p{N}._:@/\-]+/gu,'_').slice(0,160);
function isSystemAdminContext(){
  try{
    const q=new URLSearchParams(location.search||'');
    const role=safe(sessionStorage.getItem('smart_school_tab_role_v1')||localStorage.getItem('currentRole')||localStorage.getItem('smart_school_active_role')).toLowerCase();
    return q.get('systemAdmin')==='1'||q.get('mode')==='system_admin'||document.documentElement?.getAttribute('data-system-admin-context')==='1'||sessionStorage.getItem('system_admin_context')==='1'||sessionStorage.getItem('system_admin_verified')==='true'||['system_admin','system-admin','super_admin','platform_admin'].includes(role);
  }catch(_){return false}
}
function schoolId(){
 const q=new URLSearchParams(location.search||'');
 const explicit=safe(q.get('schoolId')||q.get('school_id'));
 if(explicit)return explicit;
 const tab=safe(sessionStorage.getItem('smart_school_tab_school_v1')||sessionStorage.getItem('current_school_id'));
 if(tab)return tab;
 if(!isSystemAdminContext()){
   try{const c=safe(window.PlatformCloudSession?.schoolId?.()||'');if(c)return c}catch(_){}
 }
 return isSystemAdminContext()?'':safe(localStorage.getItem('current_school_id')||localStorage.getItem('school_id')||localStorage.getItem('smart_school_id')||'');
}
function userId(){return safe(window.PlatformCloudSession?.userId?.()||sessionStorage.getItem('currentUserId')||localStorage.getItem('currentUserId')||'')}
function year(v){const m=safe(v).match(/\d{4}/);return m?m[0]:(safe(v)||'unspecified')}
function semester(v){const n=safe(v).replace(/\s+/g,' ');if(/الأول|الاول|semester[_ -]?1|^1$/.test(n))return 'semester_1';if(/الثاني|semester[_ -]?2|^2$/.test(n))return 'semester_2';if(/الثالث|semester[_ -]?3|^3$/.test(n))return 'semester_3';return clean(n||'annual')}
function recordKey(o){return `record_v1:${clean(o.recordType)}:${year(o.academicYear)}:${semester(o.semester)}:${clean(o.recordId)}`}
function indexKey(o){return `record_index_v1:${clean(o.recordType)}:${year(o.academicYear)}:${semester(o.semester)}`}
function prefix(o){return `record_v1:${clean(o.recordType)}:`}
function parseValue(item){try{const raw=item?.payload?.value;return raw==null?null:JSON.parse(raw)}catch(_){return null}}
async function ensure(){
 if(isSystemAdminContext())throw new Error('لا يسمح بحفظ سجلات المدارس من سياق مدير النظام');
 if(!window.PlatformStateEngine)throw new Error('محرك الحالة السحابية غير متاح');
 if(window.PlatformCloudSession?.ensure)await PlatformCloudSession.ensure();
 const sid=schoolId();if(!sid)throw new Error('معرف المدرسة غير متاح');
 const cloud=safe(window.PlatformCloudSession?.schoolId?.()||'');if(!cloud||cloud!==sid)throw new Error('جلسة السحابة لا تطابق المدرسة المفتوحة');
 if(window.PlatformCloudSession?.memberships){
   try{const m=await PlatformCloudSession.memberships();const rows=m?.memberships||[];if(rows.length&&!rows.some(x=>safe(x.schoolId)===sid&&safe(x.status||'active').toLowerCase()==='active'))throw new Error('عضوية المستخدم في المدرسة غير فعالة')}catch(e){if(/عضوية المستخدم/.test(safe(e?.message)))throw e}
 }
 return sid;
}
async function request(action,body){return PlatformStateEngine.request(action,body)}
async function pull(moduleKey,scope,keys){const sid=await ensure();const body={moduleKey,scope:scope||'user',expectedSchoolId:sid};if(Array.isArray(keys))body.keys=keys;return request('pull',body)}
async function getIndex(o){const k=indexKey(o),r=await pull(o.moduleKey,o.scope||'user',[k]),it=(r.items||[]).find(x=>x.state_key===k&&!x.deleted_at);const v=parseValue(it);return Array.isArray(v)?v:[]}
async function save(o){
 const sid=await ensure(),now=new Date().toISOString(),scope=o.scope||'user',rk=recordKey(o),ik=indexKey(o),existing=await getIndex(o);
 const meta={id:safe(o.recordId),recordType:safe(o.recordType),title:safe(o.title),folderId:safe(o.folderId),entityId:safe(o.entityId),entityType:safe(o.entityType),academicYear:year(o.academicYear),semester:semester(o.semester),schoolId:sid,ownerUserId:userId(),updatedAt:now,createdAt:safe(o.createdAt)||now};
 const lightweight={...meta,size:JSON.stringify(o.data||{}).length};const pos=existing.findIndex(x=>safe(x.id)===meta.id);if(pos>=0)existing[pos]={...existing[pos],...lightweight};else existing.unshift(lightweight);
 const payload={meta,data:o.data||{},savedAt:now,version:VERSION};
 const w=await request('bulk-upsert',{moduleKey:o.moduleKey,scope,items:[{key:rk,value:JSON.stringify(payload)},{key:ik,value:JSON.stringify(existing.slice(0,1000))}],expectedSchoolId:sid});
 if(!w||w.ok===false)throw new Error(w?.error||'تعذر حفظ السجل سحابيًا');
 const vr=await pull(o.moduleKey,scope,[rk,ik]),rec=(vr.items||[]).find(x=>x.state_key===rk&&!x.deleted_at),idx=(vr.items||[]).find(x=>x.state_key===ik&&!x.deleted_at),parsed=parseValue(rec),idxParsed=parseValue(idx);
 if(!parsed||safe(parsed?.meta?.id)!==meta.id||safe(parsed?.meta?.schoolId)!==sid||!Array.isArray(idxParsed)||!idxParsed.some(x=>safe(x.id)===meta.id))throw new Error('فشل التحقق من السجل بعد الحفظ السحابي');
 return {ok:true,record:parsed,index:idxParsed,recordKey:rk,indexKey:ik};
}
async function load(o){const rk=recordKey(o),r=await pull(o.moduleKey,o.scope||'user',[rk]),it=(r.items||[]).find(x=>x.state_key===rk&&!x.deleted_at),v=parseValue(it);if(v&&safe(v?.meta?.schoolId)!==schoolId())throw new Error('السجل لا يطابق المدرسة المفتوحة');return v}
async function list(o){const idx=await getIndex(o);if(!idx.length)return[];const keys=idx.map(x=>recordKey({...o,recordId:x.id})),r=await pull(o.moduleKey,o.scope||'user',keys),map=new Map((r.items||[]).filter(x=>!x.deleted_at).map(x=>[x.state_key,parseValue(x)]));return idx.map(x=>map.get(recordKey({...o,recordId:x.id}))).filter(x=>x&&safe(x?.meta?.schoolId)===schoolId())}
async function listAll(o){
 const sid=await ensure(),r=await request('pull',{moduleKey:o.moduleKey,scope:o.scope||'user',expectedSchoolId:sid}),p=prefix(o),rows=[];
 for(const item of (r.items||[])){if(item.deleted_at||!safe(item.state_key).startsWith(p))continue;const v=parseValue(item);if(v&&safe(v?.meta?.schoolId)===sid&&(!o.recordType||safe(v?.meta?.recordType)===safe(o.recordType)))rows.push(v)}
 rows.sort((a,b)=>String(b?.meta?.updatedAt||b?.savedAt||'').localeCompare(String(a?.meta?.updatedAt||a?.savedAt||'')));return rows;
}
async function remove(o){
 const sid=await ensure(),scope=o.scope||'user',rk=recordKey(o),ik=indexKey(o),idx=await getIndex(o),next=idx.filter(x=>safe(x.id)!==safe(o.recordId));
 const w=await request('bulk-upsert',{moduleKey:o.moduleKey,scope,items:[{key:rk,deleted:true},{key:ik,value:JSON.stringify(next)}],expectedSchoolId:sid});if(!w||w.ok===false)throw new Error(w?.error||'تعذر حذف السجل سحابيًا');
 const vr=await pull(o.moduleKey,scope,[rk,ik]),rec=(vr.items||[]).find(x=>x.state_key===rk),idxItem=(vr.items||[]).find(x=>x.state_key===ik&&!x.deleted_at),idxParsed=parseValue(idxItem);if(!rec?.deleted_at||!Array.isArray(idxParsed)||idxParsed.some(x=>safe(x.id)===safe(o.recordId)))throw new Error('فشل التحقق من الحذف السحابي');return {ok:true,index:idxParsed};
}
window.PlatformRecordSaveEngine={VERSION,isSystemAdminContext,schoolId,userId,year,semester,recordKey,indexKey,save,load,list,listAll,remove};
})();