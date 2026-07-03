
(function(){
  if (window.__GENDER_NEUTRAL_LABELS_SAFE__) return;
  window.__GENDER_NEUTRAL_LABELS_SAFE__ = true;
  const pairs = [
    ['مدير المدرسة','المدير/المديرة'],
    ['مديرة المدرسة','المدير/المديرة'],
    ['مدير/ة المدرسة','المدير/المديرة'],
    ['قائد المدرسة','المدير/المديرة'],
    ['قائدة المدرسة','المدير/المديرة'],
    ['وكيل المدرسة','الوكيل/الوكيلة'],
    ['وكيلة المدرسة','الوكيل/الوكيلة'],
    ['معلم المادة','معلم/معلمة المادة'],
    ['معلمة المادة','معلم/معلمة المادة'],
    ['الموجه الطلابي','الموجه/الموجهة الطلابية'],
    ['الموجهة الطلابية','الموجه/الموجهة الطلابية'],
    ['رائد النشاط','رائد/رائدة النشاط'],
    ['رائدة النشاط','رائد/رائدة النشاط'],
    ['الموظف الإداري','الموظف/الموظفة الإدارية'],
    ['الموظفة الإدارية','الموظف/الموظفة الإدارية'],
    ['اسم الطالب','اسم الطالب/الطالبة'],
    ['اسم الموظف','اسم الموظف/الموظفة']
  ];
  const skipTags = new Set(['SCRIPT','STYLE','TEXTAREA','CODE','PRE','OPTION']);
  function neutralizeText(t){
    if (!t || typeof t !== 'string') return t;
    let out = t;
    for (const [from,to] of pairs){
      if (out.includes(to)) continue;
      out = out.split(from).join(to);
    }
    return out;
  }
  function walk(root){
    if (!root || skipTags.has(root.nodeName)) return;
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node){
        const p = node.parentElement;
        if (!p || skipTags.has(p.tagName)) return NodeFilter.FILTER_REJECT;
        if (p.closest && p.closest('[data-no-gender-neutralize]')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const nodes=[]; let n;
    while((n=tw.nextNode())) nodes.push(n);
    for (const node of nodes){
      const v = neutralizeText(node.nodeValue);
      if (v !== node.nodeValue) node.nodeValue = v;
    }
    if (root.querySelectorAll){
      root.querySelectorAll('[placeholder],[title],[aria-label],[alt],[data-title],[data-label]').forEach(el=>{
        if (el.closest && el.closest('[data-no-gender-neutralize]')) return;
        ['placeholder','title','aria-label','alt','data-title','data-label'].forEach(a=>{
          const v = el.getAttribute(a);
          if (v){ const nv = neutralizeText(v); if (nv !== v) el.setAttribute(a,nv); }
        });
      });
    }
  }
  function run(){ try { walk(document.body || document.documentElement); } catch(e){} }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, {once:true}); else run();
})();





const LS='ss_external_evaluation_archive_v1';
const domains=['القيادة المدرسية','التعليم والتعلم','التوجيه والإرشاد','النشاط الطلابي','البيئة المدرسية','الشراكة المجتمعية'];
const folders=['تقارير المدير','تقارير الوكيل','تقارير المعلمين','سجلات الموجه الطلابي','سجلات رائد النشاط','السجلات','الخطط','الأداء الوظيفي','الاجتماعات','التقويم الذاتي','التقويم الخارجي','الشواهد','ملف الإنجاز المدرسي'];
const months=['محرم','صفر','ربيع الأول','ربيع الآخر','جمادى الأولى','جمادى الآخرة','رجب','شعبان','رمضان','شوال','ذو القعدة','ذو الحجة'];
function defaultData(){let y=1447;try{const h=new Intl.DateTimeFormat('ar-SA-u-ca-islamic',{year:'numeric'}).format(new Date()).match(/\d+/);if(h)y=Number(h[0]);}catch(e){}return{selectedYear:String(y),years:{[y]:{folders:{},evaluations:[],annual:{}}},school:{},metrics:{},evaluation:{},visitAccess:{},visits:[],currentVisitId:null}}
function load(){try{return JSON.parse(localStorage.getItem(LS))||defaultData()}catch(e){return defaultData()}}
function save(d){localStorage.setItem(LS,JSON.stringify(d));render();}
let data=load();
const PLATFORM_BASE_URL_KEY='smart_platform_base_url';
const APP_BASE_URL_FALLBACK='https://YOUR-GITHUB-PAGES-URL/index.html';
function getAppBaseUrl(){
  const configured=(localStorage.getItem(PLATFORM_BASE_URL_KEY)||'').trim();
  if(configured) return configured.replace(/\/$/,'');
  if(location.protocol==='http:'||location.protocol==='https:') return (location.origin+location.pathname).replace(/\/$/,'');
  return APP_BASE_URL_FALLBACK;
}
function setPlatformBaseUrl(){
  const current=getAppBaseUrl();
  const v=prompt('ضع رابط المنصة المنشورة على GitHub Pages أو الدومين السحابي:', current);
  if(!v) return;
  localStorage.setItem(PLATFORM_BASE_URL_KEY, v.trim().replace(/\/$/,''));
  renderVisitorPortal();
  alert('تم حفظ رابط المنصة السحابي وتحديث QR.');
}
function getActiveSchoolId(){
  try{ if(window.ActiveSchoolScope&&ActiveSchoolScope.get){ const s=ActiveSchoolScope.get(); if(s&&s.schoolId) return s.schoolId; } }catch(e){}
  return localStorage.getItem('active_school_id')||localStorage.getItem('current_school_id')||localStorage.getItem('school_id')||localStorage.getItem('smart_school_id')||data.school?.school_id||data.school?.schoolId||data.school?.id||'default-school';
}

