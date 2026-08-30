(function(){
'use strict';
if(window.PlatformRecordSaveEngine)return;
const VERSION='4.0.0-performance-style-fast-save';
const safe=v=>String(v==null?'':v).trim();
const clean=v=>safe(v).replace(/[^\p{L}\p{N}._:@/\-]+/gu,'_').slice(0,160);

function isSystemAdminContext(){
  try{
    const r=safe(sessionStorage.getItem('smart_school_tab_role_v1')||
      localStorage.getItem('currentRole')||
      localStorage.getItem('smart_school_active_role')).toLowerCase();
    return ['system_admin','system-admin','super_admin','platform_admin'].includes(r);
  }catch(_){return false}
}
function schoolId(){
  const q=new URLSearchParams(location.search||'');
  return safe(q.get('schoolId')||q.get('school_id')||
    sessionStorage.getItem('smart_school_tab_school_v1')||
    (window.PlatformCloudSession?.schoolId?.()||'')||
    localStorage.getItem('current_school_id')||
    localStorage.getItem('school_id')||'');
}
function userId(){
  return safe(window.PlatformCloudSession?.userId?.()||
    sessionStorage.getItem('currentUserId')||
    localStorage.getItem('currentUserId')||'');
}
function year(v){
  const m=safe(v).match(/\d{4}/);
  return m?m[0]:(safe(v)||'unspecified');
}
function semester(v){
  const n=safe(v).replace(/\s+/g,' ');
  if(/الأول|الاول|semester_1/.test(n))return 'semester_1';
  if(/الثاني|semester_2/.test(n))return 'semester_2';
  if(/الثالث|semester_3/.test(n))return 'semester_3';
  return clean(n||'annual');
}
function recordKey(o){
  return `record_v1:${clean(o.recordType)}:${year(o.academicYear)}:${semester(o.semester)}:${clean(o.recordId)}`;
}
function metaKey(o){
  return `record_meta_v2:${clean(o.recordType)}:${year(o.academicYear)}:${semester(o.semester)}:${clean(o.recordId)}`;
}
function indexKey(o){
  // أبقي للاعتمادية الخلفية فقط.
  return `record_index_v1:${clean(o.recordType)}:${year(o.academicYear)}:${semester(o.semester)}`;
}
async function ensure(expectedSchoolId){
  if(isSystemAdminContext())throw new Error('لا يسمح بحفظ سجلات المدارس من سياق مدير النظام');
  if(!window.PlatformStateEngine)throw new Error('محرك الحالة السحابية غير متاح');
  if(window.PlatformCloudSession?.ensure)await PlatformCloudSession.ensure();
  const sid=schoolId();
  if(!sid)throw new Error('معرف المدرسة غير متاح');
  const cloud=safe(window.PlatformCloudSession?.schoolId?.()||'');
  if(cloud&&cloud!==sid)throw new Error('جلسة السحابة لا تطابق المدرسة المفتوحة');
  if(expectedSchoolId&&safe(expectedSchoolId)!==sid)throw new Error('STATE_SCHOOL_CONTEXT_MISMATCH');
  return sid;
}
function parseValue(item){
  try{return item?.payload?.value?JSON.parse(item.payload.value):null}catch(_){return null}
}
async function pull(moduleKey,scope,keys){
  const sid=await ensure();
  if(typeof PlatformStateEngine.pull==='function'){
    const r=await PlatformStateEngine.pull(moduleKey,scope||'user',keys);
    return {items:Array.isArray(r)?r:(r?.items||r?.rows||[])};
  }
  return PlatformStateEngine.request('pull',{moduleKey,scope:scope||'user',keys,expectedSchoolId:sid});
}
async function bulkWrite(moduleKey,scope,items,sid,timeout=15000){
  if(typeof PlatformStateEngine.bulkUpsert==='function'){
    const r=await PlatformStateEngine.bulkUpsert(moduleKey,scope||'user',items,{timeout});
    if(r?.ok===false)throw new Error(r.error||'تعذر حفظ السجل سحابيًا');
    return r;
  }
  const r=await PlatformStateEngine.request('bulk-upsert',
    {moduleKey,scope:scope||'user',items,expectedSchoolId:sid},{timeout});
  if(r?.ok===false)throw new Error(r.error||'تعذر حفظ السجل سحابيًا');
  return r;
}
async function save(o){
  const sid=await ensure(o.expectedSchoolId);
  const scope=o.scope||'user';
  const rk=recordKey(o), mk=metaKey(o), now=new Date().toISOString();
  const meta={
    id:safe(o.recordId),recordType:safe(o.recordType),schoolId:sid,userId:userId(),
    academicYear:year(o.academicYear),semester:semester(o.semester),
    folderId:safe(o.folderId),title:safe(o.title),
    createdAt:o.createdAt||now,updatedAt:now
  };
  const payload={meta,data:o.data||{},savedAt:now,version:VERSION};
  // نفس مبدأ Performance V5: كتابة السجل الكامل + وصف خفيف في دفعة واحدة، بلا pull مسبق.
  await bulkWrite(o.moduleKey,scope,[
    {key:rk,value:JSON.stringify(payload),deleted:false},
    {key:mk,value:JSON.stringify(meta),deleted:false}
  ],sid,15000);

  // التحقق منفصل وغير حاجب لمسار الحفظ.
  const verification=(async()=>{
    const vr=await pull(o.moduleKey,scope,[rk,mk]);
    const rec=(vr.items||[]).find(x=>x.state_key===rk&&!x.deleted_at);
    const metaItem=(vr.items||[]).find(x=>x.state_key===mk&&!x.deleted_at);
    const parsed=parseValue(rec), parsedMeta=parseValue(metaItem);
    if(!parsed||
       safe(parsed?.meta?.id)!==meta.id||
       safe(parsed?.meta?.schoolId)!==sid||
       !parsedMeta||
       safe(parsedMeta.id)!==meta.id||
       safe(parsedMeta.schoolId)!==sid){
      throw new Error('لم يكتمل التحقق السحابي للسجل');
    }
    return {ok:true,record:parsed,meta:parsedMeta};
  })();

  return {ok:true,accepted:true,recordKey:rk,metaKey:mk,meta,verification};
}
async function load(o){
  const rk=recordKey(o);
  const r=await pull(o.moduleKey,o.scope||'user',[rk]);
  const it=(r.items||[]).find(x=>x.state_key===rk&&!x.deleted_at);
  return parseValue(it);
}
async function listAll(o){
  const sid=await ensure();
  const scope=o.scope||'user';
  const prefix='record_v1:'+clean(o.recordType)+':';
  let r;
  if(typeof PlatformStateEngine.request==='function'){
    r=await PlatformStateEngine.request('pull',{moduleKey:o.moduleKey,scope,prefix,expectedSchoolId:sid});
  }else{
    throw new Error('محرك قراءة السجلات لا يدعم القراءة بالمقدمة');
  }
  if(!r||r.ok===false)throw new Error(r?.error||'تعذر تحميل السجلات السحابية');
  return (r.items||[]).filter(x=>!x.deleted_at&&String(x.state_key||'').startsWith(prefix)).map(parseValue).filter(Boolean);
}
async function list(o){
  const all=await listAll(o);
  const ay=year(o.academicYear),sem=semester(o.semester);
  return all.filter(x=>year(x?.meta?.academicYear)===ay&&semester(x?.meta?.semester)===sem);
}
async function remove(o){
  const sid=await ensure(o.expectedSchoolId);
  const scope=o.scope||'user', rk=recordKey(o), mk=metaKey(o);
  await bulkWrite(o.moduleKey,scope,[{key:rk,deleted:true},{key:mk,deleted:true}],sid,15000);
  const verification=(async()=>{
    const vr=await pull(o.moduleKey,scope,[rk,mk]);
    const rec=(vr.items||[]).find(x=>x.state_key===rk);
    const meta=(vr.items||[]).find(x=>x.state_key===mk);
    if(!rec?.deleted_at||!meta?.deleted_at)throw new Error('لم يكتمل التحقق السحابي من الحذف');
    return {ok:true};
  })();
  return {ok:true,accepted:true,verification};
}
window.PlatformRecordSaveEngine={
  VERSION,schoolId,userId,year,semester,recordKey,indexKey,metaKey,
  isSystemAdminContext,save,load,list,listAll,remove
};
})();