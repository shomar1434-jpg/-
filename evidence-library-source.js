(function(){
  'use strict';
  if(window.EvidenceLibrarySource) return;

  const S={files:[],selected:new Set(),mode:null,target:null,loading:false};
  (function prehide(){try{if(!document.getElementById('elsPrehideStyle')){const st=document.createElement('style');st.id='elsPrehideStyle';st.textContent='#elsPicker[hidden]{display:none!important;visibility:hidden!important}#elsPicker:not([data-els-open=\"1\"]){display:none!important;visibility:hidden!important}';(document.head||document.documentElement).appendChild(st)}}catch(_){}})();
  const page=(location.pathname.split('/').pop()||'page').toLowerCase();
  const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const fmt=n=>{n=Number(n||0);return n<1024?n+' ب':n<1048576?(n/1024).toFixed(1)+' ك.ب':(n/1048576).toFixed(1)+' م.ب'};
  const g=name=>{try{return (0,eval)(name)}catch(_){return undefined}};
  const icon=f=>{const x=String(f.extension||f.mime_type||'').toLowerCase();return /pdf/.test(x)?'📕':/doc/.test(x)?'📘':/xls|sheet|csv/.test(x)?'📗':/ppt|presentation/.test(x)?'📙':/jpg|jpeg|png|webp|gif|image/.test(x)?'🖼️':'📎'};

  function toast(msg,bad){
    let e=document.getElementById('elsToast');
    if(!e){e=document.createElement('div');e.id='elsToast';e.dir='rtl';e.style.cssText='position:fixed;left:20px;bottom:20px;z-index:2147483647;padding:12px 16px;border-radius:12px;font:700 13px Tajawal,Cairo,Tahoma,sans-serif;box-shadow:0 12px 35px rgba(0,0,0,.18);display:none;max-width:420px';document.body.appendChild(e)}
    e.textContent=msg;e.style.display='block';e.style.background=bad?'#fff0f0':'#ecfdf8';e.style.color=bad?'#a11':'#0b6b63';e.style.border='1px solid '+(bad?'#efb1b1':'#9edfd1');clearTimeout(e._t);e._t=setTimeout(()=>e.style.display='none',4200);
  }

  function ensurePicker(){
    if(document.getElementById('elsPicker')) return;
    const m=document.createElement('div');m.id='elsPicker';m.dir='rtl';m.hidden=true;m.style.cssText='display:none!important;position:fixed;inset:0;visibility:hidden;';m.innerHTML=`<style>
#elsPicker{position:fixed;inset:0;z-index:2147483646;background:rgba(15,23,42,.5);backdrop-filter:blur(3px);display:none;align-items:center;justify-content:center;padding:18px;font-family:Tajawal,Cairo,Tahoma,sans-serif}
#elsPicker .els-card{width:min(900px,96vw);max-height:88vh;background:#fff;border-radius:22px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 24px 80px rgba(0,0,0,.24)}
#elsPicker .els-head{background:linear-gradient(135deg,#0f766e,#0f8f87);color:#fff;padding:18px 20px;display:flex;align-items:center;justify-content:space-between;gap:12px}
#elsPicker h3{margin:0;font-size:19px}.els-x{border:0;background:rgba(255,255,255,.15);color:#fff;width:36px;height:36px;border-radius:10px;font-size:20px;cursor:pointer}
#elsPicker .els-tools{padding:13px 15px;border-bottom:1px solid #e5eeee;display:flex;gap:8px}.els-search{flex:1;padding:10px 12px;border:1px solid #cddede;border-radius:11px;font:inherit}
#elsPicker .els-list{padding:14px;overflow:auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(245px,1fr));gap:10px;min-height:230px}
#elsPicker .els-item{border:1px solid #dce7e7;border-radius:14px;padding:12px;display:flex;gap:10px;align-items:flex-start;cursor:pointer;background:#fff}.els-item.sel{border:2px solid #0f8f87;background:#effaf8}.els-ico{font-size:26px}.els-meta{min-width:0;flex:1}.els-name{font-weight:800;color:#183f3d;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.els-sub{font-size:11px;color:#718584;margin-top:4px}.els-open{border:0;background:#eef5f5;border-radius:8px;padding:6px;cursor:pointer}
#elsPicker .els-foot{padding:13px 15px;border-top:1px solid #e5eeee;display:flex;align-items:center;justify-content:space-between;gap:10px}.els-btn{border:0;border-radius:11px;padding:10px 14px;font:800 13px inherit;cursor:pointer}.els-primary{background:#0f8179;color:#fff}.els-secondary{background:#edf4f4;color:#315654}.els-empty{grid-column:1/-1;text-align:center;padding:55px 20px;color:#718584}
.els-source-btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;border:1px solid #b9dcd7;background:#effaf8;color:#0b7169;border-radius:11px;padding:9px 12px;font:800 12px Tajawal,Cairo,Tahoma,sans-serif;cursor:pointer;margin-inline-start:8px}.els-source-btn:hover{background:#ddf4ef}
</style><div class="els-card"><div class="els-head"><div><h3>📚 اختيار شاهد من مكتبة القسم</h3><div style="font-size:12px;opacity:.9;margin-top:4px">اختر ملفًا محفوظًا مسبقًا لاستخدامه كشاهد في السجل أو التقرير الحالي.</div></div><button type="button" class="els-x">×</button></div><div class="els-tools"><input id="elsSearch" class="els-search" type="search" placeholder="ابحث باسم الملف..."><button id="elsRefresh" class="els-btn els-secondary" type="button">↻ تحديث</button></div><div id="elsList" class="els-list"></div><div class="els-foot"><span id="elsCount" style="font-size:12px;font-weight:700;color:#617977"></span><div><button id="elsCancel" class="els-btn els-secondary" type="button">إلغاء</button> <button id="elsUse" class="els-btn els-primary" type="button">استخدام كشاهد</button></div></div></div>`;
    document.body.appendChild(m);
    m.querySelector('.els-x').onclick=close;m.querySelector('#elsCancel').onclick=close;m.querySelector('#elsRefresh').onclick=load;m.querySelector('#elsUse').onclick=useSelected;m.querySelector('#elsSearch').addEventListener('input',render);m.addEventListener('click',e=>{if(e.target===m)close()});
  }

  async function open(mode,target){ensurePicker();S.mode=mode;S.target=target||null;S.selected.clear();document.getElementById('elsSearch').value='';const p=document.getElementById('elsPicker');p.dataset.elsOpen='1';p.hidden=false;p.style.removeProperty('visibility');p.style.setProperty('display','flex','important');await load()}
  function close(){const m=document.getElementById('elsPicker');if(m){delete m.dataset.elsOpen;m.style.setProperty('display','none','important');m.style.visibility='hidden';m.hidden=true}S.mode=null;S.target=null;S.selected.clear()}
  async function load(){
    if(S.loading)return;S.loading=true;const box=document.getElementById('elsList');if(box)box.innerHTML='<div class="els-empty">جارٍ تحميل مكتبة القسم...</div>';
    try{
      if(!window.CloudFileEngine)throw new Error('محرك الملفات السحابي غير متاح في هذه الصفحة');
      const r=await CloudFileEngine.list({ownershipScope:'user',limit:1000});
      const active=(r.files||[]).filter(x=>x&&x.status==='active');
      const library=active.filter(x=>{const m=String(x.module_key||'').toLowerCase(),rt=String(x.record_type||'').toLowerCase(),md=x.metadata||{};return m.includes('library')||m==='section_records_repository'||rt.includes('library')||String(md.source||'').toLowerCase().includes('library')||String(md.folder||'').length>0&&m==='section_records_repository'});
      S.files=library.length?library:active;render();
    }catch(e){if(box)box.innerHTML='<div class="els-empty">تعذر تحميل مكتبة القسم.<br><small>'+esc(e.message||e)+'</small></div>'}
    finally{S.loading=false}
  }
  function render(){
    const box=document.getElementById('elsList');if(!box)return;const q=(document.getElementById('elsSearch').value||'').trim().toLowerCase();const rows=S.files.filter(f=>!q||String(f.display_name||f.original_name||'').toLowerCase().includes(q));document.getElementById('elsCount').textContent=rows.length+' ملف متاح';
    if(!rows.length){box.innerHTML='<div class="els-empty">لا توجد ملفات مطابقة في مكتبة القسم.</div>';return}
    box.innerHTML=rows.map(f=>`<div class="els-item ${S.selected.has(f.id)?'sel':''}" data-id="${esc(f.id)}"><div class="els-ico">${icon(f)}</div><div class="els-meta"><div class="els-name">${esc(f.display_name||f.original_name||'ملف')}</div><div class="els-sub">${esc(f.module_key||'مكتبة القسم')} · ${fmt(f.file_size)}</div></div><button class="els-open" type="button" data-open="${esc(f.id)}" title="فتح الملف">↗</button></div>`).join('');
    box.querySelectorAll('.els-item').forEach(c=>c.onclick=e=>{const id=c.dataset.id;if(e.target.closest('[data-open]')){e.stopPropagation();CloudFileEngine.open(id).catch(x=>toast(x.message||x,true));return}if(S.mode==='report-slot'||S.mode==='impact'||(S.mode==='generic-input' && !S.target?.input?.multiple)){S.selected.clear();S.selected.add(id)}else{S.selected.has(id)?S.selected.delete(id):S.selected.add(id)}render()});
  }

  function currentRecordId(slot){
    const candidates=['currentEditingId','currentAssessmentId','currentReportId','activeReportId'];for(const n of candidates){const v=g(n);if(v)return String(v)}
    const title=(document.querySelector('#field_prog_name,#programName,[data-report-title],h1,h2')?.textContent||document.querySelector('#programName')?.value||'').trim();
    return (page+':'+(title||'draft')+':'+(slot||'evidence')).replace(/\s+/g,'_').slice(0,180);
  }
  async function linkFile(f,slot,extra){
    try{const ctx=window.CloudFilePageContext||{};return await CloudFileEngine.link({fileId:f.id,moduleKey:ctx.moduleKey||page.replace(/\.html?$/,''),recordType:ctx.recordType||'report_evidence',recordId:currentRecordId(slot),relationType:'evidence',metadata:Object.assign({source:'section_library',page,evidenceSlot:String(slot||'')},extra||{})})}catch(e){console.warn('Evidence library link failed',e);return null}
  }
  function renderReportFile(f,slot){
    const box=document.getElementById('box-'+slot),name=esc(f.display_name||f.original_name||'شاهد من مكتبة القسم');if(!box)return false;
    box.innerHTML=`<div data-platform-file-id="${esc(f.id)}" data-evidence-source="section-library" style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:12px;text-align:center"><div style="font-size:31px;margin-bottom:6px">${icon(f)}</div><div style="font-size:10px;font-weight:800;color:#334155;max-width:100%;overflow:hidden;text-overflow:ellipsis">${name}</div><button type="button" class="no-print" data-open-library-evidence="${esc(f.id)}" style="margin-top:7px;border:0;background:#e8f7f4;color:#0f766e;border-radius:8px;padding:5px 9px;font-size:10px;font-weight:800;cursor:pointer">فتح الشاهد</button><div style="font-size:9px;color:#0f766e;margin-top:4px;font-weight:700">من مكتبة القسم</div></div><div class="delete-btn-box no-print" onclick="clearEvidence(event, ${Number(slot)||1})">✕</div>`;
    box.classList.add('has-content');const del=box.querySelector('.delete-btn-box');if(del)del.classList.remove('hidden');
    box.querySelector('[data-open-library-evidence]')?.addEventListener('click',e=>{e.stopPropagation();CloudFileEngine.open(f.id).catch(x=>toast(x.message||x,true))});return true;
  }
  async function applyReport(files){
    const slot=g('currentUploadId')||g('boxId')||S.target?.slot||1;const f=files[0];if(!f)return;await linkFile(f,slot);renderReportFile(f,slot);const sel=document.getElementById('selection-modal');if(sel)sel.style.display='none';toast('تم استخدام الملف كشاهد من مكتبة القسم');
  }
  async function applyReadiness(files,input){
    const sectionKey=input?.dataset?.evidenceSection,index=Number(input?.dataset?.evidenceIndex);if(sectionKey==null||!Number.isFinite(index))return;
    const st=g('state'),sections=g('SECTIONS');if(!st?.tasks?.[sectionKey]?.[index])return toast('تعذر ربط الشاهد بالمهمة الحالية',true);const d=st.tasks[sectionKey][index];
    for(const f of files){if(d.evidence.some(x=>String(x.platformFileId||'')===String(f.id)))continue;const lr=await linkFile(f,sectionKey+':'+index,{sectionKey,taskIndex:index});d.evidence.push({id:'cloud:'+f.id,platformFileId:f.id,name:f.display_name||f.original_name||'شاهد',type:f.mime_type||'ملف',size:Number(f.file_size||0),date:new Date().toISOString().slice(0,10),storage:'cloud',source:'section_library',linkId:lr?.link?.id||lr?.id||''});}
    if(files.length){d.execution={result:'done',reason:'',by:d.responsible||'',date:new Date().toISOString()};d.status='completed';d.done=new Date().toISOString().slice(0,10);const saveFn=g('save');if(typeof saveFn==='function')saveFn();const rs=g('renderSection');if(typeof rs==='function'&&Array.isArray(sections)){const s=sections.find(x=>x.id===sectionKey);if(s)rs(s)}toast('تم ربط الشاهد من مكتبة القسم بالمهمة')}
  }
  async function applyImpact(files){
    const ev=g('evidence'),rf=g('renderFiles');if(!Array.isArray(ev))return toast('تعذر الوصول إلى قائمة الشواهد في النموذج',true);for(const f of files){await linkFile(f,'impact',{source:'impact_assessment'});if(!ev.some(x=>String(x.platformFileId||'')===String(f.id)))ev.push({name:f.display_name||f.original_name||'شاهد',type:f.mime_type||'ملف',size:Number(f.file_size||0),source:'section_library',role:(typeof currentRole==='function'?currentRole():''),roleLabel:(typeof currentRoleLabel==='function'?currentRoleLabel():''),platformFileId:f.id,ref:'cloud:'+f.id});}if(typeof rf==='function')rf();const old=document.getElementById('evidencePicker');if(old)old.style.display='none';toast('تمت إضافة الشاهد من مكتبة القسم')
  }
  function evidenceInputDescriptor(inp){
    if(!inp||inp.type!=='file')return '';
    const own=[inp.id,inp.name,inp.className,inp.getAttribute('aria-label'),inp.getAttribute('title'),inp.getAttribute('placeholder'),inp.dataset?.purpose,inp.dataset?.type].filter(Boolean).join(' ');
    const lab=inp.id?document.querySelector(`label[for="${CSS.escape(inp.id)}"]`):null;
    const modal=inp.closest('.modal,[role="dialog"],.dialog,.popup,.overlay');
    const heading=modal?.querySelector('h1,h2,h3,h4,[class*="title"]')?.textContent||'';
    let node=inp.parentElement,context='';
    for(let i=0;i<2&&node;i++,node=node.parentElement){
      const clone=node.cloneNode(true); clone.querySelectorAll?.('script,style,svg').forEach(x=>x.remove());
      context+=(clone.textContent||'').replace(/\s+/g,' ').slice(0,500)+' ';
    }
    return (own+' '+(lab?.textContent||'')+' '+heading+' '+context).toLowerCase();
  }
  function isEvidenceInput(inp){
    if(!inp||inp.type!=='file')return false;
    if(inp.dataset.evidenceLibrary==='off')return false;
    const d=evidenceInputDescriptor(inp);
    const positive=/(شاهد|شواهد|evidence|proof|إثبات|اثبات|توثيق\s*(?:التنفيذ|الإنجاز|الانجاز)?|مرفقات?\s*(?:التنفيذ|الإنجاز|الانجاز|الشاهد|الشواهد))/.test(d);
    const negative=/(شعار|ختم|توقيع|signature|stamp|logo|صورة\s*شخصية|استيراد|import|excel|إكسل|اكسل|نسخة\s*احتياطية|backup|قاعدة\s*بيانات|رفع\s*كتاب|كتاب\s*الطالب)/.test(d);
    return positive&&!negative;
  }
  function inferGenericSlot(inp){
    return inp?.dataset?.evidenceSlot||inp?.name||inp?.id||'evidence';
  }
  function ensureGenericSelectionBox(inp){
    let box=inp.parentElement?.querySelector(':scope > .els-generic-selected');
    if(!box){box=document.createElement('div');box.className='els-generic-selected';box.dir='rtl';box.style.cssText='display:flex;flex-wrap:wrap;gap:7px;margin-top:8px';inp.insertAdjacentElement('afterend',box)}
    return box;
  }
  async function applyGeneric(files,target){
    const inp=target?.input;if(!inp)return toast('تعذر تحديد حقل الشاهد',true);
    const slot=inferGenericSlot(inp), box=ensureGenericSelectionBox(inp);
    let hidden=inp.parentElement?.querySelector(`input[type="hidden"][data-els-for="${CSS.escape(inp.id||inp.name||slot)}"]`);
    if(!hidden){hidden=document.createElement('input');hidden.type='hidden';hidden.dataset.elsFor=inp.id||inp.name||slot;hidden.name=(inp.name||inp.id||'evidence')+'_library_files';inp.insertAdjacentElement('afterend',hidden)}
    let existing=[];try{existing=JSON.parse(hidden.value||'[]')}catch(_){existing=[]}
    for(const f of files){
      await linkFile(f,slot,{source:'generic_evidence_input',inputId:inp.id||'',inputName:inp.name||''});
      if(!existing.some(x=>String(x.id)===String(f.id)))existing.push({id:f.id,name:f.display_name||f.original_name||'شاهد',mimeType:f.mime_type||'',size:Number(f.file_size||0),source:'section_library',ref:'cloud:'+f.id});
    }
    hidden.value=JSON.stringify(existing);
    box.innerHTML=existing.map(x=>`<span data-platform-file-id="${esc(x.id)}" style="display:inline-flex;align-items:center;gap:6px;background:#effaf8;border:1px solid #b9dcd7;color:#0b7169;border-radius:999px;padding:6px 9px;font:800 11px Tajawal,Cairo,Tahoma,sans-serif"><span>📚</span><button type="button" data-els-open="${esc(x.id)}" style="border:0;background:transparent;color:inherit;font:inherit;cursor:pointer;max-width:220px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(x.name)}</button><button type="button" data-els-remove="${esc(x.id)}" aria-label="إزالة" style="border:0;background:transparent;color:#8b3b3b;cursor:pointer;font-weight:900">×</button></span>`).join('');
    box.querySelectorAll('[data-els-open]').forEach(b=>b.onclick=()=>CloudFileEngine.open(b.dataset.elsOpen).catch(e=>toast(e.message||e,true)));
    box.querySelectorAll('[data-els-remove]').forEach(b=>b.onclick=()=>{existing=existing.filter(x=>String(x.id)!==String(b.dataset.elsRemove));hidden.value=JSON.stringify(existing);b.closest('[data-platform-file-id]')?.remove();inp.dispatchEvent(new CustomEvent('platform:evidence-library-removed',{bubbles:true,detail:{fileId:b.dataset.elsRemove,slot}}))});
    inp.dispatchEvent(new CustomEvent('platform:evidence-library-selected',{bubbles:true,detail:{files,slot,input:inp}}));
    toast(files.length>1?'تمت إضافة الشواهد من مكتبة القسم':'تمت إضافة الشاهد من مكتبة القسم');
  }

  async function useSelected(){
    const files=S.files.filter(f=>S.selected.has(f.id));if(!files.length)return toast('اختر شاهدًا أولاً',true);try{if(S.mode==='report-slot')await applyReport(files);else if(S.mode==='readiness')await applyReadiness(files,S.target);else if(S.mode==='impact')await applyImpact(files);else if(S.mode==='generic-input')await applyGeneric(files,S.target);close()}catch(e){toast(e.message||e,true)}
  }

  function addSourceToSelectionModal(modal){
    if(!modal||modal.dataset.elsReady==='1')return;const title=(modal.querySelector('h1,h2,h3,h4')?.textContent||'').trim();if(!/إضافة\s*شاهد|شاهد\s*جديد/.test(title))return;const content=modal.querySelector('.modal-content')||modal.firstElementChild||modal;const grid=[...content.querySelectorAll('div')].find(d=>/grid/.test(d.className||'')&&d.querySelectorAll('button').length>=2);if(!grid)return;const b=document.createElement('button');b.type='button';const sample=grid.querySelector('button');b.className=(sample?.className||'')+' els-library-choice';b.innerHTML='📚 <span>مكتبة القسم</span>';b.onclick=e=>{e.preventDefault();e.stopPropagation();open('report-slot',{slot:g('currentUploadId')||g('boxId')||1})};grid.appendChild(b);modal.dataset.elsReady='1';
  }
  function addReadinessButtons(root=document){root.querySelectorAll?.('input.evidence-input').forEach(inp=>{if(inp.dataset.elsReady==='1')return;const b=document.createElement('button');b.type='button';b.className='els-source-btn no-print';b.innerHTML='📚 من مكتبة القسم';b.onclick=()=>open('readiness',inp);inp.insertAdjacentElement('afterend',b);inp.dataset.elsReady='1'})}
  function isActuallyVisible(el){
    if(!el || !el.isConnected) return false;
    try{
      var cur=el;
      while(cur && cur.nodeType===1){
        var cs=getComputedStyle(cur);
        if(cs.display==='none' || cs.visibility==='hidden' || cs.visibility==='collapse' || Number(cs.opacity)===0) return false;
        if(cur.hidden) return false;
        cur=cur.parentElement;
      }
      return el.getClientRects().length>0;
    }catch(_){ return false; }
  }
  function addGenericEvidenceButtons(root=document){
    root.querySelectorAll?.('input[type="file"]').forEach(inp=>{
      if(inp.dataset.elsGenericReady==='1'||!isEvidenceInput(inp))return;
      // الحقول المخفية التي تستخدمها أزرار رفع مخصصة لا يجوز أن تنشئ زرًا عائمًا في أعلى الصفحة.
      // ستتم إعادة فحصها عند ظهور نافذة/قسم الشاهد فعليًا.
      if(!isActuallyVisible(inp) && inp.dataset.evidenceLibrary!=='on') return;
      const b=document.createElement('button');b.type='button';b.className='els-source-btn no-print els-generic-source-btn';b.innerHTML='📚 من مكتبة القسم';b.title='اختيار شاهد محفوظ مسبقًا من مكتبة القسم';
      b.onclick=e=>{e.preventDefault();e.stopPropagation();open('generic-input',{input:inp})};
      inp.insertAdjacentElement('afterend',b);inp.dataset.elsGenericReady='1';
    });
  }
  function hookImpact(){document.querySelectorAll('[onclick*="openEvidencePicker(\'section_library\')"],[onclick*="openEvidencePicker(&quot;section_library&quot;)"]').forEach(b=>{if(b.dataset.elsReady==='1')return;b.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();open('impact',b)},true);b.dataset.elsReady='1'})}
  function scan(root=document){root.querySelectorAll?.('#selection-modal').forEach(addSourceToSelectionModal);addReadinessButtons(root);hookImpact();addGenericEvidenceButtons(root)}

  ensurePicker();if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>scan());else scan();new MutationObserver(ms=>{for(const m of ms)for(const n of m.addedNodes)if(n.nodeType===1)scan(n)}).observe(document.documentElement,{childList:true,subtree:true});
  // بعض النوافذ تغيّر display فقط دون إضافة DOM؛ افحص بعد تفاعل المستخدم.
  document.addEventListener('click',()=>setTimeout(()=>scan(document),0),true);
  document.addEventListener('focusin',()=>setTimeout(()=>scan(document),0),true);
  window.EvidenceLibrarySource={open,scan};
})();
