(function(){
  'use strict';
  const VERSION='3.2.0-reviewer-preview-merged';
  const DEFAULT_TIMEOUT=45000;
  const cfg={
    base:()=> (localStorage.getItem('smartSchoolSupabaseUrl')||'https://cijhgvbtrvmmlcssgxht.supabase.co').replace(/\/$/,'')+'/functions/v1/platform-files',
    anon:()=>localStorage.getItem('smartSchoolSupabaseAnonKey')||'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpamhndmJ0cnZtbWxjc3NneGh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2OTY4MzUsImV4cCI6MjA5NDI3MjgzNX0.1sbfDvL1V12kj9oVcYJqYhj8NPuLpYjId7CO9QGj3bM',
    token:()=>window.PlatformCloudSession?.token?.()||sessionStorage.getItem('platform_tab_session_token_v1')||localStorage.getItem('platform_file_session_token')||''
  };
  function emit(name,detail){try{window.dispatchEvent(new CustomEvent('cloudfiles:'+name,{detail}))}catch(_){} }

  function readJsonStorage(key){try{return JSON.parse(localStorage.getItem(key)||'null')}catch(_){return null}}
  function firstValue(){for(const v of arguments){if(v!==undefined&&v!==null&&String(v).trim()!=='')return v}return ''}
  function currentSchoolId(){return firstValue(localStorage.getItem('activeSchoolId'),localStorage.getItem('school_id'),localStorage.getItem('currentSchoolId'))}
  function evidenceContext(){try{const c=window.EvidenceReviewContext;return typeof c==='function'?(c()||{}):(c||{})}catch(_){return {}}}
  function directSupervisor(){
    const keys=['platform_direct_supervisor','direct_supervisor','current_user_supervisor','registration_supervisor','account_supervisor'];
    for(const k of keys){const v=readJsonStorage(k);if(v&&typeof v==='object')return v}
    return {};
  }
  function enrichReviewMetadata(o){
    const meta=Object.assign({},o&&o.metadata||{}), ctx=evidenceContext(), sup=directSupervisor();
    const reviewerId=firstValue(meta.reviewer_id,meta.requester_id,meta.supervisor_id,o&&o.reviewerId,ctx.reviewer_id,ctx.requester_id,ctx.supervisor_id,sup.id,sup.user_id);
    const reviewerEmail=firstValue(meta.reviewer_email,meta.requester_email,meta.supervisor_email,o&&o.reviewerEmail,ctx.reviewer_email,ctx.requester_email,ctx.supervisor_email,sup.email);
    const reviewerRole=firstValue(meta.reviewer_role,meta.requester_role,meta.supervisor_role,o&&o.reviewerRole,ctx.reviewer_role,ctx.requester_role,ctx.supervisor_role,sup.role);
    const reviewerName=firstValue(meta.reviewer_name,meta.requester_name,meta.supervisor_name,o&&o.reviewerName,ctx.reviewer_name,ctx.requester_name,ctx.supervisor_name,sup.name,sup.full_name);
    meta.school_id=firstValue(meta.school_id,ctx.school_id,currentSchoolId());
    if(reviewerId)meta.reviewer_id=String(reviewerId);
    if(reviewerEmail)meta.reviewer_email=String(reviewerEmail).toLowerCase();
    if(reviewerRole)meta.reviewer_role=String(reviewerRole);
    if(reviewerName)meta.reviewer_name=String(reviewerName);
    if(meta.reviewer_id||meta.reviewer_email){meta.review_status=meta.review_status||'pending_review';meta.review_contract='requester_is_reviewer_v1'}
    return meta;
  }
  function viewedKey(fileId){return 'evidence_viewed:'+currentSchoolId()+':'+String(fileId||'')}
  function markEvidenceViewed(fileId){if(!fileId)return;try{sessionStorage.setItem(viewedKey(fileId),new Date().toISOString())}catch(_){}}
  function wasEvidenceViewed(fileId){try{return !!sessionStorage.getItem(viewedKey(fileId))}catch(_){return false}}
  function markPreviewed(fileId){markEvidenceViewed(fileId);try{emit('previewed',{fileId:String(fileId||''),at:new Date().toISOString()})}catch(_){}}
  function wasPreviewed(fileId){return wasEvidenceViewed(fileId)}
  function allPreviewed(fileIds){const ids=[...(fileIds||[])].filter(Boolean);return !ids.length||ids.every(wasPreviewed)}

  async function ensureSession(){
    if(window.PlatformCloudSession&&typeof window.PlatformCloudSession.ensure==='function'){
      await window.PlatformCloudSession.ensure();
      if(cfg.token())return cfg.token();
    }
    if(cfg.token())return cfg.token();
    throw new Error('تعذر استعادة الجلسة السحابية تلقائيًا.');
  }
  async function request(action,{method='POST',body,form,timeout=DEFAULT_TIMEOUT,signal}={}){
    await ensureSession();
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),timeout);
    if(signal)signal.addEventListener('abort',()=>controller.abort(),{once:true});
    const headers={apikey:cfg.anon(),'x-platform-session':cfg.token(),'x-client-version':VERSION};
    let payload;
    if(form){payload=form}else if(body!==undefined){headers['content-type']='application/json';payload=JSON.stringify(body)}
    emit('request',{action});
    try{
      const send=async()=>{
        headers['x-platform-session']=cfg.token();
        const r=await fetch(`${cfg.base()}?action=${encodeURIComponent(action)}`,{method,headers,body:payload,signal:controller.signal});
        const j=await r.json().catch(()=>({}));
        return {r,j};
      };
      let res=await send();
      if(res.r.status===401&&window.PlatformCloudSession&&typeof window.PlatformCloudSession.recover==='function'){
        await window.PlatformCloudSession.recover();
        res=await send();
      }
      if(!res.r.ok)throw new Error(res.j.error||`فشلت عملية الملفات (${res.r.status})`);
      emit('success',{action,response:res.j});
      return res.j;
    }catch(e){
      const err=e&&e.name==='AbortError'?new Error('انتهت مهلة الاتصال بمحرك الملفات.'):e;
      emit('error',{action,error:err});
      throw err;
    }finally{clearTimeout(timer)}
  }
  async function upload(o){
    if(!o||!o.file)throw new Error('لم يتم اختيار ملف');
    const f=new FormData();f.append('file',o.file);
    ['ownershipScope','moduleKey','folderId','recordType','recordId','relationType','displayName','replaceFileId'].forEach(k=>o[k]!=null&&f.append(k,String(o[k])));
    const enrichedMetadata=enrichReviewMetadata(o); if(Object.keys(enrichedMetadata).length)f.append('metadata',JSON.stringify(enrichedMetadata));
    return request('upload',{form:f,timeout:o.timeout||120000,signal:o.signal});
  }
  async function uploadMany(options){
    const files=[...(options.files||[])], results=[], errors=[];
    for(let i=0;i<files.length;i++){
      try{const r=await upload({...options,file:files[i],files:undefined});results.push(r);options.onProgress&&options.onProgress({index:i+1,total:files.length,file:files[i],result:r})}
      catch(error){errors.push({file:files[i],error});options.onProgress&&options.onProgress({index:i+1,total:files.length,file:files[i],error});if(!options.continueOnError)throw error}
    }
    return {results,errors,total:files.length};
  }
  const list=o=>request('list',{body:o||{}});
  const listByLink=o=>request('list-by-link',{body:o||{}});
  const listFolders=o=>request('list-folders',{body:o||{}});
  const createFolder=o=>request('create-folder',{body:o});
  const renameFolder=(folderId,folderName)=>request('rename-folder',{body:{folderId,folderName}});
  const trashFolder=(folderId,recursive=false)=>request('trash-folder',{body:{folderId,recursive}});
  const restoreFolder=folderId=>request('restore-folder',{body:{folderId}});
  const renameFile=(fileId,displayName)=>request('rename-file',{body:{fileId,displayName}});
  const moveFile=(fileId,folderId)=>request('move-file',{body:{fileId,folderId:folderId||null}});
  const signedUrl=(fileId,expiresIn=300)=>request('signed-url',{body:{fileId,expiresIn}});
  const trash=fileId=>request('trash',{body:{fileId}});
  const restore=fileId=>request('restore',{body:{fileId}});
  const purge=fileId=>request('purge',{body:{fileId}});
  const link=o=>request('link',{body:o});
  const unlink=linkId=>request('unlink',{body:{linkId}});
  const usage=fileId=>request('usage',{body:{fileId}});
  const audit=o=>request('audit',{body:o||{}});
  const stats=o=>request('stats',{body:o||{}});
  const health=()=>request('health',{method:'GET'});
  async function getBlob(fileId){const x=await signedUrl(fileId);const r=await fetch(x.signedUrl);if(!r.ok)throw new Error('تعذر قراءة الملف');return r.blob()}
  async function open(fileId){const x=await signedUrl(fileId);markPreviewed(fileId);window.open(x.signedUrl,'_blank','noopener,noreferrer');return x}
  async function download(fileId,fileName){const blob=await getBlob(fileId);const u=URL.createObjectURL(blob);const a=document.createElement('a');a.href=u;a.download=fileName||'file';a.click();setTimeout(()=>URL.revokeObjectURL(u),2000)}
  window.CloudFileEngine={VERSION,request,upload,uploadMany,list,listByLink,listFolders,createFolder,renameFolder,trashFolder,restoreFolder,renameFile,moveFile,signedUrl,trash,restore,purge,link,unlink,usage,audit,stats,health,getBlob,open,download,enrichReviewMetadata,markEvidenceViewed,wasEvidenceViewed,markPreviewed,wasPreviewed,allPreviewed};
  window.EvidenceReviewEngine=window.EvidenceReviewEngine||{
    VERSION:'1.1.0-reviewer-preview-merged',
    open:fileId=>open(fileId),
    wasPreviewed,
    allPreviewed,
    requirePreview(fileIds){
      const ids=[...(fileIds||[])].filter(Boolean);
      if(ids.length&&!allPreviewed(ids))throw new Error('يجب فتح الشاهد/الشواهد للمعاينة قبل اتخاذ قرار المراجعة.');
      return true;
    },
    requireDecisionNote(decision,note){
      if(['returned','rejected'].includes(String(decision||''))&&!String(note||'').trim())throw new Error(decision==='returned'?'اكتب سبب إعادة الشاهد للاستكمال.':'اكتب سبب عدم اعتماد التنفيذ.');
      return String(note||'').trim();
    }
  };
  function evidenceIdsInContext(node){
    const box=node?.closest?.('[data-evidence-review],.evidence-card,.weeklyEvidenceCard,.taskCard,.card,.modal,[role="dialog"],form,article,section,tr')||node?.parentElement;
    if(!box||!/شاهد|شواهد|evidence|إثبات|اثبات/i.test(box.textContent||''))return [];
    const ids=new Set();
    box.querySelectorAll?.('[data-platform-file-id],[data-evidence-file-id],[data-els-open]').forEach(el=>{const id=el.dataset.platformFileId||el.dataset.evidenceFileId||el.dataset.elsOpen;if(id)ids.add(String(id));});
    box.querySelectorAll?.('[onclick]').forEach(el=>{const x=el.getAttribute('onclick')||'';const m=x.match(/(?:CloudFileEngine|EvidenceReviewEngine)\.open\(\s*['"]([^'"]+)['"]/);if(m)ids.add(m[1]);});
    return [...ids];
  }
  if(!window.__EVIDENCE_REVIEW_CAPTURE_GATE_V1__){
    window.__EVIDENCE_REVIEW_CAPTURE_GATE_V1__=true;
    document.addEventListener('click',function(ev){
      const b=ev.target?.closest?.('button,[role="button"],input[type="button"],input[type="submit"],a');if(!b)return;
      const label=String(b.textContent||b.value||b.getAttribute('aria-label')||'').trim();
      if(!/(اعتماد|عدم اعتماد|رفض|إعادة.*(?:استكمال|تعديل)|قبول التنفيذ)/.test(label))return;
      const ids=evidenceIdsInContext(b);if(!ids.length||allPreviewed(ids))return;
      ev.preventDefault();ev.stopImmediatePropagation();
      alert('يجب فتح الشاهد/الشواهد للمعاينة قبل اتخاذ قرار الاعتماد أو الإعادة أو عدم الاعتماد.');
    },true);
  }

})();
