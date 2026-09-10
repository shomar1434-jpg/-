(function(){
  'use strict';
  const VERSION='2.0.0-CDW-COMPLETE';
  const EXTENSIONS=new Set(['docx','xlsx','pptx']);
  const USE_MODES=new Set(['reference','work','continuous']);
  const cfg={
    base:()=> (localStorage.getItem('smartSchoolSupabaseUrl')||'https://cijhgvbtrvmmlcssgxht.supabase.co').replace(/\/$/,'')+'/functions/v1/platform-document-workspace',
    anon:()=>localStorage.getItem('smartSchoolSupabaseAnonKey')||'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJIUzI1NiIsInJlZiI6ImNpamhndmJ0cnZtbWxjc3NneGh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2OTY4MzUsImV4cCI6MjA5NDI3MjgzNX0.1sbfDvL1V12kj9oVcYJqYhj8NPuLpYjId7CO9QGj3bM',
    token:()=>window.PlatformCloudSession?.token?.()||sessionStorage.getItem('platform_tab_session_token_v1')||localStorage.getItem('platform_file_session_token')||''
  };
  const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function extOf(file){return String(file?.extension||file?.display_name?.split('.').pop()||'').trim().toLowerCase()}
  function modeOf(file){const m=String(file?.metadata?.documentUseMode||'').trim();return USE_MODES.has(m)?m:'work'}
  function isLibrary(file){return /library/i.test(String(file?.module_key||''))||String(file?.primary_record_type||'')==='library_file'}
  function isEditable(file){return !!file&&file.status==='active'&&EXTENSIONS.has(extOf(file))&&isLibrary(file)&&modeOf(file)!=='reference'}
  async function ensureSession(){
    if(window.PlatformCloudSession&&typeof window.PlatformCloudSession.ensure==='function'){await window.PlatformCloudSession.ensure();if(cfg.token())return cfg.token()}
    if(cfg.token())return cfg.token();throw new Error('تعذر استعادة جلسة مساحة العمل السحابية.');
  }
  async function request(action,body){
    await ensureSession();
    const headers={'content-type':'application/json',apikey:cfg.anon(),'x-platform-session':cfg.token(),'x-client-version':VERSION};
    const send=async()=>{headers['x-platform-session']=cfg.token();const r=await fetch(`${cfg.base()}?action=${encodeURIComponent(action)}`,{method:'POST',headers,body:JSON.stringify(body||{})});const j=await r.json().catch(()=>({}));return {r,j}};
    let res=await send();if(res.r.status===401&&window.PlatformCloudSession&&typeof window.PlatformCloudSession.recover==='function'){await window.PlatformCloudSession.recover();res=await send()}
    if(!res.r.ok){const e=new Error(res.j.error||`تعذر تنفيذ مساحة العمل (${res.r.status})`);e.status=res.r.status;e.code=res.j.code||'';e.data=res.j;throw e}return res.j;
  }
  function edit(fileId,returnTo){const ret=returnTo||location.href;location.href=`cloud_document_workspace.html?file=${encodeURIComponent(fileId)}&return=${encodeURIComponent(ret)}`}
  const capabilities=fileId=>request('capabilities',{fileId});
  const openSession=(fileId,force=false)=>request('open-session',{fileId,force});
  const versions=fileId=>request('versions',{fileId});
  const restoreVersion=(fileId,versionId,note)=>request('restore-version',{fileId,versionId,note:note||''});
  const setMode=(fileId,mode)=>request('set-mode',{fileId,mode});
  const heartbeat=sessionId=>request('heartbeat',{sessionId});
  const closeSession=sessionId=>request('close-session',{sessionId});
  const health=()=>request('health',{});
  async function linkCurrentAsEvidence(fileId,target){
    if(!window.CloudFileEngine?.link)throw new Error('محرك ربط الملفات غير متاح.');
    const t=target||{};if(!t.moduleKey||!t.recordType||!t.recordId)throw new Error('بيانات العمل المطلوب إرفاق الشاهد به غير مكتملة.');
    return CloudFileEngine.link({fileId,moduleKey:t.moduleKey,recordType:t.recordType,recordId:t.recordId,relationType:t.relationType||'evidence',metadata:{...(t.metadata||{}),source:'cloud_document_workspace',immutableVersion:true}});
  }
  function ensureVersionUi(){
    if(document.getElementById('cdwVersionDialog'))return;
    const st=document.createElement('style');st.id='cdwVersionStyles';st.textContent=`#cdwVersionDialog{position:fixed;inset:0;z-index:2147483600;background:rgba(9,30,42,.72);display:none;align-items:center;justify-content:center;padding:18px;direction:rtl;font-family:Tajawal,Cairo,Tahoma,sans-serif}#cdwVersionDialog.open{display:flex}#cdwVersionDialog .box{width:min(780px,96vw);max-height:90vh;overflow:auto;background:#fff;border-radius:22px;box-shadow:0 30px 90px rgba(0,0,0,.3)}#cdwVersionDialog .head{display:flex;justify-content:space-between;align-items:center;padding:17px 20px;border-bottom:1px solid #e2e8f0}#cdwVersionDialog .body{padding:18px}#cdwVersionDialog button,#cdwVersionDialog select{font:800 12px inherit;border:1px solid #cbd5e1;border-radius:10px;padding:8px 11px;background:#fff;cursor:pointer}#cdwVersionDialog .primary{background:#0f766e;color:#fff;border-color:#0f766e}#cdwVersionDialog .version{display:flex;justify-content:space-between;gap:10px;align-items:center;border:1px solid #e2e8f0;border-radius:14px;padding:12px;margin:8px 0}#cdwVersionDialog .muted{color:#64748b;font-size:11px}`;document.head.appendChild(st);
    const d=document.createElement('div');d.id='cdwVersionDialog';d.innerHTML=`<div class="box"><div class="head"><b>سجل إصدارات ملف العمل</b><button data-close>إغلاق</button></div><div class="body"><div id="cdwVersionContent">جارٍ التحميل...</div></div></div>`;document.body.appendChild(d);d.querySelector('[data-close]').onclick=()=>d.classList.remove('open');d.onclick=e=>{if(e.target===d)d.classList.remove('open')};
  }
  async function showVersions(fileId,onChanged){
    ensureVersionUi();const d=document.getElementById('cdwVersionDialog'),c=document.getElementById('cdwVersionContent');d.classList.add('open');c.innerHTML='جارٍ التحميل...';
    try{const data=await versions(fileId),rows=data.versions||[],current=data.currentFile||rows[0]||{};const mode=modeOf(current);c.innerHTML=`<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:14px"><b>طريقة الاستخدام:</b><select id="cdwMode"><option value="reference" ${mode==='reference'?'selected':''}>مرجع للقراءة</option><option value="work" ${mode==='work'?'selected':''}>ملف عمل قابل للتعديل</option><option value="continuous" ${mode==='continuous'?'selected':''}>سجل مستمر تراكمي</option></select><button class="primary" id="cdwSaveMode">حفظ النوع</button></div>`+rows.map((v,i)=>`<div class="version"><div><b>الإصدار ${Number(v.version_number||1)}</b>${i===0?' <span style="color:#047857">— الحالي</span>':''}<div class="muted">${esc(v.display_name)} · ${(v.created_at||'').replace('T',' ').slice(0,16)} · ${esc(v.metadata?.workspaceEditedByName||v.metadata?.workspaceEditedBy||v.uploaded_by||'')}</div></div><div><button data-preview="${esc(v.id)}">معاينة</button>${i?` <button data-restore="${esc(v.id)}">استعادة كإصدار جديد</button>`:''}</div></div>`).join('');
      document.getElementById('cdwSaveMode').onclick=async()=>{await setMode(fileId,document.getElementById('cdwMode').value);alert('تم تحديث طريقة استخدام الملف.');onChanged&&onChanged();d.classList.remove('open')};
      c.querySelectorAll('[data-preview]').forEach(b=>b.onclick=async()=>{try{if(!window.CloudFileEngine?.open)throw new Error('محرك الملفات غير متاح');await CloudFileEngine.open(b.dataset.preview)}catch(e){alert(e.message)}});
      c.querySelectorAll('[data-restore]').forEach(b=>b.onclick=async()=>{if(!confirm('سيتم إنشاء إصدار جديد من هذه النسخة مع الإبقاء على جميع الإصدارات الحالية. متابعة؟'))return;await restoreVersion(fileId,b.dataset.restore,'استعادة إصدار سابق من سجل الإصدارات');alert('تمت الاستعادة كإصدار جديد دون حذف أي نسخة.');onChanged&&onChanged();d.classList.remove('open')});
    }catch(e){c.innerHTML=`<div style="color:#b91c1c">${esc(e.message)}</div>`}
  }
  window.CloudDocumentWorkspace={VERSION,EXTENSIONS,USE_MODES,extOf,modeOf,isEditable,capabilities,openSession,versions,restoreVersion,setMode,heartbeat,closeSession,health,edit,showVersions,linkCurrentAsEvidence};
})();