function getCurrentExternalUserId(){
  try{const u=JSON.parse(localStorage.getItem('currentSchoolUser')||localStorage.getItem('currentUser')||'{}');return u.id||u.user_id||null;}catch(e){return null;}
}
function buildExternalEvaluationPayload(visitOverride){
  const v=visitOverride||getCurrentVisit();
  const snapshot=JSON.parse(JSON.stringify(data||{}));
  snapshot.currentVisit=v;
  snapshot.visit_token=v&&v.token;
  snapshot.school_id=(v&&v.schoolId)||getActiveSchoolId();
  snapshot.savedAt=new Date().toISOString();
  return {
    school_id:snapshot.school_id,
    created_by:getCurrentExternalUserId(),
    draft_number:v&&v.number,
    visit_number:v&&v.number,
    visit_year:v&&v.year||getVisitYear(),
    status:v&&v.status||'draft',
    form_data:snapshot,
    id:v&&v.supabaseVisitId,
    draft_id:data.supabaseDraftId||null
  };
}
async function saveExternalDraftRemote(showToast=false){
  try{
    if(!window.SmartSchoolSupabase||!SmartSchoolSupabase.saveExternalEvaluationDraft) return null;
    const payload=buildExternalEvaluationPayload(getCurrentVisit());
    const row=await SmartSchoolSupabase.saveExternalEvaluationDraft(payload);
    if(row&&row.id){data.supabaseDraftId=row.id;localStorage.setItem(LS,JSON.stringify(data));}
    if(showToast) alert('تم حفظ المسودة في Supabase بنجاح.');
    return row;
  }catch(e){console.warn('تعذر حفظ المسودة في Supabase:',e); if(showToast) alert('تم الحفظ محليًا، لكن تعذر حفظ المسودة في Supabase: '+(e.message||e)); return null;}
}
async function saveExternalVisitRemote(v,showToast=false){
  try{
    if(!window.SmartSchoolSupabase||!SmartSchoolSupabase.saveExternalEvaluationVisit) return null;
    const payload=buildExternalEvaluationPayload(v);
    payload.id=v&&v.supabaseVisitId;
    const row=await SmartSchoolSupabase.saveExternalEvaluationVisit(payload);
    if(row&&row.id&&v){v.supabaseVisitId=row.id;localStorage.setItem(LS,JSON.stringify(data));}
    if(showToast) alert('تم حفظ الزيارة في Supabase بنجاح.');
    return row;
  }catch(e){console.warn('تعذر حفظ الزيارة في Supabase:',e); if(showToast) alert('تم تنفيذ العملية محليًا، لكن تعذر ربط الزيارة في Supabase: '+(e.message||e)); return null;}
}
function fireAndForgetExternalSync(v){saveExternalDraftRemote(false); if(v) saveExternalVisitRemote(v,false);}

