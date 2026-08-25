(function(){
'use strict';
if(window.__PLATFORM_ARCHIVE_CRUD_V1__)return;window.__PLATFORM_ARCHIVE_CRUD_V1__=true;
let editingIndex=null;
function getList(){try{return JSON.parse(localStorage.getItem(key()+'_archive')||'[]')}catch(e){return []}}
function commit(keys){return (window.PlatformPersistenceGuard&&typeof PlatformPersistenceGuard.commit==='function')?PlatformPersistenceGuard.commit(keys):Promise.resolve({ok:true})}
window.editArchive=function(i){
 const list=getList(),item=list[i];if(!item)return;
 editingIndex=i;fill(item);if(typeof autoDraft==='function')autoDraft();
 const p=document.getElementById('archivePanel');if(p)p.classList.remove('show');
 alert('تم فتح السجل للتعديل. بعد الانتهاء اضغط «حفظ في الأرشيف» لتحديث نفس السجل.');
};
const originalSave=(typeof window.saveArchive==='function'?window.saveArchive:(typeof saveArchive==='function'?saveArchive:null));
if(typeof originalSave==='function'){
 window.saveArchive=async function(){
   if(editingIndex===null)return originalSave.apply(this,arguments);
   const k=key()+'_archive',list=getList(),before=JSON.stringify(list),data=collect(),old=list[editingIndex]||{};
   data.id=old.id||data.id||Date.now();data.createdAt=old.createdAt||old.savedAt||data.createdAt;data.updatedAt=new Date().toISOString();
   list[editingIndex]=data;localStorage.setItem(k,JSON.stringify(list));
   try{const r=await commit([k]);if(r&&r.ok===false)throw new Error(r.error||'cloud');editingIndex=null;localStorage.removeItem(key()+'_draft');renderArchive();alert('تم حفظ التعديل والتحقق منه سحابيًا.');}
   catch(e){localStorage.setItem(k,before);alert('تعذر تأكيد التعديل سحابيًا؛ تمت استعادة النسخة السابقة.');}
 };
}
const originalRender=(typeof window.renderArchive==='function'?window.renderArchive:(typeof renderArchive==='function'?renderArchive:null));
if(typeof originalRender==='function'){
 window.renderArchive=function(){
   originalRender.apply(this,arguments);
   const box=document.getElementById('archiveList');if(!box)return;
   [...box.querySelectorAll('.archiveItem')].forEach((row,i)=>{
     const actions=row.lastElementChild;if(!actions||actions.querySelector('[data-crud-edit]'))return;
     const b=document.createElement('button');b.className='btn light';b.setAttribute('data-crud-edit','1');b.textContent='تعديل';b.onclick=()=>editArchive(i);actions.insertBefore(b,actions.firstChild);
   });
 };
}
})();