
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
      .top-ai-input,.top-ai-textarea,.top-ai-select{width:100%;border:1px solid #cbd5e1;border-radius:14px;padding:12px;font-family:inherit;font-size:15px;box-sizing:border-box;background:#fff}
      .top-ai-textarea{min-height:120px;resize:vertical}
      .top-ai-actions{display:flex;gap:10px;flex-wrap:wrap;margin:12px 0}
      .top-ai-actions button{border:0;border-radius:14px;padding:10px 15px;background:#0f766e;color:#fff;font-weight:800;cursor:pointer;font-family:inherit}
      .top-ai-actions button.secondary{background:#334155}
      .top-ai-result{white-space:pre-wrap;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:14px;line-height:1.85;color:#334155;min-height:90px}
      .top-ai-number{font-size:32px;font-weight:900;color:#0f766e}
      .top-ai-archive-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:12px}
      .top-ai-archive-item{background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:14px}
      .top-ai-tag{display:inline-block;padding:5px 10px;border-radius:999px;background:#ecfeff;color:#0f766e;font-size:12px;font-weight:900;margin:3px}
      @media(max-width:768px){#topAiCenterIcon{left:14px;bottom:14px;width:68px;height:68px;border-radius:22px}.top-ai-head h2{font-size:18px}.top-ai-tabs{gap:7px}.top-ai-tab{padding:8px 10px;font-size:13px}}
      @media print{#topAiCenterIcon,#topAiCenterModal{display:none!important}}
    `;
    document.head.appendChild(s);
  }

  var iconSvg='<svg viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="topAiGradFinal" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#22d3ee"/><stop offset="52%" stop-color="#60a5fa"/><stop offset="100%" stop-color="#a855f7"/></linearGradient></defs><path d="M24 8c-7 0-12 5-12 12 0 1.8.4 3.4 1.1 4.9C8.6 27.3 6 31.9 6 37c0 7 4.8 12.8 11.3 14.4.8 5.9 5.8 10.6 12 10.6 3.4 0 6.5-1.4 8.7-3.8 2.2 2.4 5.3 3.8 8.7 3.8 6.2 0 11.2-4.7 12-10.6C65.2 49.8 70 44 70 37c0-5.1-2.6-9.7-7.1-12.1.7-1.5 1.1-3.1 1.1-4.9 0-7-5-12-12-12-3.7 0-7.1 1.7-9.3 4.3C41.1 9.7 38.5 8 35.5 8s-5.6 1.7-7.2 4.3C27.1 9.7 26.5 8 24 8Z" transform="scale(.88) translate(0 1)" fill="none" stroke="url(#topAiGradFinal)" stroke-width="4" stroke-linejoin="round"/><path d="M32 14v36M22 22h-5M23 32h-8M22 42h-5M42 22h5M41 32h8M42 42h5" stroke="url(#topAiGradFinal)" stroke-width="3.8" stroke-linecap="round"/></svg>';

  function text(v){return String(v||'').replace(/\s+/g,' ').trim()}
  function collectContext(){
    var fields=Array.from(document.querySelectorAll('input,textarea,select')).filter(function(el){return !el.closest('#topAiCenterModal')}).map(function(el){return (el.placeholder||el.name||el.id||'حقل')+': '+(el.value||'')}).filter(Boolean).slice(0,90);
    var labels=Array.from(document.querySelectorAll('h1,h2,h3,h4,p,label,button')).filter(function(el){return !el.closest('#topAiCenterModal')&&el.offsetParent!==null}).map(function(el){return text(el.innerText)}).filter(Boolean).slice(0,130);
    return fields.concat(labels).join('\n');
  }
  async function callAI(prompt){
    if(window.OpenAIEngine && typeof window.OpenAIEngine.call === 'function'){
      return await window.OpenAIEngine.call(
        'أنت مساعد قيادة مدرسية ذكي. أجب بالعربية وبصياغة إدارية منظمة ومختصرة.',
        prompt,
        {temperature:.3}
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
  function openModal(){document.getElementById('topAiCenterModal').classList.add('open'); showTab('analytics')}
  function closeModal(){document.getElementById('topAiCenterModal').classList.remove('open')}

  function runLocalAnalytics(){
    var s=localScores();
    var c=document.getElementById('scoreCompletion'), q=document.getElementById('scoreQuality'), r=document.getElementById('scoreRisk');
    if(c)c.textContent=s.completion+'%'; if(q)q.textContent=s.quality+'%'; if(r)r.textContent=s.risk+'%';
    result('analyticsResult','📊 تحليل محلي سريع:\n- اكتمال البيانات: '+s.completion+'%\n- جودة المحتوى: '+s.quality+'%\n- مؤشر المخاطر: '+s.risk+'%\n\nتوصيات:\n1. استكمال الحقول الناقصة.\n2. إضافة الشواهد ومؤشرات النجاح.\n3. توثيق النتائج في الأرشيف الذكي.\n4. استخدام مولد التقارير لتحسين الصياغة.');
  }
  async function runAIAnalytics(){
    var s=localScores(); result('analyticsResult','⏳ جارٍ التحليل عبر OpenAI...');
    try{result('analyticsResult',await callAI('حلل هذه الصفحة المدرسية وقدم نقاط القوة والنواقص والمخاطر والتوصيات التنفيذية:\n\n'+s.context))}
    catch(e){result('analyticsResult','تعذر الاتصال: '+e.message+'\n\nتم الإبقاء على التحليل المحلي.'); runLocalAnalytics()}
  }
  function generateLocalReport(){
    var type=document.getElementById('reportType').value, domain=document.getElementById('reportDomain').value, seed=text(document.getElementById('reportSeed').value)||'تم تنفيذ برنامج مدرسي لتحسين الأداء ورفع جودة المخرجات.';
    var out='عنوان التقرير: '+type+'\n\nالمجال: '+domain+'\n\nوصف مختصر:\n'+seed+'\n\nالأهداف:\n1. تحسين الأداء المدرسي في مجال '+domain+'.\n2. رفع جودة التوثيق والمتابعة.\n3. قياس أثر البرنامج على المستفيدين.\n\nإجراءات التنفيذ:\n- تحديد الفئة المستهدفة.\n- تنفيذ البرنامج وفق خطة زمنية.\n- جمع الشواهد والبيانات.\n- تحليل النتائج وقياس الأثر.\n\nالشواهد:\nصور تنفيذ، كشوف حضور، نماذج أعمال، روابط رقمية.\n\nالتوصيات:\n1. استمرار المتابعة الدورية.\n2. حفظ الشواهد في الأرشيف الذكي.\n3. ربط النتائج بمؤشرات أداء قابلة للقياس.';
    result('reportResult',out); return out;
  }
  async function generateAIReport(){
    result('reportResult','⏳ جارٍ توليد التقرير عبر OpenAI...');
    try{result('reportResult',await callAI('اكتب تقريرًا إداريًا رسميًا لمنصة مدرسية. النوع: '+document.getElementById('reportType').value+'. المجال: '+document.getElementById('reportDomain').value+'. الفكرة: '+(document.getElementById('reportSeed').value||'اقترح صياغة مناسبة')+'. اجعل التقرير منظمًا بعناوين: المقدمة، الأهداف، الإجراءات، الشواهد، الأثر، مؤشرات النجاح، التوصيات.'))}
    catch(e){result('reportResult','تعذر الاتصال: '+e.message+'\n\nنسخة محلية:\n\n'+generateLocalReport())}
  }
  async function runAsk(){
    var q=text(document.getElementById('askPrompt').value); if(!q){result('askResult','اكتب سؤالك أولًا.');return}
    result('askResult','⏳ جارٍ الإجابة...');
    try{result('askResult',await callAI('أجب عن السؤال التالي في سياق منصة قيادة مدرسية:\n'+q+'\n\nسياق الصفحة:\n'+collectContext()))}
    catch(e){result('askResult','تعذر الاتصال: '+e.message)}
  }
  async function runDecision(){
    result('decisionResult','⏳ جارٍ تحليل القرار...');
    try{result('decisionResult',await callAI('حلل سياق الصفحة واقترح قرارًا إداريًا مناسبًا مع: القرار، السبب، درجة الأولوية، الإجراء التالي.\n\n'+collectContext()))}
    catch(e){var s=localScores(); result('decisionResult','قرار محلي مقترح:\n'+(s.risk>50?'يحتاج تدخل ومتابعة عاجلة':'يحتاج متابعة دورية')+'\n\nالسبب: مؤشر المخاطر '+s.risk+'%.\nالإجراء التالي: استكمال البيانات والشواهد ثم حفظها في الأرشيف.')}
  }
  async function runPlatformAI(){
    result('platformResult','⏳ جارٍ توليد اقتراحات المنصة...');
    try{result('platformResult',await callAI('اقترح تحسينات ذكية ومباشرة لهذه الصفحة في منصة مدرسية:\n\n'+collectContext()))}
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

  function createModal(){
    if(document.getElementById('topAiCenterModal'))return;
    var modal=document.createElement('div'); modal.id='topAiCenterModal';
    modal.innerHTML='<div class="top-ai-panel"><div class="top-ai-head"><h2>AI CENTER • مركز الذكاء الاصطناعي</h2><button type="button" class="top-ai-close">إغلاق ✕</button></div><div class="top-ai-tabs"><button class="top-ai-tab" data-tab="analytics">📊 التحليل الذكي</button><button class="top-ai-tab" data-tab="report">🪄 مولد التقارير</button><button class="top-ai-tab" data-tab="archive">📁 الأرشيف الذكي</button><button class="top-ai-tab" data-tab="platform">✨ ذكاء المنصة</button><button class="top-ai-tab" data-tab="ask">🤖 اسألني</button><button class="top-ai-tab" data-tab="decision">🎯 محرك القرار</button><button class="top-ai-tab" data-tab="settings">⚙️ إعدادات OpenAI</button></div><div class="top-ai-body">'+
    '<section class="top-ai-view" id="view-analytics"><div class="top-ai-grid"><div class="top-ai-card"><h3>اكتمال البيانات</h3><div class="top-ai-number" id="scoreCompletion">--</div></div><div class="top-ai-card"><h3>جودة المحتوى</h3><div class="top-ai-number" id="scoreQuality">--</div></div><div class="top-ai-card"><h3>مؤشر المخاطر</h3><div class="top-ai-number" id="scoreRisk">--</div></div></div><div class="top-ai-actions"><button type="button" id="btnLocalAnalytics">تحليل محلي</button><button type="button" class="secondary" id="btnAIAnalytics">تحليل عبر OpenAI</button><button type="button" class="secondary" id="btnSaveAnalytics">حفظ في الأرشيف</button></div><div class="top-ai-result" id="analyticsResult"></div></section>'+
    '<section class="top-ai-view" id="view-report"><div class="top-ai-grid"><div class="top-ai-card"><h3>نوع التقرير</h3><select id="reportType" class="top-ai-select"><option>تقرير مبادرة</option><option>تقرير زيارة صفية</option><option>تقرير متابعة</option><option>تقرير خطة تحسين</option><option>محضر اجتماع</option></select></div><div class="top-ai-card"><h3>المجال</h3><select id="reportDomain" class="top-ai-select"><option>القيادة المدرسية</option><option>التعليم والتعلم</option><option>نواتج التعلم</option><option>البيئة المدرسية</option></select></div></div><textarea id="reportSeed" class="top-ai-textarea" placeholder="اكتب فكرة التقرير..."></textarea><div class="top-ai-actions"><button type="button" id="btnLocalReport">توليد محلي</button><button type="button" class="secondary" id="btnAIReport">توليد عبر OpenAI</button><button type="button" class="secondary" id="btnSaveReport">حفظ في الأرشيف</button></div><div class="top-ai-result" id="reportResult"></div></section>'+
    '<section class="top-ai-view" id="view-archive"><input id="archiveSearch" class="top-ai-input" placeholder="بحث في الأرشيف الذكي..."><div class="top-ai-actions"><button type="button" id="btnSavePage">أرشفة الصفحة الحالية</button><button type="button" class="secondary" id="btnClearArchive">مسح الأرشيف</button></div><div class="top-ai-archive-list" id="archiveList"></div></section>'+
    '<section class="top-ai-view" id="view-platform"><div class="top-ai-actions"><button type="button" id="btnPlatformAI">اقتراح تحسينات</button><button type="button" class="secondary" id="btnSavePlatform">حفظ في الأرشيف</button></div><div class="top-ai-result" id="platformResult">اضغط اقتراح تحسينات.</div></section>'+
    '<section class="top-ai-view" id="view-ask"><textarea id="askPrompt" class="top-ai-textarea" placeholder="اكتب سؤالك هنا..."></textarea><div class="top-ai-actions"><button type="button" id="btnAskAI">إرسال السؤال</button></div><div class="top-ai-result" id="askResult"></div></section>'+
    '<section class="top-ai-view" id="view-decision"><div class="top-ai-actions"><button type="button" id="btnDecisionAI">تحليل القرار</button><button type="button" class="secondary" id="btnSaveDecision">حفظ في الأرشيف</button></div><div class="top-ai-result" id="decisionResult">اضغط تحليل القرار.</div></section>'+'<section class="top-ai-view" id="view-settings"><div class="top-ai-card"><h3>حالة الربط</h3><p id="openaiStatus">غير معروف</p></div><div class="top-ai-grid"><div class="top-ai-card"><h3>مفتاح OpenAI API</h3><input id="openaiKeyInput" class="top-ai-input" type="password" placeholder="sk-..."></div><div class="top-ai-card"><h3>الموديل</h3><select id="openaiModelInput" class="top-ai-select"><option value="gpt-4o-mini">gpt-4o-mini</option><option value="gpt-4.1-mini">gpt-4.1-mini</option><option value="gpt-4o">gpt-4o</option></select></div></div><div class="top-ai-actions"><button type="button" id="btnSaveOpenAISettings">حفظ الإعدادات</button><button type="button" class="secondary" id="btnTestOpenAI">اختبار الاتصال</button></div><div class="top-ai-result" id="settingsResult">احفظ المفتاح محليًا في هذا المتصفح لاستخدام أدوات AI CENTER.</div></section>'+
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
        result('settingsResult','تم حفظ إعدادات OpenAI محليًا بنجاح.');
      }catch(e){result('settingsResult','تعذر الحفظ: '+e.message)}
    };
    document.getElementById('btnTestOpenAI').onclick=async function(){
      refreshOpenAIStatus();
      result('settingsResult','⏳ جارٍ اختبار الاتصال...');
      try{result('settingsResult',await callAI('اختبار اتصال مختصر. أجب بجملة واحدة: تم الاتصال بنجاح.'))}
      catch(e){result('settingsResult','فشل اختبار الاتصال: '+e.message)}
    };
    refreshOpenAIStatus();
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