function esc(s){return String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function bind(id,obj,key){const el=document.getElementById(id);if(!el)return;el.value=(obj&&obj[key])||'';el.oninput=()=>{obj[key]=el.value;localStorage.setItem(LS,JSON.stringify(data));calcReadiness();};}
function render(){renderYears();renderFields();renderTimeline();renderEvidence();renderVisitAccessGrid();renderVisitorPortal();calcReadiness();}
function renderFields(){const cy=document.getElementById('currentYear');cy.innerHTML=Object.keys(data.years).sort((a,b)=>b-a).map(y=>`<option value="${y}" ${data.selectedYear==y?'selected':''}>${y} هـ</option>`).join('');cy.onchange=()=>{data.selectedYear=cy.value;save(data)};['schoolName','stage','studentsCount','teachersCount','adminsCount'].forEach(k=>bind(k,data.school,k));['discipline','mastery','programs','initiatives'].forEach(k=>bind(k,data.metrics,k));['strengths','improvements','recommendations'].forEach(k=>bind(k,data.evaluation,k));const a=(data.years[data.selectedYear].annual||{});['annualSummary','awards','nextPlans'].forEach(k=>bind(k,a,k));data.years[data.selectedYear].annual=a;}
function renderTimeline(){document.getElementById('timeline').innerHTML=['الفصل الأول','الفصل الثاني'].map((t,i)=>`<div class="term"><h3>${t}</h3><div class="months">${months.slice(i*6,i*6+6).map(m=>`<div class="month"><span>${m}</span><small>برامج/اجتماعات/شواهد/قياس أثر</small></div>`).join('')}</div></div>`).join('')}
function renderEvidence(){
  const box=document.getElementById('evidenceDomains'); if(!box)return;
  box.innerHTML=`<article class="domain" style="grid-column:1/-1;background:#f8fafc;border-style:solid">
    <h3>اختبار التخزين السحابي للشواهد</h3>
    <p class="sub">استخدم هذا الاختبار للتأكد من جاهزية Supabase Storage قبل رفع الشواهد الحقيقية.</p>
    <div class="actions no-print" style="margin-top:10px"><button class="btn" onclick="testExternalEvaluationStorage()">اختبار Storage</button><button class="btn gray" onclick="refreshEvidenceFiles()">تحديث الملفات السحابية</button></div>
    <div id="storageTestResult" class="sub" style="margin-top:10px"></div>
  </article>`+domains.map((d,i)=>`<article class="domain"><h3>${d}</h3><div class="meter"><i style="width:${Math.min(100,Number(data.evaluation[d]||0))}%"></i></div><p class="sub">مجلد شواهد سحابي مرتبط بالأرشيف السنوي وبزيارة فريق التقويم الخارجي.</p><div class="actions no-print" style="gap:8px;align-items:center"><button class="btn gray" onclick="openFolder('${d}')">فتح/تجهيز المجلد</button><label class="btn" style="cursor:pointer">رفع شاهد<input type="file" style="display:none" onchange="uploadEvidenceForDomain(event,'${d.replace(/'/g,"\'")}')" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"></label></div><div class="cloud-files" data-evidence-section="${esc(d)}"><p class="sub">اضغط تحديث الملفات السحابية لعرض آخر الشواهد.</p></div></article>`).join('');
  refreshEvidenceFiles(false);
}
function renderYears(){const yrs=Object.keys(data.years).sort((a,b)=>b-a);document.getElementById('yearsList').innerHTML=yrs.map(y=>`<button class="year-btn ${data.selectedYear==y?'active':''}" onclick="data.selectedYear='${y}';save(data)">${y} هـ</button>`).join('');document.getElementById('selectedYearTitle').textContent='مجلدات عام '+data.selectedYear+' هـ';const ydata=data.years[data.selectedYear]||{folders:{}};document.getElementById('folders').innerHTML=folders.map(f=>`<div class="folder"><b>📁 ${f}</b><small>${(ydata.folders&&ydata.folders[f])?'جاهز ومحفوظ':'مجلد جاهز للربط والحفظ'}</small></div>`).join('')}
function calcReadiness(){let score=0,total=10;['schoolName','stage','studentsCount','teachersCount','adminsCount'].forEach(k=>{if(data.school[k])score++});['discipline','mastery','programs','initiatives'].forEach(k=>{if(data.metrics[k])score++});if(Object.values(data.visitAccess||{}).some(Boolean))score++;document.getElementById('readiness').textContent=Math.round(score/total*100)+'%';}
async function saveAll(){localStorage.setItem(LS,JSON.stringify(data));await saveExternalDraftRemote(false);alert('تم حفظ بيانات التقويم الخارجي والأرشيف المؤسسي كمسودة.');}
function createYearFolders(){const y=data.years[data.selectedYear]||(data.years[data.selectedYear]={folders:{}});y.folders=y.folders||{};folders.forEach(f=>y.folders[f]=true);save(data);}
function addYear(){let y=prompt('أدخل العام الدراسي الهجري، مثال: 1451',String(Number(data.selectedYear)+1));if(!y)return;y=y.replace(/\D/g,'');if(!y)return alert('أدخل رقماً صحيحاً');data.years[y]=data.years[y]||{folders:{},evaluations:[],annual:{}};data.selectedYear=y;createYearFolders();}
function rolloverYear(){const next=String(Number(data.selectedYear)+1);data.years[data.selectedYear].closedAt=new Date().toISOString();data.years[next]=data.years[next]||{folders:{},evaluations:[],annual:{},createdFrom:data.selectedYear,createdAt:new Date().toISOString()};data.selectedYear=next;createYearFolders();alert('تم ترحيل العام الدراسي وإنشاء عام '+next+' هـ مع حفظ العام السابق.');}
function saveAnnualFile(){const y=data.years[data.selectedYear];y.annual=y.annual||{};['annualSummary','awards','nextPlans'].forEach(k=>y.annual[k]=document.getElementById(k).value);save(data);alert('تم حفظ ملف الإنجاز السنوي.');}
function exportArchive(){const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='external-evaluation-archive-'+data.selectedYear+'.json';a.click();URL.revokeObjectURL(a.href);}

function loadImpactRecords(){try{return JSON.parse(localStorage.getItem('schoolImpactAssessments'))||[]}catch(e){return[]}}
function summarizeImpactEvidence(evs){const names={device:'من الجهاز',section_library:'مكتبة القسم',digital_archive:'الأرشيف الرقمي',smart_archive:'الأرشيف الذكي'};const g={};(evs||[]).forEach(e=>{const k=names[e.source]||e.source||'غير محدد';g[k]=(g[k]||0)+1});return Object.entries(g).map(([k,v])=>k+': '+v).join(' | ')}
function renderImpactResults(){
  const roleNames={manager:'المدير/ة',agent:'الوكيل/ة',teacher:'المعلم/ة',student_advisor:'الموجه الطلابي',activity_leader:'رائد/ة النشاط',admin_employee:'الأداء الوظيفي للإداريين'};
  const records=loadImpactRecords();
  const total=document.getElementById('impactTotal'), avgEl=document.getElementById('impactAvg'), bestEl=document.getElementById('impactBest'), rolesEl=document.getElementById('impactRoles'), box=document.getElementById('impactResults');
  if(!box)return;
  const avg=Math.round(records.reduce((s,r)=>s+(Number(r.avgImprovement)||0),0)/(records.length||1));
  if(total)total.textContent=records.length;
  if(avgEl)avgEl.textContent=avg+'%';
  if(bestEl)bestEl.textContent=(Math.max(0,...records.map(r=>Number(r.avgImprovement)||0)))+'%';
  if(rolesEl)rolesEl.textContent=new Set(records.map(r=>r.role)).size;
  if(!records.length){box.innerHTML='<div class="domain" style="text-align:center"><h3>لا توجد نماذج قياس أثر محفوظة بعد</h3><p class="sub">عند حفظ أي نموذج من الأقسام سيظهر هنا تلقائياً أمام لجنة التقويم الخارجي.</p></div>';return;}
  const grouped={};records.forEach(r=>(grouped[r.roleLabel||roleNames[r.role]||'غير محدد']??=[]).push(r));
  box.innerHTML=Object.entries(grouped).map(([role,items])=>`<div class="domain" style="margin-bottom:14px"><h3>${esc(role)}</h3><div class="folders">${items.map(r=>`<div class="folder"><b>${esc(r.programName||'بدون عنوان')}</b><small>النوع: ${esc(r.programType||'—')} | متوسط التحسن: ${Number(r.avgImprovement)||0}% | الأثر: ${esc(r.impactLevel||'—')}</small><small>المؤشرات: ${(r.metrics||[]).map(m=>esc(m.name)+' ('+(Number(m.improvement)||0)+'%)').join('، ')||'—'}</small><small>الشواهد: ${(r.evidence||[]).length} عنصر | المصادر: ${esc(r.evidenceSummary||summarizeImpactEvidence(r.evidence)||'—')}</small></div>`).join('')}</div></div>`).join('');
}



function uid(){return 'v'+Date.now().toString(36)+Math.random().toString(36).slice(2,8)}
function token(){return 'ext_'+Math.random().toString(36).slice(2,10)+Date.now().toString(36)}
function b64(obj){try{return btoa(unescape(encodeURIComponent(JSON.stringify(obj))))}catch(e){return ''}}
function fromB64(txt){try{return JSON.parse(decodeURIComponent(escape(atob(txt))))}catch(e){return null}}
function pad(n){return String(n).padStart(3,'0')}
function getVisitYear(){return String(data.selectedYear||new Date().getFullYear())}
function ensureVisits(){data.visits=data.visits||[];if(!data.currentVisitId){const open=data.visits.find(v=>v.status!=='closed'&&!v.archivedAt);if(open)data.currentVisitId=open.id;}if(!data.currentVisitId){createNewVisit(false,{skipArchive:true})}return data.visits}
function ensureVisitsRaw(){data.visits=data.visits||[];return data.visits}
function nextVisitNumber(){ensureVisitsRaw();const y=getVisitYear();const nums=data.visits.filter(v=>String(v.year)===y).map(v=>Number((v.number||'').match(/(\d+)$/)?.[1]||0));return 'EV-'+y+'-'+pad((Math.max(0,...nums)+1))}
function getCurrentVisit(){ensureVisits();let v=data.visits.find(x=>x.id===data.currentVisitId);if(!v){createNewVisit(false,{skipArchive:true});v=data.visits.find(x=>x.id===data.currentVisitId)}return v}
function archiveVisit(v,reason='auto'){
  if(!v||v.status==='closed') return;
  v.status='closed';
  v.closedAt=v.closedAt||new Date().toISOString();
  v.archivedAt=v.archivedAt||new Date().toISOString();
  v.archiveReason=reason;
}
function createNewVisit(showAlert=true,options={}){
  ensureVisitsRaw();
  const current=data.visits.find(v=>v.id===data.currentVisitId);
  if(current&&!options.skipArchive&&current.status!=='closed') archiveVisit(current,'auto_before_new_visit');
  const v={id:uid(),number:nextVisitNumber(),year:getVisitYear(),schoolId:getActiveSchoolId(),token:token(),status:'draft',access:{...getVisitAccess()},createdAt:new Date().toISOString(),activatedAt:null,closedAt:null,archivedAt:null,linkUpdatedAt:null};
  data.visits.push(v);data.currentVisitId=v.id;data.visitAccess={...v.access};
  localStorage.setItem(LS,JSON.stringify(data));renderVisitAccessGrid();renderVisitorPortal();
  fireAndForgetExternalSync(v);
  if(showAlert)alert('تم إنشاء زيارة جديدة برقم '+v.number+' وحالتها مسودة. تم حفظ الزيارة السابقة في الأرشيف إذا كانت مفتوحة.');
  return v
}
async function startCurrentVisit(){const v=getCurrentVisit();if(!Object.values(getVisitAccess()).some(Boolean))return alert('اختر عناصر العرض للفريق أولاً من إعداد الزيارة.');v.access={...getVisitAccess()};v.schoolId=getActiveSchoolId();v.status='active';v.activatedAt=new Date().toISOString();v.linkUpdatedAt=v.linkUpdatedAt||new Date().toISOString();localStorage.setItem(LS,JSON.stringify(data));renderVisitorPortal();await saveExternalVisitRemote(v,false);await saveExternalDraftRemote(false);alert('تم تفعيل الزيارة. أصبح الرابط والرمز صالحين للفريق الزائر.');}
async function closeCurrentVisit(){const v=getCurrentVisit();if(v.status==='closed')return alert('هذه الزيارة مغلقة بالفعل.');if(!confirm('سيتم إغلاق رابط وQR هذه الزيارة ومنع الدخول إليها وأرشفتها. هل تريد المتابعة؟'))return;archiveVisit(v,'manual_close');localStorage.setItem(LS,JSON.stringify(data));renderVisitorPortal();await saveExternalVisitRemote(v,false);await saveExternalDraftRemote(false);alert('تم إغلاق الزيارة وأرشفتها. لإنشاء رابط جديد استخدم زر إنشاء زيارة جديدة.');}
async function regenerateVisitLink(){const v=getCurrentVisit();if(v.status==='closed')return alert('لا يمكن تحديث رابط زيارة مغلقة. أنشئ زيارة جديدة.');v.token=token();v.linkUpdatedAt=new Date().toISOString();v.schoolId=getActiveSchoolId();localStorage.setItem(LS,JSON.stringify(data));renderVisitorPortal();await saveExternalVisitRemote(v,false);await saveExternalDraftRemote(false);alert('تم تحديث رابط وQR الزيارة الحالية دون تغيير رقم الزيارة.');}
function getVisitUrl(v){const base=getAppBaseUrl();const params=new URLSearchParams();params.set('view','externalVisit');params.set('school_id',v.schoolId||getActiveSchoolId());params.set('visit_token',v.token||'');params.set('visit_number',v.number||'');return base+(base.includes('?')?'&':'?')+params.toString()+'#visitorPortal'}
function getVisitorVisit(){const q=new URLSearchParams(location.search);const mode=q.get('view')==='externalVisit'||q.has('visit_token')||q.has('visitToken');if(!mode)return null;const t=q.get('visit_token')||q.get('visitToken');const sid=q.get('school_id')||q.get('schoolId')||'';if(!t)return {status:'invalid',number:'غير معروف',access:{},validationError:'missing_token'};ensureVisitsRaw();const v=data.visits.find(x=>x.token===t);if(!v)return {token:t,status:'invalid',number:q.get('visit_number')||'غير معروف',access:{},validationError:'token_not_found'};if(sid&&v.schoolId&&sid!==String(v.schoolId))return {token:t,status:'invalid',number:v.number,access:{},validationError:'school_mismatch'};if(v.status!=='active')return {...v,status:'closed',validationError:'not_active'};return {...v,fromLink:true}}
function copyVisitLink(){const v=getCurrentVisit();const url=getVisitUrl(v);navigator.clipboard&&navigator.clipboard.writeText?navigator.clipboard.writeText(url).then(()=>alert('تم نسخ رابط الزيارة.')).catch(()=>prompt('انسخ الرابط:',url)):prompt('انسخ الرابط:',url)}
function openSmartCardForVisit(){const v=getVisitorVisit()||getCurrentVisit();if(!v||v.status==='invalid')return alert('رابط الزيارة غير صالح.');if(v.status==='closed')return alert('هذه الزيارة مغلقة ولا يمكن فتح بطاقة التقييم من رابطها.');const url='external_team_smart_card.html?school_id='+encodeURIComponent(v.schoolId||getActiveSchoolId())+'&visit_token='+encodeURIComponent(v.token||'')+'&visit_number='+encodeURIComponent(v.number||'');window.open(url,'_blank')}
function renderVisitStatusPanel(){const box=document.getElementById('visitStatusPanel');if(!box)return;const visitor=getVisitorVisit();const v=visitor||getCurrentVisit();const invalid=v.status==='invalid';const closed=v.status==='closed';const active=v.status==='active';const cls=invalid?'status-closed':closed?'status-closed':active?'status-active':'status-draft';const label=invalid?'رابط غير صالح':closed?'مغلقة':active?'نشطة':'مسودة';const url=(!invalid&&!closed)?getVisitUrl(v):'';const qr=url?'https://api.qrserver.com/v1/create-qr-code/?size=220x220&data='+encodeURIComponent(url):'';box.innerHTML=`<div class="visit-control-card"><h3>تشغيل الزيارة</h3><span class="status-pill ${cls}">● ${label}</span><p class="sub">رقم الزيارة: <b>${esc(v.number||'—')}</b></p>${visitor?'<p class="sub">أنت الآن في وضع الفريق الزائر؛ المحتوى للقراءة فقط.</p>':'<div class="portal-actions"><button class="btn" onclick="startCurrentVisit()">بدء الزيارة</button><button class="btn red" onclick="closeCurrentVisit()">إغلاق الزيارة</button><button class="btn gray" onclick="createNewVisit()">إنشاء زيارة جديدة</button><button class="btn gold" onclick="regenerateVisitLink()">تحديث الرابط وQR</button><button class="btn blue" onclick="setPlatformBaseUrl()">ضبط رابط المنصة</button></div><p class="sub">إنشاء زيارة جديدة يغلق الزيارة السابقة ويؤرشفها تلقائيًا. تحديث الرابط يغير رمز الدخول لنفس الزيارة فقط.</p>'}</div><div class="visit-code-card"><h3>رابط وQR دخول الفريق</h3>${url?`<img class="qr-img" src="${qr}" alt="QR"><div class="visit-link-box">${esc(url)}</div><div class="portal-actions" style="justify-content:center"><button class="btn gray" onclick="copyVisitLink()">نسخ الرابط</button><button class="btn blue" onclick="openSmartCardForVisit()">فتح بطاقة التقييم</button></div>`:'<p class="sub">لا يوجد رابط صالح لهذه الزيارة. يجب أن تكون الزيارة نشطة وغير مغلقة.</p>'}</div>`}
function activateTab(tabId){document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.panel').forEach(x=>x.classList.remove('active'));const b=document.querySelector(`.tab[data-tab="${tabId}"]`);if(b)b.classList.add('active');const p=document.getElementById(tabId);if(p)p.classList.add('active')}
const visitAccessSources=[
  {role:'قسم المدير',icon:'🏫',items:[
    ['manager_self_eval','سجلات متابعة التقويم الذاتي'],
    ['manager_self_archive','أرشيف التقويم الذاتي'],
    ['manager_library','مكتبة القسم'],
    ['manager_operational','الخطة التشغيلية'],
    ['manager_indicators','بوابة التميز والمؤشرات'],
    ['manager_smart_card','بطاقة فريق التقويم الخارجي الذكية']
  ]},
  {role:'قسم الوكيل',icon:'🧭',items:[
    ['agent_teacher_followup','متابعة أعمال المعلمين'],
    ['agent_weekly_archive','أرشيف الأسابيع'],
    ['agent_attendance','الحضور والانضباط'],
    ['agent_reports','تقارير الوكيل وشواهده']
  ]},
  {role:'قسم الموجه الطلابي',icon:'🧩',items:[
    ['advisor_analytics','تحليل بيانات الموجه'],
    ['advisor_risk','خطط التعثر والمتابعة'],
    ['advisor_cases','ملفات الحالات وفق الصلاحية'],
    ['advisor_programs','البرامج العلاجية والإرشادية']
  ]},
  {role:'قسم المعلم',icon:'📚',items:[
    ['teacher_record','سجل المعلم الشامل'],
    ['teacher_weekly_evidence','الأعمال الأسبوعية والشواهد'],
    ['teacher_grades','تحليلات الدرجات'],
    ['teacher_improvement','خطط التحسين الصفية']
  ]}
];
function getVisitAccess(){data.visitAccess=data.visitAccess||{};return data.visitAccess;}
function renderVisitAccessGrid(){
  const grid=document.getElementById('visitAccessGrid'); if(!grid)return;
  const access=getVisitAccess();
  grid.innerHTML=visitAccessSources.map(group=>`<div class="access-card"><h3><span>${group.icon} ${group.role}</span><small class="sub">عرض فقط</small></h3><div class="access-list">${group.items.map(([key,label])=>`<label class="access-item"><span>${esc(label)}</span><input type="checkbox" ${access[key]?'checked':''} onchange="toggleVisitAccess('${key}',this.checked)"></label>`).join('')}</div></div>`).join('');
}
function toggleVisitAccess(key,val){const access=getVisitAccess();access[key]=!!val;const v=getCurrentVisit();if(v&&v.status!=='closed')v.access={...access};localStorage.setItem(LS,JSON.stringify(data));renderVisitorPortal();}
async function saveVisitAccessSettings(){const v=getCurrentVisit();v.access={...getVisitAccess()};localStorage.setItem(LS,JSON.stringify(data));await saveExternalDraftRemote(false);await saveExternalVisitRemote(v,false);alert('تم حفظ إعدادات الزيارة وربطها ببوابة الفريق الزائر.');renderVisitorPortal();}
function renderVisitorPortal(){
  const box=document.getElementById('visitorPortalContent'); if(!box)return;
  renderVisitStatusPanel();
  const visitor=getVisitorVisit();
  const v=visitor||getCurrentVisit();
  if(v.status==='invalid'){box.innerHTML='<div class="portal-card disabled" style="grid-column:1/-1;text-align:center"><h3>رابط الزيارة غير صالح</h3><p class="sub">تواصل مع إدارة المدرسة للحصول على رابط أو QR جديد.</p></div>';return;}
  if(v.status==='closed'){box.innerHTML='<div class="portal-card disabled" style="grid-column:1/-1;text-align:center"><h3>الزيارة مغلقة</h3><p class="sub">تم إغلاق هذه الزيارة وتعطيل الرابط والرمز الخاص بها.</p></div>';return;}
  const access=visitor?(v.access||{}):getVisitAccess();
  const cards=[];
  visitAccessSources.forEach(group=>group.items.forEach(([key,label])=>{if(access[key])cards.push({role:group.role,icon:group.icon,label,key});}));
  if(!cards.length){box.innerHTML='<div class="portal-card" style="grid-column:1/-1;text-align:center"><h3>لم يتم اختيار عناصر للعرض بعد</h3><p class="sub">انتقل إلى إعداد الزيارة واختر الأقسام والشواهد المطلوب إظهارها للفريق الزائر.</p></div>';return;}
  box.innerHTML=cards.map(c=>`<article class="portal-card"><h3>${c.icon} ${esc(c.label)}</h3><p class="sub">المصدر: ${esc(c.role)} — الصلاحية: عرض فقط</p><button class="btn gray" onclick="previewReadOnlySection('${c.key}','${esc(c.label)}')">عرض الشواهد</button></article>`).join('')+`<article class="portal-card"><h3>📝 بطاقة التقييم الذكية</h3><p class="sub">مرتبطة بالزيارة رقم ${esc(v.number||'—')}.</p><button class="btn blue" onclick="openSmartCardForVisit()">فتح بطاقة التقييم</button></article>`;
}
function previewReadOnlySection(key,label){alert('سيتم فتح '+label+' للفريق الزائر بصلاحية قراءة فقط عند الربط النهائي داخل المنصة.');}


async function testExternalEvaluationStorage(){
  const el=document.getElementById('storageTestResult');
  if(el) el.textContent='جارٍ اختبار الرفع والقراءة من Supabase Storage...';
  try{
    if(!window.SmartSchoolSupabase||!SmartSchoolSupabase.verifyExternalEvaluationStorage) throw new Error('دوال Supabase Storage غير جاهزة');
    const res=await SmartSchoolSupabase.verifyExternalEvaluationStorage({school_id:getActiveSchoolId(),cleanup:true});
    if(el) el.innerHTML=`✅ التخزين السحابي يعمل بشكل سليم. <br><small>Bucket: ${esc(res.bucket)} — تم اختبار المسار ثم حذف ملف الاختبار.</small>`;
  }catch(e){
    if(el) el.innerHTML=`❌ تعذر اختبار التخزين: ${esc(e.message||e)}`;
    console.warn('Storage test failed', e);
  }
}
async function uploadEvidenceForDomain(event,sectionName){
  const file=event.target.files && event.target.files[0];
  event.target.value='';
  if(!file) return;
  try{
    if(!window.SmartSchoolSupabase||!SmartSchoolSupabase.uploadExternalEvaluationFile) throw new Error('دوال رفع الملفات غير جاهزة');
    const v=getCurrentVisit();
    const row=await saveExternalDraftRemote(false);
    const upload=await SmartSchoolSupabase.uploadExternalEvaluationFile(file,{
      school_id:getActiveSchoolId(),
      visit_id:v&&v.supabaseVisitId||null,
      draft_id:data.supabaseDraftId||(row&&row.id)||null,
      visit_number:v&&v.number||'draft',
      section_name:sectionName,
      file_type:file.type||'file'
    });
    alert('تم رفع الشاهد إلى Supabase Storage بنجاح.');
    await refreshEvidenceFiles(true);
    return upload;
  }catch(e){
    console.warn('تعذر رفع الشاهد:',e);
    alert('تعذر رفع الشاهد إلى Supabase Storage: '+(e.message||e));
  }
}
async function refreshEvidenceFiles(showToast){
  try{
    if(!window.SmartSchoolSupabase||!SmartSchoolSupabase.listExternalEvaluationFiles) return;
    const files=await SmartSchoolSupabase.listExternalEvaluationFiles({school_id:getActiveSchoolId()});
    document.querySelectorAll('[data-evidence-section]').forEach(box=>{
      const section=box.getAttribute('data-evidence-section');
      const list=(files||[]).filter(f=>String(f.section_name||'')===String(section)).slice(0,6);
      box.innerHTML=list.length?list.map(f=>`<div class="sub" style="display:flex;justify-content:space-between;gap:8px;border-top:1px dashed #cbd5e1;padding-top:7px;margin-top:7px"><span>${esc(f.file_name||'ملف')}</span><button class="btn gray" style="padding:6px 10px" onclick="openCloudEvidenceFile('${esc(f.file_path||'')}')">عرض</button></div>`).join(''):'<p class="sub">لا توجد شواهد سحابية مرفوعة لهذا المجال بعد.</p>';
    });
    if(showToast) console.info('تم تحديث قائمة الشواهد السحابية');
  }catch(e){console.warn('تعذر تحديث قائمة الشواهد السحابية:',e);}
}
async function openCloudEvidenceFile(path){
  try{
    if(!path) return alert('مسار الملف غير متوفر');
    if(!window.SmartSchoolSupabase||!SmartSchoolSupabase.createExternalEvaluationSignedUrl) throw new Error('دالة رابط العرض غير جاهزة');
    const url=await SmartSchoolSupabase.createExternalEvaluationSignedUrl(path,60*60);
    if(url) window.open(url,'_blank'); else alert('تعذر إنشاء رابط عرض للملف.');
  }catch(e){alert('تعذر فتح الملف: '+(e.message||e));}
}

function printCurrent(){window.print();}
function openFolder(name){createYearFolders();alert('تم تجهيز مجلد '+name+' ضمن عام '+data.selectedYear+' هـ. يمكن ربطه لاحقاً بشواهد المنصة الفعلية.');}
document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.panel').forEach(x=>x.classList.remove('active'));b.classList.add('active');document.getElementById(b.dataset.tab).classList.add('active')});
render();
renderImpactResults();
const __visitParams=new URLSearchParams(location.search);
if(__visitParams.get('view')==='externalVisit'||__visitParams.get('visit_token')||__visitParams.get('visitToken')){document.body.classList.add('visitor-mode');activateTab('visitorPortal');renderVisitorPortal();}
else if(location.hash==="#impact"){activateTab('impact');}
