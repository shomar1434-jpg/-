(function(){
  'use strict';
  const VERSION='2.2.0-CDW-CANONICAL-CONNECTION';
  const EXTENSIONS=new Set(['docx','xlsx','pptx']);
  const USE_MODES=new Set(['reference','work','continuous']);
  const DEFAULT_TIMEOUT_MS=15000;
  const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function parseJwtPayload(token){
    try{const part=String(token||'').split('.')[1];if(!part)return{};const normalized=part.replace(/-/g,'+').replace(/_/g,'/');const pad='='.repeat((4-normalized.length%4)%4);return JSON.parse(decodeURIComponent(Array.from(atob(normalized+pad)).map(c=>'%'+c.charCodeAt(0).toString(16).padStart(2,'0')).join('')))}catch(_){return{}}
  }
  function runtimeConfig(){
    let baseUrl='',anon='';
    // Primary source: the exact connection descriptor used by the authenticated
    // PlatformCloudSession. This avoids a second independent Supabase config.
    try{
      const canonical=window.PlatformCloudSession?.connectionConfig?.()||{};
      baseUrl=String(canonical.supabaseUrl||'').trim();
      anon=String(canonical.anonKey||'').trim();
    }catch(_){ }
    // Compatibility only for pages that already loaded the central bridge.
    // No hardcoded project fallback is kept inside CDW itself.
    if(!baseUrl||!anon){
      try{
        const client=window.SmartSchoolSupabase?.getClient?.();
        if(!baseUrl)baseUrl=String(client?.supabaseUrl||client?.rest?.url?.replace(/\/rest\/v1\/?$/,'')||'').trim();
        if(!anon)anon=String(client?.supabaseKey||'').trim();
      }catch(_){ }
    }
    if(!baseUrl)throw Object.assign(new Error('تعذر قراءة رابط Supabase من جلسة المنصة المركزية. حدّث ملفات جلسة المنصة ثم أعد المحاولة.'),{code:'SUPABASE_URL_MISSING'});
    if(!/^https:\/\//i.test(baseUrl))throw Object.assign(new Error('رابط Supabase في جلسة المنصة غير صالح.'),{code:'SUPABASE_URL_INVALID'});
    if(!anon)throw Object.assign(new Error('تعذر قراءة مفتاح anon من جلسة المنصة المركزية.'),{code:'SUPABASE_ANON_MISSING'});
    baseUrl=baseUrl.replace(/\/$/,'');
    try{
      const host=new URL(baseUrl).hostname.toLowerCase();const ref=host.endsWith('.supabase.co')?host.split('.')[0]:'';const payload=parseJwtPayload(anon);const keyRef=String(payload.ref||'').toLowerCase();
      if(ref&&keyRef&&ref!==keyRef)throw Object.assign(new Error('رابط Supabase ومفتاح anon يعودان إلى مشروعين مختلفين. تم إيقاف فتح المستند لحماية عزل المدارس.'),{code:'SUPABASE_PROJECT_MISMATCH'});
    }catch(e){if(e?.code==='SUPABASE_PROJECT_MISMATCH')throw e}
    return {supabaseUrl:baseUrl,anon,endpoint:baseUrl+'/functions/v1/platform-document-workspace'};
  }
  const cfg={
    base:()=>runtimeConfig().endpoint,
    anon:()=>runtimeConfig().anon,
    token:()=>window.PlatformCloudSession?.token?.()||sessionStorage.getItem('platform_tab_session_token_v1')||localStorage.getItem('platform_file_session_token')||''
  };
  function extOf(file){return String(file?.extension||file?.display_name?.split('.').pop()||'').trim().toLowerCase()}
  function modeOf(file){const m=String(file?.metadata?.documentUseMode||'').trim();return USE_MODES.has(m)?m:'work'}
  function isLibrary(file){return /library/i.test(String(file?.module_key||''))||String(file?.primary_record_type||'')==='library_file'}
  function isEditable(file){return !!file&&file.status==='active'&&EXTENSIONS.has(extOf(file))&&isLibrary(file)&&modeOf(file)!=='reference'}
  async function ensureSession(){
    if(window.PlatformCloudSession&&typeof window.PlatformCloudSession.ensure==='function'){await window.PlatformCloudSession.ensure();if(cfg.token())return cfg.token()}
    if(cfg.token())return cfg.token();throw Object.assign(new Error('تعذر استعادة جلسة مساحة العمل السحابية.'),{code:'PLATFORM_SESSION_MISSING'});
  }
  async function fetchWithTimeout(url,options,timeoutMs=DEFAULT_TIMEOUT_MS){
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeoutMs);
    try{return await fetch(url,{...options,signal:controller.signal,cache:'no-store'})}finally{clearTimeout(timer)}
  }
  function connectivityError(error,endpoint){
    if(error?.name==='AbortError')return Object.assign(new Error('انتهت مهلة الاتصال بخدمة تحرير المستندات. تحقق من نشر Edge Function واتصال الشبكة.'),{code:'WORKSPACE_TIMEOUT',endpoint,cause:error});
    const offline=typeof navigator!=='undefined'&&navigator.onLine===false;
    return Object.assign(new Error(offline?'الجهاز غير متصل بالإنترنت.':'تعذر الوصول إلى خدمة Cloud Document Workspace. غالبًا لم تُنشر دالة platform-document-workspace أو منع المتصفح الاتصال بها (CORS).'),{code:'WORKSPACE_FETCH_FAILED',endpoint,cause:error});
  }
  async function probe(){
    const rc=runtimeConfig();
    try{
      const r=await fetchWithTimeout(rc.endpoint+'?action=probe',{method:'GET',headers:{accept:'application/json'}},8000);
      const text=await r.text();let j={};try{j=text?JSON.parse(text):{}}catch(_){j={raw:text.slice(0,300)}}
      if(r.status===404)throw Object.assign(new Error('دالة platform-document-workspace غير منشورة في مشروع Supabase الحالي.'),{status:404,code:'WORKSPACE_FUNCTION_NOT_DEPLOYED',data:j});
      if(r.status===401||r.status===403)throw Object.assign(new Error('بوابة Supabase رفضت الوصول إلى دالة مساحة العمل قبل التحقق من جلسة المنصة. انشر platform-document-workspace بخيار --no-verify-jwt لأن الدالة تستخدم جلسة المنصة وJWT مستقلًا لـ ONLYOFFICE.'),{status:r.status,code:'WORKSPACE_GATEWAY_JWT_BLOCKED',data:j});
      if(!r.ok)throw Object.assign(new Error(j.error||`خدمة مساحة العمل استجابت بخطأ (${r.status}).`),{status:r.status,code:j.code||'WORKSPACE_PROBE_FAILED',data:j});
      return j;
    }catch(e){if(e?.status||e?.code==='SUPABASE_PROJECT_MISMATCH'||e?.code==='SUPABASE_URL_MISSING'||e?.code==='SUPABASE_ANON_MISSING')throw e;throw connectivityError(e,rc.endpoint)}
  }
  async function request(action,body){
    await ensureSession();const rc=runtimeConfig();
    const headers={'content-type':'application/json',apikey:rc.anon,authorization:'Bearer '+rc.anon,'x-platform-session':cfg.token(),'x-client-version':VERSION};
    const send=async()=>{
      headers['x-platform-session']=cfg.token();
      let r;try{r=await fetchWithTimeout(`${rc.endpoint}?action=${encodeURIComponent(action)}`,{method:'POST',headers,body:JSON.stringify(body||{})})}catch(e){throw connectivityError(e,rc.endpoint)}
      const text=await r.text();let j={};try{j=text?JSON.parse(text):{}}catch(_){j={raw:text.slice(0,500)}}return {r,j}
    };
    let res=await send();if(res.r.status===401&&window.PlatformCloudSession&&typeof window.PlatformCloudSession.recover==='function'){await window.PlatformCloudSession.recover();res=await send()}
    if(!res.r.ok){const normalize=v=>{if(typeof v==='string')return v;if(v&&typeof v==='object')return String(v.message||v.error_description||v.details||v.hint||JSON.stringify(v));return String(v||'')};let msg=normalize(res.j.error)||`تعذر تنفيذ مساحة العمل (${res.r.status})`;let code=res.j.code||'';
      if(res.r.status===404){msg='دالة platform-document-workspace غير منشورة في مشروع Supabase الحالي.';code=code||'WORKSPACE_FUNCTION_NOT_DEPLOYED'}
      else if((res.r.status===401||res.r.status===403)&&!res.j.error){msg='تم رفض الطلب من بوابة Supabase قبل وصوله إلى محرك مساحة العمل. تحقق من نشر الدالة بخيار --no-verify-jwt.';code=code||'WORKSPACE_GATEWAY_JWT_BLOCKED'}
      if(res.j.details&&normalize(res.j.details)!==msg)msg+=` — ${normalize(res.j.details)}`;const e=new Error(msg);e.status=res.r.status;e.code=code;e.data=res.j;e.endpoint=rc.endpoint;throw e}
    return res.j;
  }
  function edit(fileId,returnTo){const ret=returnTo||location.href;location.href=`cloud_document_workspace.html?file=${encodeURIComponent(fileId)}&return=${encodeURIComponent(ret)}`}
  const capabilities=fileId=>request('capabilities',{fileId});
  const openSession=(fileId,force=false)=>request('open-session',{fileId,force});
  const versions=fileId=>request('versions',{fileId});
  const restoreVersion=(fileId,versionId,note)=>request('restore-version',{fileId,versionId,note:note||''});
  const setMode=(fileId,mode)=>request('set-mode',{fileId,mode});
  const heartbeat=sessionId=>request('heartbeat',{sessionId});
  const sessionStatus=sessionId=>request('session-status',{sessionId});
  const closeSession=sessionId=>request('close-session',{sessionId});
  const health=async()=>{const p=await probe();const h=await request('health',{});return {...p,...h}};
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
  window.CloudDocumentWorkspace={VERSION,EXTENSIONS,USE_MODES,runtimeConfig,probe,extOf,modeOf,isEditable,capabilities,openSession,versions,restoreVersion,setMode,heartbeat,closeSession,health,edit,showVersions,linkCurrentAsEvidence};
})();
