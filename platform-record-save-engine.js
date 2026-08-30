(function(){
'use strict';
if(window.PlatformRecordSaveEngine)return;
const VERSION='1.0.0-records-phase1';
const safe=v=>String(v==null?'':v).trim();
const clean=v=>safe(v).replace(/[^\p{L}\p{N}._:@/\-]+/gu,'_').slice(0,160);
function schoolId(){
 const q=new URLSearchParams(location.search||'');
 return safe(q.get('schoolId')||q.get('school_id')||sessionStorage.getItem('smart_school_tab_school_v1')||(window.PlatformCloudSession?.schoolId?.()||'')||localStorage.getItem('current_school_id')||localStorage.getItem('school_id')||'');
}
function userId(){return safe(window.PlatformCloudSession?.userId?.()||sessionStorage.getItem('currentUserId')||localStorage.getItem('currentUserId')||'')}
function year(v){const m=safe(v).match(/\d{4}/);return m?m[0]:(safe(v)||'unspecified')}
function semester(v){const n=safe(v).replace(/\s+/g,' ');if(/الأول|الاول/.test(n))return 'semester_1';if(/الثاني/.test(n))return 'semester_2';if(/الثالث/.test(n))return 'semester_3';return clean(n||'annual')}
function recordKey(o){return `record_v1:${clean(o.recordType)}:${year(o.academicYear)}:${semester(o.semester)}:${clean(o.recordId)}`}
function indexKey(o){return `record_index_v1:${clean(o.recordType)}:${year(o.academicYear)}:${semester(o.semester)}`}
async function ensure(){if(!window.PlatformStateEngine)throw new Error('محرك الحالة السحابية غير متاح');if(window.PlatformCloudSession?.ensure)await PlatformCloudSession.ensure();const sid=schoolId();if(!sid)throw new Error('معرف المدرسة غير متاح');const cloud=safe(window.PlatformCloudSession?.schoolId?.()||'');if(cloud&&cloud!==sid)throw new Error('جلسة السحابة لا تطابق المدرسة المفتوحة');return sid}
function parseValue(item){try{return item?.payload?.value?JSON.parse(item.payload.value):null}catch(_){return null}}
async function pull(moduleKey,scope,keys){const sid=await ensure();return PlatformStateEngine.request('pull',{moduleKey,scope:scope||'user',keys,expectedSchoolId:sid})}
async function getIndex(o){const k=indexKey(o),r=await pull(o.moduleKey,o.scope||'user',[k]),it=(r.items||[]).find(x=>x.state_key===k&&!x.deleted_at);const v=parseValue(it);return Array.isArray(v)?v:[]}
async function save(o){
 const sid=await ensure();const now=new Date().toISOString();const scope=o.scope||'user';const rk=recordKey(o),ik=indexKey(o);const existing=await getIndex(o);
 const meta={id:safe(o.recordId),recordType:safe(o.recordType),title:safe(o.title),folderId:safe(o.folderId),academicYear:year(o.academicYear),semester:semester(o.semester),schoolId:sid,ownerUserId:userId(),updatedAt:now,createdAt:safe(o.createdAt)||now};
 const pos=existing.findIndex(x=>safe(x.id)===meta.id);const lightweight=Object.assign({},meta,{size:JSON.stringify(o.data||{}).length});if(pos>=0)existing[pos]=Object.assign({},existing[pos],lightweight);else existing.unshift(lightweight);
 const payload={meta,data:o.data||{},savedAt:now,version:VERSION};
 const items=[{key:rk,value:JSON.stringify(payload)},{key:ik,value:JSON.stringify(existing.slice(0,1000))}];
 const w=await PlatformStateEngine.request('bulk-upsert',{moduleKey:o.moduleKey,scope,items,expectedSchoolId:sid});if(!w||w.ok===false)throw new Error(w?.error||'تعذر حفظ السجل سحابيًا');
 const vr=await pull(o.moduleKey,scope,[rk,ik]);const rec=(vr.items||[]).find(x=>x.state_key===rk&&!x.deleted_at),idx=(vr.items||[]).find(x=>x.state_key===ik&&!x.deleted_at);const parsed=parseValue(rec),idxParsed=parseValue(idx);
 if(!parsed||safe(parsed?.meta?.id)!==meta.id||safe(parsed?.meta?.schoolId)!==sid||!Array.isArray(idxParsed)||!idxParsed.some(x=>safe(x.id)===meta.id))throw new Error('فشل التحقق من السجل بعد الحفظ السحابي');
 return {
    isSystemAdminContext,ok:true,record:parsed,index:idxParsed,recordKey:rk,indexKey:ik};
}
async function load(o){const rk=recordKey(o),r=await pull(o.moduleKey,o.scope||'user',[rk]),it=(r.items||[]).find(x=>x.state_key===rk&&!x.deleted_at);return parseValue(it)}
async function list(o){const idx=await getIndex(o);if(!idx.length)return[];const keys=idx.map(x=>recordKey(Object.assign({},o,{recordId:x.id})));const r=await pull(o.moduleKey,o.scope||'user',keys);const map=new Map((r.items||[]).filter(x=>!x.deleted_at).map(x=>[x.state_key,parseValue(x)]));return idx.map(x=>map.get(recordKey(Object.assign({},o,{recordId:x.id})))).filter(Boolean)}
async function remove(o){const sid=await ensure();const scope=o.scope||'user',rk=recordKey(o),ik=indexKey(o),idx=await getIndex(o),next=idx.filter(x=>safe(x.id)!==safe(o.recordId));const w=await PlatformStateEngine.request('bulk-upsert',{moduleKey:o.moduleKey,scope,items:[{key:rk,deleted:true},{key:ik,value:JSON.stringify(next)}],expectedSchoolId:sid});if(!w||w.ok===false)throw new Error(w?.error||'تعذر حذف السجل سحابيًا');const vr=await pull(o.moduleKey,scope,[rk,ik]);const rec=(vr.items||[]).find(x=>x.state_key===rk),idxItem=(vr.items||[]).find(x=>x.state_key===ik&&!x.deleted_at),idxParsed=parseValue(idxItem);if(!rec?.deleted_at||!Array.isArray(idxParsed)||idxParsed.some(x=>safe(x.id)===safe(o.recordId)))throw new Error('فشل التحقق من الحذف السحابي');return {ok:true,index:idxParsed}}
window.PlatformRecordSaveEngine={VERSION,schoolId,userId,year,semester,recordKey,indexKey,save,load,list,remove};
})();
