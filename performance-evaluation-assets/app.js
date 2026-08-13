(() => {
  const templates = window.PERFORMANCE_TEMPLATES || [];
  const storeKey = 'school_performance_module_v1:'+(window.PlatformCloudSession?.schoolId?.()||localStorage.getItem('platform_file_session_school_id')||localStorage.getItem('active_school_id')||'anonymous');
  const state = loadState();
  let activeEvaluationId = null;
  let activeCardId = null;

  function loadState(){
    const defaults={users:[],evaluations:[],messages:[],context:{school_id:null,manager_id:null,academic_year:null,source:'غير مرتبط'}};
    try{return {...defaults,...JSON.parse(localStorage.getItem(storeKey)||'{}')}}catch{return defaults}
  }
  function save(){localStorage.setItem(storeKey,JSON.stringify(state));scheduleCloudSave();renderAll()}
  const $=s=>document.querySelector(s);
  const $$=s=>[...document.querySelectorAll(s)];
  const norm=s=>(s||'').toString().trim().replace(/[إأآ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي').replace(/\s+/g,' ').toLowerCase();
  const now=()=>new Date().toISOString();
  const fmt=d=>d?new Date(d).toLocaleString('ar-SA',{dateStyle:'medium',timeStyle:'short'}):'—';
  function toast(msg){const el=$('#toast');el.textContent=msg;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2600)}
  let cloudTimer=null,cloudLoading=true;
  function academicYear(){return String(state.context?.academic_year||window.SchoolBaseSettings?.read?.().year||'1448').replace(/\D/g,'')||'1448'}
  function cloudPayload(){return {evaluations:state.evaluations||[],messages:state.messages||[],updatedAt:now()}}
  function scheduleCloudSave(){if(cloudLoading||!window.performanceCloud)return;clearTimeout(cloudTimer);cloudTimer=setTimeout(async()=>{try{await performanceCloud.save(cloudPayload(),academicYear())}catch(e){console.warn('[PerformanceCloud]',e);toast('تم الحفظ محليًا وتعذر الحفظ السحابي مؤقتًا')}},650)}
  async function loadCloudState(){if(!window.performanceCloud)return;try{const r=await performanceCloud.load(academicYear());const d=r?.data||{};if(Array.isArray(d.evaluations))state.evaluations=d.evaluations;if(Array.isArray(d.messages))state.messages=d.messages;}catch(e){console.warn('[PerformanceCloud load]',e)}finally{cloudLoading=false}}

  function templateForRole(role){
    const n=norm(role);
    const exact=templates.find(t=>t.id!=='teacher' && t.labels.some(l=>n.includes(norm(l))));
    if(exact) return exact;
    return templates.find(t=>t.labels.some(l=>n.includes(norm(l))) && !(t.excludeLabels||[]).some(x=>n.includes(norm(x))))||null;
  }
  function statusLabel(s){return ({not_started:'لم يبدأ',in_progress:'قيد التقييم',approved:'تم الاعتماد',sent:'تم الإرسال',read:'تم الاطلاع'}[s]||s||'لم يبدأ')}
  function gradeFor(p){if(p<60)return 1;if(p<70)return 2;if(p<80)return 3;if(p<90)return 4;return 5}
  function calculate(ev){
    const t=templates.find(x=>x.id===ev.templateId); if(!t)return {percent:0,grade:null,complete:false,answered:0,total:0};
    const total=t.criteria.length; let answered=0,weighted=0,totalWeight=0;
    t.criteria.forEach(c=>{totalWeight+=c.weight;const r=Number(ev.ratings?.[c.id]||0);if(r){answered++;weighted+=(r/5)*c.weight}});
    const percent=totalWeight?Math.round((weighted/totalWeight)*10000)/100:0;
    return {percent,grade:gradeFor(percent),complete:answered===total,answered,total};
  }
  function evaluationForUser(userId){return state.evaluations.find(e=>e.userId===userId)}

  async function syncContext(){
    if(window.platformSession?.getContext){
      try{state.context={...state.context,...await window.platformSession.getContext()}}catch(e){console.warn(e)}
    }
    $('#sourceBadge').textContent=state.context.source||'غير مرتبط';
  }
  async function syncUsers(){
    if(window.schoolInfoCenter?.getUsers){
      try{
        const users=await window.schoolInfoCenter.getUsers();
        state.users=normalizeUsers(users);state.context.source='مركز المعلومات المدرسي';save();toast('تمت مزامنة بيانات المستخدمين من مركز المعلومات المدرسي');return;
      }catch(e){toast('تعذرت المزامنة مع مركز المعلومات المدرسي');console.error(e);return}
    }
    toast('لم يتم ربط مركز المعلومات المدرسي بعد. استخدم الاستيراد للاختبار.');
  }
  function normalizeUsers(users){
    return (users||[]).map((u,i)=>({
      id:String(u.id||u.user_id||u.uid||`import_${i}`),
      name:u.name||u.full_name||u.display_name||'',
      jobTitle:u.jobTitle||u.job_title||u.role_description||u.role||u.description||'',
      nationalId:u.nationalId||u.national_id||u.civil_id||'',
      specialty:u.specialty||u.specialization||'',
      email:u.email||''
    })).filter(u=>u.name);
  }
  function parseCSV(text){
    const lines=text.replace(/^\uFEFF/,'').split(/\r?\n/).filter(Boolean);if(!lines.length)return[];
    const headers=lines[0].split(',').map(x=>x.trim().replace(/^"|"$/g,''));
    return lines.slice(1).map(line=>{const vals=line.split(',').map(x=>x.trim().replace(/^"|"$/g,''));const o={};headers.forEach((h,i)=>o[h]=vals[i]||'');return o});
  }
  async function importFile(file){
    const text=await file.text();let raw=[];
    if(file.name.toLowerCase().endsWith('.json')) raw=JSON.parse(text); else raw=parseCSV(text);
    if(!Array.isArray(raw)) raw=raw.users||[];
    const mapped=raw.map((u,i)=>({
      id:u.id||u.user_id||u['المعرف']||u['معرف المستخدم']||`import_${Date.now()}_${i}`,
      name:u.name||u.full_name||u['الاسم']||u['اسم المستخدم']||'',
      jobTitle:u.jobTitle||u.job_title||u.role||u['الوصف الوظيفي']||u['المسمى الوظيفي']||'',
      nationalId:u.nationalId||u.national_id||u['السجل المدني']||'',
      specialty:u.specialty||u['التخصص']||'',email:u.email||u['البريد']||''
    }));
    state.users=normalizeUsers(mapped);state.context.source='ملف اختبار مستورد';save();toast(`تم استيراد ${state.users.length} مستخدمًا`)
  }

  function openEvaluation(userId){
    const user=state.users.find(u=>u.id===userId); if(!user)return;
    const t=templateForRole(user.jobTitle);if(!t){toast('لا يوجد نموذج مرتبط بهذا الوصف الوظيفي');return}
    let ev=evaluationForUser(userId);
    if(!ev){ev={id:(crypto.randomUUID?crypto.randomUUID():`ev_${Date.now()}`),userId:user.id,templateId:t.id,ratings:{},notes:'',status:'in_progress',createdAt:now(),updatedAt:now(),approvedAt:null,sentAt:null};state.evaluations.push(ev);save()}
    activeEvaluationId=ev.id;
    $('#evalRole').textContent=user.jobTitle||'بدون وصف وظيفي';$('#evalName').textContent=user.name;$('#evalTemplateTitle').textContent=t.title;$('#managerNotes').value=ev.notes||'';
    const box=$('#criteriaContainer');box.innerHTML='';
    t.criteria.forEach(c=>{
      const row=document.createElement('div');row.className='criterion';
      row.innerHTML=`<div class="criterion-info"><b>${escapeHTML(c.label)}</b><span>الوزن النسبي: ${c.weight}%</span></div><div class="rating" data-criterion="${c.id}">${[1,2,3,4,5].map(n=>`<button type="button" data-score="${n}" class="${Number(ev.ratings[c.id])===n?'selected':''}">${n}</button>`).join('')}</div>`;
      box.appendChild(row);
    });
    $$('.rating button').forEach(b=>b.addEventListener('click',()=>{const cid=b.parentElement.dataset.criterion;ev.ratings[cid]=Number(b.dataset.score);ev.updatedAt=now();b.parentElement.querySelectorAll('button').forEach(x=>x.classList.toggle('selected',x===b));updateEvalSummary(ev)}));
    updateEvalSummary(ev);openModal('evaluationModal')
  }
  function updateEvalSummary(ev){
    const r=calculate(ev);const completion=r.total?Math.round(r.answered/r.total*100):0;
    $('#evalProgressBar').style.width=`${completion}%`;$('#evalProgressText').textContent=`${completion}%`;
    $('#scorePercent').textContent=`${r.percent}%`;$('#scoreGrade').textContent=r.answered?String(r.grade):'—';$('#scoreStatus').textContent=statusLabel(ev.status)
  }
  function saveDraft(){const ev=state.evaluations.find(e=>e.id===activeEvaluationId);if(!ev)return;ev.notes=$('#managerNotes').value.trim();ev.status='in_progress';ev.updatedAt=now();save();toast('تم حفظ مسودة التقييم')}
  function approveEvaluation(){
    const ev=state.evaluations.find(e=>e.id===activeEvaluationId);if(!ev)return;const r=calculate(ev);if(!r.complete){toast('يجب تقييم جميع العناصر قبل اعتماد البطاقة');return}
    ev.notes=$('#managerNotes').value.trim();ev.status='approved';ev.approvedAt=now();ev.updatedAt=now();save();closeModal('evaluationModal');openCard(ev.id);toast('تم اعتماد التقييم وإنشاء بطاقة الأداء')
  }
  function performanceLabel(percent){
    if(percent<60)return 'غير مرضٍ';
    if(percent<70)return 'مرضي';
    if(percent<80)return 'جيد';
    if(percent<90)return 'جيد جدًا';
    return 'ممتاز';
  }
  function officialCardNumber(ev){
    const base=(ev.id||'').replace(/[^a-zA-Z0-9]/g,'').slice(-8).toUpperCase()||String(Date.now()).slice(-8);
    return `PE-${base}`;
  }
  function roleOutputTitle(t,u){
    if(t?.id==='kindergarten_teacher') return 'بطاقة الأداء الوظيفي لمعلمة رياض الأطفال';
    return 'بطاقة الأداء الوظيفي للموظف/الموظفة';
  }
  function openCard(evId){
    const ev=state.evaluations.find(e=>e.id===evId);if(!ev)return;activeCardId=ev.id;
    const u=state.users.find(x=>x.id===ev.userId);const t=templates.find(x=>x.id===ev.templateId);const r=calculate(ev);
    const ctx=state.context||{};
    const issueDate=ev.approvedAt?new Date(ev.approvedAt).toLocaleDateString('ar-SA'):new Date().toLocaleDateString('ar-SA');
    const title=roleOutputTitle(t,u);
    const evaluator=ctx.manager_name||ctx.managerName||'—';
    const evaluatorRole=ctx.manager_job_title||ctx.managerJobTitle||'مدير/مديرة المدرسة';
    const school=ctx.school_name||ctx.schoolName||'—';
    const edu=ctx.education_admin||ctx.educationAdmin||'—';
    const office=ctx.education_office||ctx.educationOffice||'—';
    const term=ctx.term||ctx.school_term||'—';
    const signature=ctx.signature||'';const stamp=ctx.stamp||'';
    const criterionRows=t.criteria.map((c,i)=>{const score=Number(ev.ratings[c.id]||0);return `<tr><td class="no">${i+1}</td><td class="criterion-cell">${escapeHTML(c.label)}</td><td>${c.weight}%</td><td>${score}/5</td><td>${((score/5)*c.weight).toFixed(2)}%</td></tr>`}).join('');
    $('#performanceCard').innerHTML=`
      <article class="official-performance-card" dir="rtl">
        <div class="official-frame-card">
          <header class="official-header-card">
            <div class="official-side-card">
              <b>المملكة العربية السعودية</b><b>وزارة التعليم</b>
              <div><span>إدارة التعليم</span><strong>${escapeHTML(edu)}</strong></div>
              <div><span>مكتب التعليم</span><strong>${escapeHTML(office)}</strong></div>
            </div>
            <div class="official-logo-card"><div class="moe-mark">وزارة التعليم<small>Ministry of Education</small></div></div>
            <div class="official-side-card">
              <div><span>المدرسة</span><strong>${escapeHTML(school)}</strong></div>
              <div><span>العام الدراسي</span><strong>${escapeHTML(ctx.academic_year||'—')}</strong></div>
              <div><span>الفصل الدراسي</span><strong>${escapeHTML(term)}</strong></div>
              <div><span>تاريخ الإصدار</span><strong>${escapeHTML(issueDate)}</strong></div>
            </div>
          </header>
          <div class="official-doc-strip"><span>بطاقة أداء وظيفي رسمية — مخرج النظام</span><span>رقم البطاقة: <b>${officialCardNumber(ev)}</b></span></div>
          <div class="official-title-card">${title}</div>
          <div class="official-subtitle-card">${escapeHTML(t.title)} — حسب الوصف الوظيفي: ${escapeHTML(u?.jobTitle||'—')}</div>

          <section class="official-info-grid">
            <div><small>${t.id==='kindergarten_teacher'?'اسم المعلمة':'اسم الموظف/الموظفة'}</small><b>${escapeHTML(u?.name||'—')}</b></div>
            <div><small>السجل المدني / معرف المستخدم</small><b>${escapeHTML(u?.nationalId||u?.id||'—')}</b></div>
            <div><small>الوصف الوظيفي</small><b>${escapeHTML(u?.jobTitle||'—')}</b></div>
            <div><small>التخصص</small><b>${escapeHTML(u?.specialty||'—')}</b></div>
            <div><small>القائم بالتقييم</small><b>${escapeHTML(evaluator)}</b></div>
            <div><small>صفة القائم بالتقييم</small><b>${escapeHTML(evaluatorRole)}</b></div>
            <div><small>حالة البطاقة</small><b>${statusLabel(displayStatusForEvaluation(ev))}</b></div>
            <div><small>عدد عناصر التقييم</small><b>${t.criteria.length}</b></div>
          </section>

          <section class="official-summary-grid">
            <div class="main"><strong>${r.percent}%</strong><small>درجة الأداء بالنسبة المئوية</small></div>
            <div><strong>${r.grade}</strong><small>درجة التقدير العام للأداء</small></div>
            <div><strong>${performanceLabel(r.percent)}</strong><small>مستوى الأداء</small></div>
            <div><strong>100%</strong><small>إجمالي الأوزان النسبية</small></div>
          </section>

          <section class="official-section-card">
            <h3>تفاصيل عناصر تقييم الأداء الوظيفي</h3>
            <table class="official-eval-table"><thead><tr><th>#</th><th>عنصر التقييم المعتمد</th><th>الوزن النسبي</th><th>درجة التقييم</th><th>الدرجة المحتسبة</th></tr></thead><tbody>${criterionRows}</tbody></table>
          </section>

          ${ev.notes?`<section class="official-section-card notes"><h3>ملاحظات القائم بالتقييم</h3><p>${escapeHTML(ev.notes)}</p></section>`:''}

          <section class="official-approval-grid">
            <div><strong>اعتماد القائم بالتقييم</strong><p>الاسم: ${escapeHTML(evaluator)}</p><p>الصفة: ${escapeHTML(evaluatorRole)}</p><div class="signature-space">${signature?`<img src="${escapeHTML(signature)}" alt="توقيع مدير المدرسة" style="max-width:100%;max-height:100%;object-fit:contain">`:"التوقيع"}</div></div>
            <div><strong>اعتماد المدرسة</strong><p>المدرسة: ${escapeHTML(school)}</p><p>التاريخ: ${escapeHTML(issueDate)}</p><div class="stamp-space">${stamp?`<img src="${escapeHTML(stamp)}" alt="ختم المدرسة" style="max-width:100%;max-height:100%;object-fit:contain">`:"ختم المدرسة"}</div></div>
            <div><strong>التحقق الإلكتروني</strong><p>رقم البطاقة: ${officialCardNumber(ev)}</p><p>الحالة: ${statusLabel(displayStatusForEvaluation(ev))}</p><div class="verify-code">${officialCardNumber(ev)}</div></div>
          </section>

          <footer class="official-footer-card">نظام تقييم الأداء الوظيفي — وثيقة صادرة إلكترونيًا من المنصة المدرسية</footer>
        </div>
      </article>`;
    $('#sendCardBtn').disabled=ev.status==='sent';$('#sendCardBtn').textContent=ev.status==='sent'?'تم الإرسال':'إرسال إلى الموظف/الموظفة';openModal('cardModal')
  }
  async function sendCard(){
    const ev=state.evaluations.find(e=>e.id===activeCardId);if(!ev)return;const u=state.users.find(x=>x.id===ev.userId);const t=templates.find(x=>x.id===ev.templateId);const r=calculate(ev);
    const message={id:`msg_${Date.now()}`,toUserId:u.id,toName:u.name,type:'performance_evaluation',subject:'بطاقة تقييم الأداء الوظيفي',body:`تم إصدار بطاقة تقييم الأداء الوظيفي الخاصة بك. الدرجة: ${r.percent}%، التقدير: ${r.grade}.`,evaluationId:ev.id,createdAt:now(),readAt:null,payload:{templateId:t.id,percent:r.percent,grade:r.grade}};
    if(window.platformMessenger?.send){try{await window.platformMessenger.send(message)}catch(e){toast('تعذر الإرسال عبر مراسلات المنصة');console.error(e);return}}
    else state.messages.unshift(message);
    ev.status='sent';ev.sentAt=now();ev.updatedAt=now();save();$('#sendCardBtn').disabled=true;$('#sendCardBtn').textContent='تم الإرسال';toast('تم إرسال بطاقة الأداء إلى بريد الموظف الداخلي')
  }

  function renderDashboard(){
    const total=state.users.length, completed=state.evaluations.filter(e=>['approved','sent'].includes(e.status)).length, progress=state.evaluations.filter(e=>e.status==='in_progress').length,sent=state.evaluations.filter(e=>e.status==='sent').length;
    $('#kpiEmployees').textContent=total;$('#kpiCompleted').textContent=completed;$('#kpiInProgress').textContent=progress;$('#kpiSent').textContent=sent;
    const rows=[['تم الإرسال',sent],['تم التقييم',state.evaluations.filter(e=>e.status==='approved').length],['قيد التقييم',progress],['لم يبدأ',Math.max(0,total-state.evaluations.length)]];
    $('#statusBars').innerHTML=rows.map(([label,val])=>`<div class="bar-row"><span>${label}</span><div class="bar-track"><i style="width:${total?Math.round(val/total*100):0}%"></i></div><b>${val}</b></div>`).join('');
    $('#templateList').innerHTML=templates.map(t=>`<div class="template-item"><span>${escapeHTML(t.title)}</span><small>${t.criteria.length} عنصرًا</small></div>`).join('')
  }

  function messageForEvaluation(evId){
    return state.messages.find(m=>m.evaluationId===evId)||null;
  }
  function displayStatusForEvaluation(ev){
    if(!ev) return 'not_started';
    const msg=messageForEvaluation(ev.id);
    if(msg?.readAt) return 'read';
    return ev.status||'not_started';
  }
  function employeeCardAction(u,t,ev){
    if(!t) return '<span class="employee-card-no-template">لا يوجد نموذج مرتبط بالوصف الوظيفي</span>';
    if(!ev) return `<button class="btn primary employee-card-action" data-evaluate="${u.id}">بدء التقييم</button>`;
    if(['approved','sent'].includes(ev.status)) return `<button class="btn primary employee-card-action" data-view-card="${ev.id}">عرض بطاقة الأداء الوظيفي</button>`;
    return `<button class="btn primary employee-card-action" data-evaluate="${u.id}">استكمال التقييم</button>`;
  }
  function renderEmployeePerformanceCards(users){
    const box=$('#employeePerformanceCards');
    if(!box) return;
    box.innerHTML=users.map(u=>{
      const t=templateForRole(u.jobTitle), ev=evaluationForUser(u.id), status=displayStatusForEvaluation(ev);
      const r=ev?calculate(ev):{percent:0,grade:null,answered:0};
      const hasResult=ev && r.answered;
      const approved=ev && ['approved','sent'].includes(ev.status);
      return `<article class="employee-performance-card ${approved?'has-card':''}">
        <div class="employee-card-top">
          <div class="employee-card-avatar">${escapeHTML((u.name||'—').trim().charAt(0)||'—')}</div>
          <div class="employee-card-person">
            <h3>${escapeHTML(u.name)}</h3>
            <p>${escapeHTML(u.jobTitle||'—')}</p>
          </div>
          <span class="badge ${status}">${statusLabel(status)}</span>
        </div>
        <div class="employee-card-template">
          <small>نموذج التقييم</small>
          <b>${t?escapeHTML(t.title):'غير مرتبط'}</b>
        </div>
        <div class="employee-card-stats">
          <div><small>النتيجة</small><strong>${hasResult?r.percent+'%':'—'}</strong></div>
          <div><small>التقدير</small><strong>${hasResult?r.grade:'—'}</strong></div>
          <div><small>العناصر</small><strong>${t?t.criteria.length:'—'}</strong></div>
        </div>
        <div class="employee-card-footer">
          <span class="employee-card-hint">${approved?'تم إنشاء البطاقة الرسمية النهائية':'تتحول النتيجة إلى بطاقة رسمية بعد الاعتماد'}</span>
          ${employeeCardAction(u,t,ev)}
        </div>
      </article>`;
    }).join('');
    $$('[data-view-card]').forEach(b=>b.onclick=()=>openCard(b.dataset.viewCard));
  }

  function renderEmployees(){
    const q=norm($('#employeeSearch')?.value||''), rf=$('#roleFilter')?.value||'';
    const roleSet=[...new Set(state.users.map(u=>u.jobTitle).filter(Boolean))].sort();
    const sel=$('#roleFilter');const current=sel.value;
    sel.innerHTML='<option value="">كل الأوصاف الوظيفية</option>'+roleSet.map(r=>`<option ${r===current?'selected':''}>${escapeHTML(r)}</option>`).join('');
    const users=state.users.filter(u=>(!q||norm(u.name).includes(q)||norm(u.jobTitle).includes(q))&&(!rf||u.jobTitle===rf));

    renderEmployeePerformanceCards(users);

    $('#employeesTable').innerHTML=users.map(u=>{
      const t=templateForRole(u.jobTitle),ev=evaluationForUser(u.id),status=displayStatusForEvaluation(ev);
      const action=!t?'—':ev&&['approved','sent'].includes(ev.status)
        ?`<button class="link-btn" data-view-card="${ev.id}">عرض البطاقة</button>`
        :`<button class="link-btn" data-evaluate="${u.id}">${ev?'استكمال التقييم':'بدء التقييم'}</button>`;
      return `<tr><td><b>${escapeHTML(u.name)}</b></td><td>${escapeHTML(u.jobTitle||'—')}</td><td>${t?escapeHTML(t.title):'<span class="badge no_template">غير مرتبط</span>'}</td><td><span class="badge ${status}">${statusLabel(status)}</span></td><td>${action}</td></tr>`;
    }).join('');

    $('#employeesEmpty').style.display=state.users.length?'none':'block';
    $$('[data-evaluate]').forEach(b=>b.onclick=()=>openEvaluation(b.dataset.evaluate));
    $$('[data-view-card]').forEach(b=>b.onclick=()=>openCard(b.dataset.viewCard));
  }
  function renderEvaluations(){
    $('#evaluationsTable').innerHTML=state.evaluations.map(ev=>{const u=state.users.find(x=>x.id===ev.userId),t=templates.find(x=>x.id===ev.templateId),r=calculate(ev);return `<tr><td>${escapeHTML(u?.name||'')}</td><td>${escapeHTML(t?.title||'')}</td><td>${r.answered?r.percent+'%':'—'}</td><td>${r.answered?r.grade:'—'}</td><td><span class="badge ${ev.status}">${statusLabel(ev.status)}</span></td><td>${fmt(ev.updatedAt)}</td><td><button class="link-btn" data-open-eval="${ev.id}">${['approved','sent'].includes(ev.status)?'عرض البطاقة':'استكمال'}</button></td></tr>`}).join('');
    $('#evaluationsEmpty').style.display=state.evaluations.length?'none':'block';$$('[data-open-eval]').forEach(b=>b.onclick=()=>{const ev=state.evaluations.find(x=>x.id===b.dataset.openEval);if(['approved','sent'].includes(ev.status))openCard(ev.id);else openEvaluation(ev.userId)})
  }
  function renderMessages(){
    $('#messagesList').innerHTML=state.messages.map(m=>`<div class="message"><div class="message-head"><div><b>${escapeHTML(m.subject)}</b><div>إلى: ${escapeHTML(m.toName||m.toUserId)}</div></div><small>${fmt(m.createdAt)}</small></div><p>${escapeHTML(m.body)}</p><button class="link-btn" data-message-card="${m.evaluationId}">عرض البطاقة</button></div>`).join('');
    $('#messagesEmpty').style.display=state.messages.length?'none':'block';$$('[data-message-card]').forEach(b=>b.onclick=()=>openCard(b.dataset.messageCard))
  }
  function renderAll(){syncContext();renderDashboard();renderEmployees();renderEvaluations();renderMessages()}
  function escapeHTML(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
  function openModal(id){$('#'+id).classList.add('open');$('#'+id).setAttribute('aria-hidden','false')}
  function closeModal(id){$('#'+id).classList.remove('open');$('#'+id).setAttribute('aria-hidden','true')}
  function switchView(view){$$('.view').forEach(v=>v.classList.toggle('active',v.id===`view-${view}`));$$('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.view===view));const titles={dashboard:['لوحة الأداء الوظيفي','إدارة تقييمات الأداء الوظيفي حسب الوصف الوظيفي.'],employees:['الموظفون','قراءة المستخدمين وربطهم بنماذج التقييم آليًا.'],evaluations:['التقييمات','المسودات والبطاقات المعتمدة والمرسلة.'],inbox:['المراسلات الداخلية','قناة إرسال بطاقة الأداء للموظف داخل النظام.'],settings:['إعدادات الربط','عقود التكامل المطلوبة عند دمج الوحدة في المنصة.']};$('#pageTitle').textContent=titles[view][0];$('#pageSubtitle').textContent=titles[view][1]}

  $$('.nav-item').forEach(n=>n.onclick=()=>switchView(n.dataset.view));$$('[data-close]').forEach(b=>b.onclick=()=>closeModal(b.dataset.close));
  $('#syncBtn').onclick=syncUsers;$('#importBtn').onclick=()=>$('#fileInput').click();$('#fileInput').onchange=e=>e.target.files[0]&&importFile(e.target.files[0]).catch(err=>{console.error(err);toast('صيغة الملف غير صالحة')});
  $('#employeeSearch').oninput=renderEmployees;$('#roleFilter').onchange=renderEmployees;$('#saveDraftBtn').onclick=saveDraft;$('#approveBtn').onclick=approveEvaluation;$('#printCardBtn').onclick=()=>window.print();$('#sendCardBtn').onclick=sendCard;
  $('#clearLocalBtn').onclick=async()=>{if(confirm('سيتم تنظيف تقييمات الأداء للعام الدراسي الحالي لهذه المدرسة فقط. هل تريد المتابعة؟')){try{if(window.performanceCloud)await performanceCloud.reset(academicYear())}catch(e){console.warn(e)}localStorage.removeItem(storeKey);location.reload()}};
  window.addEventListener('performance-users-refresh',()=>syncUsers());
  async function bootstrap(){await syncContext();await loadCloudState();await syncUsers();renderAll()}
  bootstrap();
})();
