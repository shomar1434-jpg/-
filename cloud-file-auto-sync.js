(function(){
 'use strict';
 const ctx=window.CloudFilePageContext;
 if(!ctx||!window.CloudFileEngine)return;
 const page=(location.pathname.split('/').pop()||'page').toLowerCase();
 const EXCLUDED_IDS=new Set(['cfUpload','importInput','archiveImportInput','cloudFile','ssCloudFile']);
 function toast(message,bad){
   let el=document.getElementById('cloudAutoSyncToast');
   if(!el){el=document.createElement('div');el.id='cloudAutoSyncToast';el.dir='rtl';el.style.cssText='position:fixed;left:18px;bottom:18px;z-index:2147483646;max-width:420px;padding:11px 15px;border-radius:12px;font:700 13px Cairo,Tajawal,Tahoma,sans-serif;box-shadow:0 12px 35px rgba(0,0,0,.18);transition:.2s;display:none';document.body.appendChild(el)}
   el.textContent=message;el.style.background=bad?'#fff0f0':'#eafaf5';el.style.color=bad?'#a61b1b':'#0a6652';el.style.border='1px solid '+(bad?'#efb7b7':'#9ddfca');el.style.display='block';clearTimeout(el._t);el._t=setTimeout(()=>el.style.display='none',4500);
 }
 function labelFor(input){
   const id=input.id;if(id){const l=document.querySelector(`label[for="${CSS.escape(id)}"]`);if(l)return (l.textContent||'').trim().slice(0,120)}
   const p=input.closest('label,.field,.form-group,.ss-field,.card');return p?(p.textContent||'').replace(/\s+/g,' ').trim().slice(0,120):'';
 }
 function shouldSkip(input){
   if(!input||input.type!=='file'||input.dataset.cloudSkip==='true'||input.classList.contains('evidence-input'))return true;
   if(EXCLUDED_IDS.has(input.id)||input.closest('#cloudFilePanel'))return true;
   const accept=String(input.accept||'').toLowerCase();
   if((/json/.test(accept)&&!/pdf|image|word|excel|sheet|presentation/.test(accept))||/import|استيراد/i.test(input.id+' '+labelFor(input)))return true;
   return false;
 }
 function recordId(input){return String(input.dataset.cloudRecordId||input.dataset.recordId||input.name||input.id||'page-root').replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,100)||'page-root'}
 document.addEventListener('change',async function(ev){
   const input=ev.target;if(shouldSkip(input))return;
   const files=[...(input.files||[])];if(!files.length)return;
   if(input.dataset.cloudSyncing==='1')return;input.dataset.cloudSyncing='1';
   try{
     toast(`جارٍ حفظ ${files.length} ملف سحابيًا...`);
     const result=await CloudFileEngine.uploadMany({
       files,
       moduleKey:ctx.moduleKey,
       ownershipScope:ctx.ownershipScope||'user',
       recordType:ctx.recordType||'page_attachment',
       recordId:recordId(input),
       relationType:'attachment',
       metadata:{source:'automatic_input_sync',page,inputId:input.id||null,inputName:input.name||null,label:labelFor(input)},
       continueOnError:true
     });
     if(result.errors.length){toast(`تم حفظ ${result.results.length} ملف، وتعذر حفظ ${result.errors.length}.`,true)}else toast(`تم حفظ ${result.results.length} ملف في التخزين السحابي.`);
     input.dataset.cloudSyncedFileIds=result.results.map(x=>x.file&&x.file.id).filter(Boolean).join(',');
     input.dispatchEvent(new CustomEvent('cloudfiles:input-synced',{bubbles:true,detail:result}));
   }catch(error){toast(error.message||'تعذر الحفظ السحابي',true)}finally{input.dataset.cloudSyncing='0'}
 },true);
})();
