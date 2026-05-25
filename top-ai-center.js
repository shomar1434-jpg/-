
(function(){
  if(window.__TOP_AI_CENTER_FINAL_READY__) return;
  window.__TOP_AI_CENTER_FINAL_READY__ = true;

  function injectStyle(){
    if(document.getElementById('top-ai-center-final-style')) return;
    var s=document.createElement('style');
    s.id='top-ai-center-final-style';
    s.textContent=`
      #topAiCenterIcon{
        position:fixed;left:18px;bottom:18px;top:auto;transform:none;z-index:2147483000;
        width:74px;height:74px;border-radius:24px;border:0;cursor:pointer;
        display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;
        background:radial-gradient(circle at 20% 20%,rgba(168,85,247,.95),transparent 35%),radial-gradient(circle at 82% 82%,rgba(34,211,238,.95),transparent 35%),linear-gradient(145deg,#020617,#0f172a,#111827);
        box-shadow:0 0 0 5px rgba(34,211,238,.08),0 18px 50px rgba(15,23,42,.42),0 0 34px rgba(34,211,238,.30);
        color:#fff;font-family:inherit;transition:.18s ease;
      }
      #topAiCenterIcon:hover{transform:translateY(-2px) scale(1.03)}
      #topAiCenterIcon svg{width:37px;height:37px;display:block}
      #topAiCenterIcon span{font-size:9px;font-weight:900;letter-spacing:.4px;line-height:1}
      #topAiCenterModal{
        position:fixed;inset:0;z-index:2147483647;display:none;align-items:center;justify-content:center;
        background:rgba(15,23,42,.58);backdrop-filter:blur(7px);direction:rtl;font-family:inherit;padding:18px;
      }
      #topAiCenterModal.open{display:flex}
      .top-ai-panel{width:min(1100px,96vw);max-height:92vh;overflow:auto;border-radius:28px;background:#f8fafc;box-shadow:0 30px 90px rgba(0,0,0,.35);border:1px solid rgba(148,163,184,.35)}
      .top-ai-head{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:18px 22px;background:linear-gradient(135deg,#020617,#0f172a,#155e75);color:#fff}
      .top-ai-head h2{margin:0;font-size:22px}.top-ai-close{border:0;border-radius:14px;padding:10px 14px;background:rgba(255,255,255,.16);color:#fff;font-weight:800;cursor:pointer;font-family:inherit}
      .top-ai-tabs{display:flex;flex-wrap:wrap;gap:10px;padding:16px 18px 0}
      .top-ai-tab{border:1px solid #cbd5e1;background:#fff;color:#0f172a;border-radius:999px;padding:10px 14px;font-weight:800;cursor:pointer;font-family:inherit}
      .top-ai-tab.active{background:linear-gradient(135deg,#0f766e,#2563eb);color:#fff;border-color:#0f766e}
      .top-ai-body{padding:18px}
      .top-ai-view{display:none}.top-ai-view.active{display:block}
      .top-ai-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px}
      .top-ai-card{background:#fff;border:1px solid #e2e8f0;border-radius:20px;padding:16px;box-shadow:0 12px 30px rgba(15,23,42,.08)}
      .top-ai-card h3{margin:0 0 8px;color:#0f172a;font-size:18px}.top-ai-card p{margin:0;color:#64748b;line-height:1.7;font-size:14px}
      .top-ai-input,.top-ai-textarea,.top-ai-select{
        width:100%;
        border:1px solid #cbd5e1;
        border-radius:14px;
        padding:12px;
        font-family:inherit;
        font-size:15px;
        box-sizing:border-box;
        background:#fff;
        color:#0f172a !important;
        direction:rtl !important;
        text-align:right !important;
        caret-color:#0f172a !important;
        -webkit-text-fill-color:#0f172a !important;
        opacity:1 !important
      }
      .top-ai-input::placeholder,
      .top-ai-textarea::placeholder{
        color:#94a3b8 !important;
        opacity:1 !important
      }
      .top-ai-textarea{min-height:120px;resize:vertical}
      .top-ai-actions{display:flex;gap:10px;flex-wrap:wrap;margin:12px 0}
      .top-ai-actions button{border:0;border-radius:14px;padding:10px 15px;background:#0f766e;color:#fff;font-weight:800;cursor:pointer;font-family:inherit}
      .top-ai-actions button.secondary{background:#334155}
      .top-ai-result{white-space:pre-wrap;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:14px;line-height:1.85;color:#334155;min-height:90px}
      .top-ai-number{font-size:32px;font-weight:900;color:#0f766e}
      .top-ai-archive-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:12px}
      .top-ai-archive-item{background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:14px}
      .top-ai-tag{display:inline-block;padding:5px 10px;border-radius:999px;background:#ecfeff;color:#0f766e;font-size:12px;font-weight:900;margin:3px}
      .top-ai-chat-box{background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:14px;min-height:260px;max-height:360px;overflow:auto;display:flex;flex-direction:column;gap:10px}
      .top-ai-msg{max-width:86%;padding:10px 12px;border-radius:16px;line-height:1.8;white-space:pre-wrap}
      .top-ai-msg.user{align-self:flex-start;background:#0f766e;color:#fff;border-bottom-left-radius:4px}
      .top-ai-msg.ai{align-self:flex-end;background:#f1f5f9;color:#0f172a;border:1px solid #e2e8f0;border-bottom-right-radius:4px}
      .top-ai-voice-dot{display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:999px;background:#fef3c7;color:#92400e;font-weight:900;font-size:12px}
      .top-ai-voice-dot.listening{background:#dcfce7;color:#166534}

      @media(max-width:768px){#topAiCenterIcon{left:14px;bottom:14px;width:68px;height:68px;border-radius:22px}.top-ai-head h2{font-size:18px}.top-ai-tabs{gap:7px}.top-ai-tab{padding:8px 10px;font-size:13px}}
      @media print{#topAiCenterIcon,#topAiCenterModal{display:none!important}}
    `;
    document.head.appendChild(s);
  }

  var iconSvg='<svg viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="topAiGradFinal" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#22d3ee"/><stop offset="52%" stop-color="#60a5fa"/><stop offset="100%" stop-color="#a855f7"/></linearGradient></defs><path d="M24 8c-7 0-12 5-12 12 0 1.8.4 3.4 1.1 4.9C8.6 27.3 6 31.9 6 37c0 7 4.8 12.8 11.3 14.4.8 5.9 5.8 10.6 12 10.6 3.4 0 6.5-1.4 8.7-3.8 2.2 2.4 5.3 3.8 8.7 3.8 6.2 0 11.2-4.7 12-10.6C65.2 49.8 70 44 70 37c0-5.1-2.6-9.7-7.1-12.1.7-1.5 1.1-3.1 1.1-4.9 0-7-5-12-12-12-3.7 0-7.1 1.7-9.3 4.3C41.1 9.7 38.5 8 35.5 8s-5.6 1.7-7.2 4.3C27.1 9.7 26.5 8 24 8Z" transform="scale(.88) translate(0 1)" fill="none" stroke="url(#topAiGradFinal)" stroke-width="4" stroke-linejoin="round"/><path d="M32 14v36M22 22h-5M23 32h-8M22 42h-5M42 22h5M41 32h8M42 42h5" stroke="url(#topAiGradFinal)" stroke-width="3.8" stroke-linecap="round"/></svg>';

  function text(v){return String(v||'').replace(/\s+/g,' ').trim()}

  function readStorage(keys){
    for(var i=0;i<keys.length;i++){
      try{var v=localStorage.getItem(keys[i])||sessionStorage.getItem(keys[i]); if(v) return v;}catch(e){}
    }
    return '';
  }
  function readQuery(name){
    try{return new URLSearchParams(location.search).get(name)||'';}catch(e){return ''}
  }
  function roleLabel(role){
    var map={leadership:'مدير المدرسة',manager:'مدير المدرسة',agency:'الوكيل',agent:'الوكيل',performance:'المعلم',teacher:'المعلم',student_advisor:'الموجه الطلابي',advisor:'الموجه الطلابي',supervisor:'المشرف الزائر'};
    return map[String(role||'').toLowerCase()]||role||'غير محدد';
  }
  function detectSection(){
    var path=(location.pathname.split('/').pop()||'').toLowerCase();
    var title=text(document.title||'');
    var h=text((document.querySelector('h1,h2,.section-title,.page-title')||{}).innerText||'');
    if(path.indexOf('teacher')!==-1 || /معلم|المعلم/.test(title+h)) return 'قسم المعلم';
    if(path.indexOf('manager')!==-1 || /مدير|المدير/.test(title+h)) return 'قسم المدير';
    if(path.indexOf('agent')!==-1 || path.indexOf('wakil')!==-1 || /وكيل|الوكيل/.test(title+h)) return 'قسم الوكيل';
    if(path.indexOf('student_advisor')!==-1 || /موجه|مرشد|التوجيه/.test(title+h)) return 'قسم الموجه الطلابي';
    if(path.indexOf('supervisor')!==-1 || /زيارة إشرافية|مشرف/.test(title+h)) return 'رابط الزيارة الإشرافية';
    return title||h||'القسم الحالي';
  }
  function getScopedArchiveSummary(meta){
    var out=[];
    var keys=[];
    try{for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i)||''; if(/archive|archives|reports|records|meeting|minutes|smart|digital|أرشيف|سجلات/i.test(k)) keys.push(k)}}catch(e){}
    var roleWords=[meta.section, meta.roleLabel, meta.targetRoleLabel].join(' ');
    keys.slice(0,80).forEach(function(k){
      try{
        var raw=localStorage.getItem(k)||'';
        if(!raw) return;
        var include=false;
        if(/top_ai_center_archive|teacher|performance|agent|agency|manager|leadership|student|advisor|meeting|records|reports|archive|digital|smart/i.test(k)) include=true;
        if(meta.section.indexOf('المعلم')!==-1 && /teacher|performance|معلم/.test(k)) include=true;
        if(meta.section.indexOf('الوكيل')!==-1 && /agent|agency|wakil|وكيل/.test(k)) include=true;
        if(meta.section.indexOf('المدير')!==-1 && /manager|leadership|meeting|مدير/.test(k)) include=true;
        if(meta.section.indexOf('الموجه')!==-1 && /advisor|student|مرشد|موجه/.test(k)) include=true;
        if(!include) return;
        var parsed; try{parsed=JSON.parse(raw)}catch(e){parsed=raw}
        if(Array.isArray(parsed)){
          out.push(k+': عدد العناصر '+parsed.length+(parsed.length?'. عينة: '+text(JSON.stringify(parsed.slice(0,3))).slice(0,700):''));
        }else if(parsed && typeof parsed==='object'){
          var vals=Object.keys(parsed).slice(0,12).map(function(x){return x+': '+text(JSON.stringify(parsed[x])).slice(0,120)}).join(' | ');
          out.push(k+': '+vals);
        }else{
          out.push(k+': '+text(String(parsed)).slice(0,500));
        }
      }catch(e){}
    });
    return out.slice(0,28).join('\n');
  }
  function getAIContextMeta(){
    var qs=new URLSearchParams(location.search||'');
    var role=readQuery('role')||readQuery('viewerRole')||readQuery('viewer')||readStorage(['currentRole','smart_school_active_role','user_role','role']);
    var targetRole=readQuery('targetRole')||readStorage(['targetRole','currentTargetRole']);
    var schoolId=readQuery('schoolId')||readQuery('school_id')||readStorage(['current_school_id','school_id','active_school_id']);
    var schoolName=readQuery('schoolName')||readQuery('school_name')||readStorage(['current_school_name','school_name','persist_school']);
    var userName=readStorage(['currentUserName','current_user_name','userName','teacherName','managerName'])||readQuery('name');
    var userEmail=readStorage(['currentUserEmail','current_user_email','userEmail'])||readQuery('email');
    var targetUser=readQuery('targetUser')||readQuery('followUserId')||readQuery('userId')||readQuery('uid')||readStorage(['targetUser','followUserId','current_target_user']);
    var mode=(readQuery('readonly')==='1'||readQuery('follow')==='1'||readQuery('mode')||'').toString();
    var independent=(readQuery('independent')==='true'||readQuery('schoolMode')==='independent'||!!schoolId||!!schoolName);
    return {section:detectSection(), role:role||'', roleLabel:roleLabel(role), targetRole:targetRole||'', targetRoleLabel:roleLabel(targetRole), schoolId:schoolId||'', schoolName:schoolName||'', userName:userName||'', userEmail:userEmail||'', targetUser:targetUser||'', mode:mode||'عادي', independent:independent};
  }
  function systemInstruction(){
    var m=getAIContextMeta();
    return 'أنت مساعد ذكي سياقي داخل منصة مدرسية. أجب بالعربية وبصياغة إدارية مختصرة. التزم التزامًا صارمًا بسياق القسم الحالي فقط ولا تقدم إجابات عامة أو تخص أقسامًا أخرى إلا إذا طلب المستخدم صراحة المقارنة أو كانت صلاحياته وسياق السؤال يسمحان بذلك. إذا كانت البيانات غير كافية فاذكر أن الحكم مبني على البيانات الظاهرة/المحفوظة في هذا القسم فقط. لا تقترح إنشاء أزرار أو تعديلات برمجية داخل الصفحة. السياق الثابت: المدرسة='+(m.schoolName||'غير محددة')+'، معرف المدرسة='+(m.schoolId||'غير محدد')+'، المستخدم/الدور='+(m.roleLabel||'غير محدد')+'، القسم الحالي='+(m.section||'غير محدد')+'، المستخدم المستهدف='+(m.targetUser||'غير محدد')+'، وضع الدخول='+(m.mode||'عادي')+'.';
  }
  function collectContext(){
    var meta=getAIContextMeta();
    var fields=Array.from(document.querySelectorAll('input,textarea,select')).filter(function(el){return !el.closest('#topAiCenterModal')}).map(function(el){return (el.placeholder||el.name||el.id||'حقل')+': '+(el.value||'')}).filter(Boolean).slice(0,90);
    var labels=Array.from(document.querySelectorAll('h1,h2,h3,h4,p,label,button,th,td')).filter(function(el){return !el.closest('#topAiCenterModal')&&el.offsetParent!==null}).map(function(el){return text(el.innerText)}).filter(Boolean).slice(0,170);
    var archive=getScopedArchiveSummary(meta);
    var head='[سياق الذكاء الحالي]\nالمدرسة: '+(meta.schoolName||'غير محددة')+'\nمعرف المدرسة: '+(meta.schoolId||'غير محدد')+'\nدور المستخدم: '+(meta.roleLabel||'غير محدد')+'\nالقسم المفتوح: '+(meta.section||'غير محدد')+'\nالدور/المستخدم المستهدف: '+(meta.targetRoleLabel||meta.targetUser||'غير محدد')+'\nوضع الدخول: '+(meta.mode||'عادي')+'\nمدرسة مستقلة: '+(meta.independent?'نعم':'غير مؤكد');
    return [head,'[حقول الصفحة]',fields.join('\n'),'[عناصر الصفحة الظاهرة]',labels.join('\n'),archive?'[ملخص الأرشيف المرتبط بالسياق]\n'+archive:''].filter(Boolean).join('\n\n');
  }
  async function callAI(prompt){
    if(window.OpenAIEngine && typeof window.OpenAIEngine.call === 'function'){
      return await window.OpenAIEngine.call(
        systemInstruction(),
        prompt,
        {temperature:.25}
      );
    }
    if(typeof window.callOpenAI==='function') return await window.callOpenAI(prompt);
    throw new Error('لم يتم العثور على OpenAI Engine في هذه الصفحة.');
  }
  function result(id,msg){var el=document.getElementById(id); if(el)el.textContent=msg}
  function getArchive(){try{return JSON.parse(localStorage.getItem('top_ai_center_archive_v1')||'[]')}catch(e){return[]}}
  function setArchive(items){localStorage.setItem('top_ai_center_archive_v1',JSON.stringify(items.slice(0,120)))}
  function localScores(){
    var ctx=collectContext(), len=ctx.length;
    var keywords=['هدف','إجراء','نتيجة','توصية','شواهد','مؤشر','أثر','تنفيذ'];
    var hit=keywords.filter(function(k){return ctx.indexOf(k)!==-1}).length;
    var quality=Math.min(100,45+hit*7);
    var completion=Math.min(100,Math.max(20,Math.round(len/25)));
    var risk=Math.max(0,100-Math.round(quality*.5+completion*.5));
    return {context:ctx,quality:quality,completion:completion,risk:risk};
  }
  function showTab(tab){
    document.querySelectorAll('.top-ai-tab').forEach(function(b){b.classList.toggle('active',b.dataset.tab===tab)});
    document.querySelectorAll('.top-ai-view').forEach(function(v){v.classList.toggle('active',v.id==='view-'+tab)});
    if(tab==='archive') renderArchive();
    if(tab==='analytics') runLocalAnalytics();
  }
  function openModal(){var m=getAIContextMeta();var b=document.getElementById('topAiContextBadge');if(b)b.textContent='السياق: '+(m.section||'القسم الحالي')+' • '+(m.roleLabel||'مستخدم');document.getElementById('topAiCenterModal').classList.add('open'); showTab('analytics')}
  function closeModal(){document.getElementById('topAiCenterModal').classList.remove('open')}

  function runLocalAnalytics(){
    var s=localScores();
    var c=document.getElementById('scoreCompletion'), q=document.getElementById('scoreQuality'), r=document.getElementById('scoreRisk');
    if(c)c.textContent=s.completion+'%'; if(q)q.textContent=s.quality+'%'; if(r)r.textContent=s.risk+'%';
    result('analyticsResult','📊 تحليل محلي سريع:\n- اكتمال البيانات: '+s.completion+'%\n- جودة المحتوى: '+s.quality+'%\n- مؤشر المخاطر: '+s.risk+'%\n\nتوصيات:\n1. استكمال الحقول الناقصة.\n2. إضافة الشواهد ومؤشرات النجاح.\n3. توثيق النتائج في الأرشيف الذكي.\n4. استخدام مولد التقارير لتحسين الصياغة.');
  }
  async function runAIAnalytics(){
    var s=localScores(); result('analyticsResult','⏳ جارٍ التحليل عبر OpenAI...');
    try{result('analyticsResult',await callAI('حلل هذه الصفحة ضمن سياق القسم الحالي فقط، وقدم نقاط القوة والنواقص والمخاطر والتوصيات التنفيذية دون الخروج إلى أقسام أخرى:\n\n'+s.context))}
    catch(e){result('analyticsResult','تعذر الاتصال: '+e.message+'\n\nتم الإبقاء على التحليل المحلي.'); runLocalAnalytics()}
  }
  function generateLocalReport(){
    var type=document.getElementById('reportType').value, domain=document.getElementById('reportDomain').value, seed=text(document.getElementById('reportSeed').value)||'تم تنفيذ برنامج مدرسي لتحسين الأداء ورفع جودة المخرجات.';
    var out='عنوان التقرير: '+type+'\n\nالمجال: '+domain+'\n\nوصف مختصر:\n'+seed+'\n\nالأهداف:\n1. تحسين الأداء المدرسي في مجال '+domain+'.\n2. رفع جودة التوثيق والمتابعة.\n3. قياس أثر البرنامج على المستفيدين.\n\nإجراءات التنفيذ:\n- تحديد الفئة المستهدفة.\n- تنفيذ البرنامج وفق خطة زمنية.\n- جمع الشواهد والبيانات.\n- تحليل النتائج وقياس الأثر.\n\nالشواهد:\nصور تنفيذ، كشوف حضور، نماذج أعمال، روابط رقمية.\n\nالتوصيات:\n1. استمرار المتابعة الدورية.\n2. حفظ الشواهد في الأرشيف الذكي.\n3. ربط النتائج بمؤشرات أداء قابلة للقياس.';
    result('reportResult',out); return out;
  }
  async function generateAIReport(){
    result('reportResult','⏳ جارٍ توليد التقرير عبر OpenAI...');
    try{result('reportResult',await callAI('اكتب تقريرًا إداريًا رسميًا بناءً على سياق القسم الحالي فقط داخل منصة مدرسية. النوع: '+document.getElementById('reportType').value+'. المجال: '+document.getElementById('reportDomain').value+'. الفكرة: '+(document.getElementById('reportSeed').value||'اقترح صياغة مناسبة')+'. اجعل التقرير منظمًا بعناوين: المقدمة، الأهداف، الإجراءات، الشواهد، الأثر، مؤشرات النجاح، التوصيات.'))}
    catch(e){result('reportResult','تعذر الاتصال: '+e.message+'\n\nنسخة محلية:\n\n'+generateLocalReport())}
  }
  async function runAsk(){
    var q=text(document.getElementById('askPrompt').value); if(!q){result('askResult','اكتب سؤالك أولًا.');return}
    result('askResult','⏳ جارٍ الإجابة...');
    try{result('askResult',await callAI('أجب عن السؤال التالي اعتمادًا على سياق القسم الحالي فقط، ولا تجب إجابة عامة إلا إذا طلب المستخدم ذلك صراحة.\nالسؤال:\n'+q+'\n\nسياق القسم والبيانات المتاحة:\n'+collectContext()))}
    catch(e){result('askResult','تعذر الاتصال: '+e.message)}
  }
  async function runDecision(){
    result('decisionResult','⏳ جارٍ تحليل القرار...');
    try{result('decisionResult',await callAI('حلل سياق القسم الحالي فقط واقترح قرارًا إداريًا مناسبًا مع: القرار، السبب، درجة الأولوية، الإجراء التالي. لا تستخدم بيانات أقسام أخرى.\n\n'+collectContext()))}
    catch(e){var s=localScores(); result('decisionResult','قرار محلي مقترح:\n'+(s.risk>50?'يحتاج تدخل ومتابعة عاجلة':'يحتاج متابعة دورية')+'\n\nالسبب: مؤشر المخاطر '+s.risk+'%.\nالإجراء التالي: استكمال البيانات والشواهد ثم حفظها في الأرشيف.')}
  }
  async function runPlatformAI(){
    result('platformResult','⏳ جارٍ توليد اقتراحات المنصة...');
    try{result('platformResult',await callAI('اقترح تحسينات ذكية ومباشرة لهذا القسم فقط في المنصة المدرسية، دون تعميم على بقية الأقسام ودون اقتراح أزرار ذكاء إضافية:\n\n'+collectContext()))}
    catch(e){result('platformResult','اقتراحات محلية:\n1. تحسين اكتمال البيانات.\n2. توحيد مسميات الحقول.\n3. إضافة شواهد ومؤشرات.\n4. حفظ الناتج في الأرشيف الذكي.')}
  }
  function saveToArchive(kind,content){
    var items=getArchive();
    items.unshift({id:Date.now(),kind:kind,title:kind+' - '+new Date().toLocaleString('ar-SA'),content:content||collectContext(),createdAt:new Date().toISOString(),tags:[kind,'AI CENTER']});
    setArchive(items); renderArchive();
  }
  function renderArchive(){
    var list=document.getElementById('archiveList'); if(!list)return;
    var q=text(document.getElementById('archiveSearch')&&document.getElementById('archiveSearch').value).toLowerCase();
    var items=getArchive().filter(function(x){return !q||JSON.stringify(x).toLowerCase().indexOf(q)!==-1});
    if(!items.length){list.innerHTML='<div class="top-ai-card"><h3>لا توجد عناصر محفوظة</h3><p>احفظ تحليلًا أو تقريرًا ليظهر هنا.</p></div>';return}
    list.innerHTML=items.map(function(x){return '<div class="top-ai-archive-item"><h3>'+escapeHtml(x.title)+'</h3><p>'+new Date(x.createdAt).toLocaleString('ar-SA')+'</p><div>'+(x.tags||[]).map(function(t){return '<span class="top-ai-tag">'+escapeHtml(t)+'</span>'}).join('')+'</div><p>'+escapeHtml(String(x.content||'').slice(0,180))+'...</p><div class="top-ai-actions"><button type="button" data-view="'+x.id+'">عرض</button><button type="button" class="secondary" data-del="'+x.id+'">حذف</button></div></div>'}).join('');
    list.querySelectorAll('[data-view]').forEach(function(b){b.onclick=function(){var it=getArchive().find(function(x){return String(x.id)===String(b.dataset.view)}); if(it) alert(it.title+'\n\n'+it.content)}});
    list.querySelectorAll('[data-del]').forEach(function(b){b.onclick=function(){setArchive(getArchive().filter(function(x){return String(x.id)!==String(b.dataset.del)}));renderArchive()}});
  }
  function escapeHtml(s){return String(s||'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]})}


  var chatHistory = [];
  var voiceRecognition = null;

  function addChatMessage(role, content){
    var box=document.getElementById('chatBox');
    if(!box) return;
    var div=document.createElement('div');
    div.className='top-ai-msg '+(role==='user'?'user':'ai');
    div.textContent=content;
    box.appendChild(div);
    box.scrollTop=box.scrollHeight;
  }

  async function sendChatMessage(){
    var input=document.getElementById('chatPrompt');
    var msg=text(input && input.value);
    if(!msg){ addChatMessage('ai','اكتب رسالتك أولًا.'); return; }
    if(input) input.value='';
    addChatMessage('user',msg);
    addChatMessage('ai','⏳ جارٍ التفكير...');
    try{
      chatHistory.push({role:'user',content:msg});
      var context=collectContext();
      var prompt='هذه محادثة مع مستخدم داخل منصة قيادة مدرسية. أجب عن آخر رسالة اعتمادًا على سياق القسم الحالي فقط. لا تخلط بين الأقسام أو المستخدمين أو المدارس. إذا سأل عن التقارير أو المجالات الأقل تنفيذًا فاستخرج الإجابة من بيانات وسجلات هذا القسم والمستخدم الحالي فقط.\n\nسياق القسم والبيانات المتاحة:\n'+context+'\n\nالمحادثة:\n'+chatHistory.map(function(m){return m.role+': '+m.content}).join('\n');
      var ans=await callAI(prompt);
      chatHistory.push({role:'assistant',content:ans});
      var box=document.getElementById('chatBox');
      if(box && box.lastChild) box.lastChild.textContent=ans;
    }catch(e){
      var box=document.getElementById('chatBox');
      if(box && box.lastChild) box.lastChild.textContent='تعذر الاتصال: '+e.message;
    }
  }

  function clearChat(){
    chatHistory=[];
    var box=document.getElementById('chatBox');
    if(box) box.innerHTML='<div class="top-ai-msg ai">تم مسح المحادثة. كيف يمكنني مساعدتك؟</div>';
  }

  function getSpeechRecognition(){
    return window.SpeechRecognition || window.webkitSpeechRecognition || null;
  }

  function startVoice(targetId){
    var SR=getSpeechRecognition();
    var status=document.getElementById('voiceStatus');
    if(!SR){
      if(status) status.textContent='المتصفح لا يدعم التعرف الصوتي';
      var vr=document.getElementById('voiceResult');
      if(vr) vr.textContent='المتصفح الحالي لا يدعم SpeechRecognition. جرّب Chrome أو Edge.';
      return;
    }
    try{
      if(voiceRecognition) voiceRecognition.stop();
      voiceRecognition=new SR();
      voiceRecognition.lang='ar-SA';
      voiceRecognition.interimResults=true;
      voiceRecognition.continuous=false;
      if(status){status.textContent='جاري الاستماع...';status.classList.add('listening')}
      voiceRecognition.onresult=function(event){
        var transcript='';
        for(var i=event.resultIndex;i<event.results.length;i++) transcript+=event.results[i][0].transcript;
        var target=document.getElementById(targetId || 'voiceText');
        if(target) target.value=transcript;
      };
      voiceRecognition.onerror=function(e){
        if(status){status.textContent='حدث خطأ في الصوت';status.classList.remove('listening')}
        var vr=document.getElementById('voiceResult');
        if(vr) vr.textContent='خطأ التعرف الصوتي: '+(e.error||'غير معروف');
      };
      voiceRecognition.onend=function(){
        if(status){status.textContent='توقف الاستماع';status.classList.remove('listening')}
      };
      voiceRecognition.start();
    }catch(e){
      if(status) status.textContent='تعذر بدء الاستماع';
    }
  }

  function stopVoice(){
    try{ if(voiceRecognition) voiceRecognition.stop(); }catch(e){}
    var status=document.getElementById('voiceStatus');
    if(status){status.textContent='تم الإيقاف';status.classList.remove('listening')}
  }

  async function runVoiceCommand(){
    var t=text(document.getElementById('voiceText') && document.getElementById('voiceText').value);
    if(!t){result('voiceResult','لا يوجد أمر صوتي لتنفيذه.');return}
    var lower=t.toLowerCase();
    if(lower.indexOf('حلل')!==-1 || lower.indexOf('تحليل')!==-1){showTab('analytics');runAIAnalytics();return}
    if(lower.indexOf('تقرير')!==-1){showTab('report');var seed=document.getElementById('reportSeed');if(seed)seed.value=t;generateAIReport();return}
    if(lower.indexOf('قرار')!==-1){showTab('decision');runDecision();return}
    if(lower.indexOf('أرشيف')!==-1 || lower.indexOf('ارشيف')!==-1){showTab('archive');return}
    if(lower.indexOf('اسأل')!==-1 || lower.indexOf('سؤال')!==-1 || lower.indexOf('شات')!==-1){showTab('chat');var cp=document.getElementById('chatPrompt');if(cp)cp.value=t;sendChatMessage();return}
    result('voiceResult','⏳ جارٍ تنفيذ الأمر عبر ChatGPT...');
    try{result('voiceResult',await callAI('نفذ هذا الأمر الصوتي داخل منصة قيادة مدرسية أو اشرح أفضل إجراء:\n'+t+'\n\nسياق الصفحة:\n'+collectContext()))}
    catch(e){result('voiceResult','تعذر التنفيذ: '+e.message)}
  }

  function createModal(){
    if(document.getElementById('topAiCenterModal'))return;
    var modal=document.createElement('div'); modal.id='topAiCenterModal';
    modal.innerHTML='<div class="top-ai-panel"><div class="top-ai-head"><h2>AI CENTER • مركز الذكاء الاصطناعي</h2><div id="topAiContextBadge" style="font-size:12px;font-weight:900;opacity:.9"></div><button type="button" class="top-ai-close">إغلاق ✕</button></div><div class="top-ai-tabs"><button class="top-ai-tab" data-tab="analytics">📊 التحليل الذكي</button><button class="top-ai-tab" data-tab="report">🪄 مولد التقارير</button><button class="top-ai-tab" data-tab="archive">📁 الأرشيف الذكي</button><button class="top-ai-tab" data-tab="platform">✨ ذكاء المنصة</button><button class="top-ai-tab" data-tab="ask">🤖 اسألني</button><button class="top-ai-tab" data-tab="decision">🎯 محرك القرار</button><button class="top-ai-tab" data-tab="chat">💬 ChatGPT</button><button class="top-ai-tab" data-tab="voice">🎙️ الأوامر الصوتية</button><button class="top-ai-tab" data-tab="settings">⚙️ إعدادات OpenAI</button></div><div class="top-ai-body">'+
    '<section class="top-ai-view" id="view-analytics"><div class="top-ai-grid"><div class="top-ai-card"><h3>اكتمال البيانات</h3><div class="top-ai-number" id="scoreCompletion">--</div></div><div class="top-ai-card"><h3>جودة المحتوى</h3><div class="top-ai-number" id="scoreQuality">--</div></div><div class="top-ai-card"><h3>مؤشر المخاطر</h3><div class="top-ai-number" id="scoreRisk">--</div></div></div><div class="top-ai-actions"><button type="button" id="btnLocalAnalytics">تحليل محلي</button><button type="button" class="secondary" id="btnAIAnalytics">تحليل عبر OpenAI</button><button type="button" class="secondary" id="btnSaveAnalytics">حفظ في الأرشيف</button></div><div class="top-ai-result" id="analyticsResult"></div></section>'+
    '<section class="top-ai-view" id="view-report"><div class="top-ai-grid"><div class="top-ai-card"><h3>نوع التقرير</h3><select id="reportType" class="top-ai-select"><option>تقرير مبادرة</option><option>تقرير زيارة صفية</option><option>تقرير متابعة</option><option>تقرير خطة تحسين</option><option>محضر اجتماع</option></select></div><div class="top-ai-card"><h3>المجال</h3><select id="reportDomain" class="top-ai-select"><option>القيادة المدرسية</option><option>التعليم والتعلم</option><option>نواتج التعلم</option><option>البيئة المدرسية</option></select></div></div><textarea id="reportSeed" class="top-ai-textarea" placeholder="اكتب فكرة التقرير..."></textarea><div class="top-ai-actions"><button type="button" id="btnLocalReport">توليد محلي</button><button type="button" class="secondary" id="btnAIReport">توليد عبر OpenAI</button><button type="button" class="secondary" id="btnSaveReport">حفظ في الأرشيف</button></div><div class="top-ai-result" id="reportResult"></div></section>'+
    '<section class="top-ai-view" id="view-archive"><input id="archiveSearch" class="top-ai-input" placeholder="بحث في الأرشيف الذكي..."><div class="top-ai-actions"><button type="button" id="btnSavePage">أرشفة الصفحة الحالية</button><button type="button" class="secondary" id="btnClearArchive">مسح الأرشيف</button></div><div class="top-ai-archive-list" id="archiveList"></div></section>'+
    '<section class="top-ai-view" id="view-platform"><div class="top-ai-actions"><button type="button" id="btnPlatformAI">اقتراح تحسينات</button><button type="button" class="secondary" id="btnSavePlatform">حفظ في الأرشيف</button></div><div class="top-ai-result" id="platformResult">اضغط اقتراح تحسينات.</div></section>'+
    '<section class="top-ai-view" id="view-ask"><textarea id="askPrompt" class="top-ai-textarea" placeholder="اكتب سؤالك هنا..."></textarea><div class="top-ai-actions"><button type="button" id="btnAskAI">إرسال السؤال</button></div><div class="top-ai-result" id="askResult"></div></section>'+
    '<section class="top-ai-view" id="view-decision"><div class="top-ai-actions"><button type="button" id="btnDecisionAI">تحليل القرار</button><button type="button" class="secondary" id="btnSaveDecision">حفظ في الأرشيف</button></div><div class="top-ai-result" id="decisionResult">اضغط تحليل القرار.</div></section>'+'<section class="top-ai-view" id="view-chat"><div class="top-ai-chat-box" id="chatBox"><div class="top-ai-msg ai">مرحبًا، أنا مساعد ChatGPT داخل AI CENTER. اكتب طلبك أو استخدم الصوت.</div></div><textarea id="chatPrompt" class="top-ai-textarea" placeholder="اكتب رسالتك هنا..."></textarea><div class="top-ai-actions"><button type="button" id="btnChatSend">إرسال</button><button type="button" class="secondary" id="btnChatVoice">إملاء صوتي</button><button type="button" class="secondary" id="btnChatClear">مسح المحادثة</button></div></section>'+
    '<section class="top-ai-view" id="view-voice"><div class="top-ai-card"><h3>🎙️ الأوامر الصوتية</h3><p>اضغط بدء الاستماع، ثم قل مثلًا: حلل الصفحة، اكتب تقرير مبادرة، افتح مولد التقارير، اقترح قرارًا.</p><span class="top-ai-voice-dot" id="voiceStatus">غير نشط</span></div><div class="top-ai-actions"><button type="button" id="btnVoiceStart">بدء الاستماع</button><button type="button" class="secondary" id="btnVoiceStop">إيقاف</button><button type="button" class="secondary" id="btnVoiceRun">تنفيذ النص</button></div><textarea id="voiceText" class="top-ai-textarea" placeholder="سيظهر النص الصوتي هنا..."></textarea><div class="top-ai-result" id="voiceResult">جاهز لاستقبال الأوامر الصوتية.</div></section>'+
    '<section class="top-ai-view" id="view-settings"><div class="top-ai-card"><h3>حالة الربط</h3><p id="openaiStatus">غير معروف</p></div><div class="top-ai-grid"><div class="top-ai-card"><h3>مفتاح OpenAI API</h3><input id="openaiKeyInput" class="top-ai-input" type="password" placeholder="sk-..."></div><div class="top-ai-card"><h3>الموديل</h3><select id="openaiModelInput" class="top-ai-select"><option value="gpt-4o-mini">gpt-4o-mini</option><option value="gpt-4.1-mini">gpt-4.1-mini</option><option value="gpt-4o">gpt-4o</option></select></div></div><div class="top-ai-actions"><button type="button" id="btnSaveOpenAISettings">حفظ الإعدادات</button><button type="button" class="secondary" id="btnTestOpenAI">اختبار الاتصال</button></div><div class="top-ai-result" id="settingsResult">احفظ المفتاح محليًا في هذا المتصفح لاستخدام أدوات AI CENTER.</div></section>'+
    '</div></div>';
    document.body.appendChild(modal);
    modal.querySelector('.top-ai-close').onclick=closeModal;
    modal.addEventListener('click',function(e){if(e.target===modal)closeModal()});
    modal.querySelectorAll('.top-ai-tab').forEach(function(b){b.onclick=function(){showTab(b.dataset.tab)}});
    document.getElementById('btnLocalAnalytics').onclick=runLocalAnalytics;
    document.getElementById('btnAIAnalytics').onclick=runAIAnalytics;
    document.getElementById('btnSaveAnalytics').onclick=function(){saveToArchive('تحليل',document.getElementById('analyticsResult').textContent)};
    document.getElementById('btnLocalReport').onclick=generateLocalReport;
    document.getElementById('btnAIReport').onclick=generateAIReport;
    document.getElementById('btnSaveReport').onclick=function(){saveToArchive('تقرير',document.getElementById('reportResult').textContent)};
    document.getElementById('archiveSearch').oninput=renderArchive;
    document.getElementById('btnSavePage').onclick=function(){saveToArchive('صفحة',collectContext())};
    document.getElementById('btnClearArchive').onclick=function(){if(confirm('مسح الأرشيف الذكي؟')){localStorage.removeItem('top_ai_center_archive_v1');renderArchive()}};
    document.getElementById('btnPlatformAI').onclick=runPlatformAI;
    document.getElementById('btnSavePlatform').onclick=function(){saveToArchive('ذكاء المنصة',document.getElementById('platformResult').textContent)};
    document.getElementById('btnAskAI').onclick=runAsk;
    document.getElementById('btnDecisionAI').onclick=runDecision;
    document.getElementById('btnSaveDecision').onclick=function(){saveToArchive('قرار',document.getElementById('decisionResult').textContent)};
    function refreshOpenAIStatus(){
      var st=document.getElementById('openaiStatus');
      var model=document.getElementById('openaiModelInput');
      if(model && window.OpenAIEngine && window.OpenAIEngine.getModel) model.value=window.OpenAIEngine.getModel();
      if(st) st.textContent=(window.OpenAIEngine && window.OpenAIEngine.isConfigured && window.OpenAIEngine.isConfigured())?'OpenAI متصل ومحفوظ محليًا':'لم يتم حفظ مفتاح OpenAI بعد';
    }
    document.getElementById('btnSaveOpenAISettings').onclick=function(){
      try{
        var key=document.getElementById('openaiKeyInput').value;
        var model=document.getElementById('openaiModelInput').value;
        if(window.OpenAIEngine && key) window.OpenAIEngine.setApiKey(key);
        if(window.OpenAIEngine) window.OpenAIEngine.setModel(model);
        document.getElementById('openaiKeyInput').value='';
        refreshOpenAIStatus();
    document.getElementById('btnChatSend').onclick=sendChatMessage;
    document.getElementById('btnChatClear').onclick=clearChat;
    document.getElementById('btnChatVoice').onclick=function(){startVoice('chatPrompt')};
    document.getElementById('btnVoiceStart').onclick=function(){startVoice('voiceText')};
    document.getElementById('btnVoiceStop').onclick=stopVoice;
    document.getElementById('btnVoiceRun').onclick=runVoiceCommand;
        result('settingsResult','تم حفظ إعدادات OpenAI محليًا بنجاح.');
      }catch(e){result('settingsResult','تعذر الحفظ: '+e.message)}
    };
    document.getElementById('btnTestOpenAI').onclick=async function(){
      refreshOpenAIStatus();
    document.getElementById('btnChatSend').onclick=sendChatMessage;
    document.getElementById('btnChatClear').onclick=clearChat;
    document.getElementById('btnChatVoice').onclick=function(){startVoice('chatPrompt')};
    document.getElementById('btnVoiceStart').onclick=function(){startVoice('voiceText')};
    document.getElementById('btnVoiceStop').onclick=stopVoice;
    document.getElementById('btnVoiceRun').onclick=runVoiceCommand;
      result('settingsResult','⏳ جارٍ اختبار الاتصال...');
      try{result('settingsResult',await callAI('اختبار اتصال مختصر. أجب بجملة واحدة: تم الاتصال بنجاح.'))}
      catch(e){result('settingsResult','فشل اختبار الاتصال: '+e.message)}
    };
    refreshOpenAIStatus();
    document.getElementById('btnChatSend').onclick=sendChatMessage;
    document.getElementById('btnChatClear').onclick=clearChat;
    document.getElementById('btnChatVoice').onclick=function(){startVoice('chatPrompt')};
    document.getElementById('btnVoiceStart').onclick=function(){startVoice('voiceText')};
    document.getElementById('btnVoiceStop').onclick=stopVoice;
    document.getElementById('btnVoiceRun').onclick=runVoiceCommand;
  }
  function createIcon(){
    if(document.getElementById('topAiCenterIcon'))return;
    createModal();
    var btn=document.createElement('button'); btn.id='topAiCenterIcon'; btn.type='button'; btn.title='AI CENTER'; btn.innerHTML=iconSvg+'<span>AI CENTER</span>'; btn.onclick=openModal;
    document.body.appendChild(btn);
  }
  function boot(){injectStyle();createIcon()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
  window.openTopAiCenter=openModal;
})();
