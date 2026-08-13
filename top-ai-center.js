(function(){
  if(window.__SCHOOL_COPILOT_AI_CENTER_READY__) return;
  window.__SCHOOL_COPILOT_AI_CENTER_READY__ = true;

  var state = {
    chat: [],
    lastOutput: '',
    lastFileText: '',
    lastFileName: '',
    recognition: null,
    currentMode: 'home'
  };

  function clean(v){return String(v||'').replace(/\s+/g,' ').trim();}
  function byId(id){return document.getElementById(id);}
  function safeHtml(s){return String(s||'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c];});}
  function storageGet(keys){
    for(var i=0;i<keys.length;i++){
      try{var v=localStorage.getItem(keys[i])||sessionStorage.getItem(keys[i]); if(v) return v;}catch(e){}
    }
    return '';
  }
  function queryGet(k){try{return new URLSearchParams(location.search||'').get(k)||'';}catch(e){return '';}}
  function detectSection(){
    var p=(location.pathname.split('/').pop()||'').toLowerCase();
    var t=clean(document.title||'')+' '+clean((document.querySelector('h1,h2,.section-title,.page-title')||{}).innerText||'');
    if(p.indexOf('manager')>-1 || /مدير|المدير|القيادة/.test(t)) return 'قسم المدير/المديرة';
    if(p.indexOf('agent')>-1 || p.indexOf('wakil')>-1 || /وكيل|الوكيل/.test(t)) return 'قسم الوكيل/الوكيلة';
    if(p.indexOf('health_advisor')>-1 || /الموجه الصحي/.test(t)) return 'قسم الموجه الصحي'; if(p.indexOf('kindergarten_teacher')>-1 || /معلمة رياض الأطفال/.test(t)) return 'قسم معلمة رياض الأطفال'; if(p.indexOf('teacher')>-1 || /معلم|المعلم/.test(t)) return 'قسم المعلم/المعلمة';
    if(p.indexOf('student_advisor')>-1 || /موجه|مرشد|التوجيه/.test(t)) return 'قسم الموجه/الموجهة الطلابي/ة';
    if(p.indexOf('activity')>-1 || /رائد النشاط|رائدة النشاط|النشاط/.test(t)) return 'قسم رائد/رائدة النشاط';
    return clean(t)||'القسم الحالي';
  }
  function roleLabel(role){
    var r=String(role||'').toLowerCase();
    if(/manager|leadership/.test(r)) return 'مدير/مديرة المدرسة';
    if(/agent|agency|wakil/.test(r)) return 'وكيل/وكيلة المدرسة';
    if(/health_advisor/.test(r)) return 'الموجه الصحي'; if(/kindergarten_teacher/.test(r)) return 'معلمة رياض الأطفال'; if(/teacher|performance/.test(r)) return 'معلم/معلمة';
    if(/advisor|student/.test(r)) return 'موجه/موجهة طلابية';
    if(/activity/.test(r)) return 'رائد/رائدة النشاط';
    return role||'مستخدم/ة';
  }
  function getMeta(){
    var role=queryGet('role')||queryGet('viewerRole')||storageGet(['currentRole','smart_school_active_role','user_role','role']);
    return {
      section: detectSection(),
      role: roleLabel(role),
      schoolName: queryGet('schoolName')||queryGet('school_name')||storageGet(['current_school_name','school_name','persist_school']),
      schoolId: queryGet('schoolId')||queryGet('school_id')||storageGet(['current_school_id','school_id','active_school_id']),
      userName: storageGet(['currentUserName','current_user_name','userName','teacherName','managerName'])||queryGet('name'),
      userEmail: storageGet(['currentUserEmail','current_user_email','userEmail'])||queryGet('email')
    };
  }
  function visibleFields(){
    return Array.from(document.querySelectorAll('input,textarea,select'))
      .filter(function(el){return !el.closest('#schoolCopilotModal') && el.type!=='hidden' && !el.disabled;})
      .map(function(el,idx){
        var label='';
        try{
          if(el.id){var lab=document.querySelector('label[for="'+CSS.escape(el.id)+'"]'); if(lab) label=clean(lab.innerText);}
          if(!label){var near=el.closest('label,.form-group,.field,.row,.input-group,td,div'); if(near) label=clean(near.innerText).slice(0,90);}
        }catch(e){}
        return {index:idx, id:el.id||'', name:el.name||'', placeholder:el.placeholder||'', label:label||el.name||el.id||el.placeholder||('حقل '+(idx+1)), value:el.value||'', tag:el.tagName.toLowerCase(), type:el.type||''};
      });
  }
  function collectContext(){
    var m=getMeta();
    var fields=visibleFields().slice(0,120).map(function(f){return f.label+': '+(f.value||'[فارغ]');}).join('\n');
    var visibleText=Array.from(document.querySelectorAll('h1,h2,h3,h4,p,label,button,th,td,option'))
      .filter(function(el){return !el.closest('#schoolCopilotModal') && el.offsetParent!==null;})
      .map(function(el){return clean(el.innerText);}).filter(Boolean).slice(0,160).join('\n');
    return '[سياق المنصة]\nاسم المنصة: منصة الإدارة المدرسية الذكية\nالقسم الحالي: '+m.section+'\nالدور: '+m.role+'\nالمدرسة: '+(m.schoolName||'غير محددة')+'\nالمستخدم: '+(m.userName||'غير محدد')+'\n\n[الحقول الحالية]\n'+fields+'\n\n[عناصر الصفحة الظاهرة]\n'+visibleText+'\n\n[محتوى الملف المرفوع إن وجد]\n'+(state.lastFileText||state.lastFileName||'لا يوجد ملف مرفوع');
  }
  function instruction(){
    var m=getMeta();
    return 'أنت AI School Copilot، المساعد المدرسي الذكي داخل منصة الإدارة المدرسية الذكية. أجب بالعربية الفصحى المناسبة للمدارس في السعودية. التزم بسياق القسم الحالي فقط: '+m.section+'. اجعل المخرجات قابلة للتنفيذ داخل النموذج المفتوح، ولا تقترح نموذجًا جديدًا إذا كان المطلوب استكمال نموذج قائم. استخدم صيغًا تصلح للجنسين.';
  }
  async function callAI(prompt){
    if(window.OpenAIEngine && typeof window.OpenAIEngine.call==='function') return await window.OpenAIEngine.call(instruction(), prompt, {temperature:.25});
    if(typeof window.callOpenAI==='function') return await window.callOpenAI(prompt);
    throw new Error('لم يتم العثور على OpenAI Engine في هذه الصفحة.');
  }
  function fallback(kind){
    var m=getMeta();
    var base='القسم: '+m.section+'\n\n';
    if(kind==='file') return base+'تحليل أولي للملف:\n- تحديد نقاط القوة والاحتياج.\n- تحويل الملاحظات إلى إجراءات عملية.\n- اقتراح شواهد مناسبة.\n- إعداد خطة تحسين أو خطة علاجية حسب نوع الملف.\n\nملاحظة: لاستخراج نص PDF/Word بدقة يلزم ربط محرك معالجة ملفات أو إرسال النص المقروء للذكاء.';
    if(kind==='complete') return base+'استكمال مقترح للنموذج:\nالهدف: تحسين مستوى الأداء في المجال المحدد وفق مؤشرات قابلة للقياس.\nالإجراءات: تحليل الوضع الراهن، تحديد الفجوات، تنفيذ تدخلات علاجية، متابعة الأثر.\nالشواهد: صور التنفيذ، كشوف الحضور، نماذج الأعمال، روابط رقمية، تقارير قياس الأثر.\nالتوصيات: استمرار المتابعة، توثيق النتائج، بناء خطة تحسين مستمرة.';
    if(kind==='plan') return base+'خطة مقترحة:\n1. تشخيص الحالة بناءً على البيانات المتاحة.\n2. تحديد الهدف ومؤشر النجاح.\n3. تنفيذ إجراءات علاجية أو تحسينات محددة.\n4. جمع الشواهد.\n5. قياس الأثر ومراجعة النتائج.\n6. حفظ الناتج داخل النموذج والأرشيف.';
    return base+'يمكنني مساعدتك في تحليل ملف، إكمال نموذج، بناء خطة، صياغة هدف وشواهد، أو مراجعة التقرير قبل الحفظ.';
  }
  function injectStyle(){
    if(byId('school-copilot-style')) return;
    var s=document.createElement('style');
    s.id='school-copilot-style';
    s.textContent='\
      #topAiCenterIcon{position:fixed;left:18px;bottom:18px;z-index:2147483000;width:58px;height:58px;border:0;border-radius:18px;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;background:radial-gradient(circle at 20% 20%,rgba(168,85,247,.95),transparent 35%),radial-gradient(circle at 82% 82%,rgba(34,211,238,.95),transparent 35%),linear-gradient(145deg,#020617,#0f172a,#111827);box-shadow:0 18px 50px rgba(15,23,42,.42),0 0 34px rgba(34,211,238,.30);color:#fff;font-family:inherit;transition:.18s ease}#topAiCenterIcon:hover{transform:translateY(-2px) scale(1.03)}#topAiCenterIcon svg{width:28px;height:28px}#topAiCenterIcon span{font-size:7px;font-weight:900;letter-spacing:.4px}\
      #schoolCopilotModal{position:fixed;inset:0;z-index:2147483647;display:none;align-items:center;justify-content:center;background:rgba(15,23,42,.58);backdrop-filter:blur(7px);direction:rtl;font-family:inherit;padding:18px}#schoolCopilotModal.open{display:flex}.sc-panel{width:min(1120px,96vw);max-height:92vh;overflow:auto;border-radius:28px;background:#f8fafc;box-shadow:0 30px 90px rgba(0,0,0,.35);border:1px solid rgba(148,163,184,.35)}.sc-head{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:18px 22px;background:linear-gradient(135deg,#020617,#0f172a,#155e75);color:#fff}.sc-head h2{margin:0;font-size:22px}.sc-sub{font-size:12px;font-weight:800;opacity:.9}.sc-close{border:0;border-radius:14px;padding:10px 14px;background:rgba(255,255,255,.16);color:#fff;font-weight:800;cursor:pointer;font-family:inherit}.sc-body{padding:18px}.sc-home{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px;margin-bottom:16px}.sc-card{background:#fff;border:1px solid #e2e8f0;border-radius:20px;padding:16px;box-shadow:0 12px 30px rgba(15,23,42,.08)}.sc-task{cursor:pointer;text-align:right;transition:.15s ease}.sc-task:hover{transform:translateY(-2px);border-color:#0f766e}.sc-task.active{border-color:#0f766e;background:#ecfeff}.sc-card h3{margin:0 0 8px;color:#0f172a;font-size:17px}.sc-card p{margin:0;color:#64748b;line-height:1.7;font-size:13px}.sc-work{display:grid;grid-template-columns:1fr;gap:12px}.sc-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}.sc-input,.sc-textarea,.sc-select{width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:14px;padding:12px;font-family:inherit;font-size:15px;background:#fff;color:#0f172a!important;direction:rtl;text-align:right;-webkit-text-fill-color:#0f172a!important}.sc-textarea{min-height:118px;resize:vertical}.sc-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:10px}.sc-actions button{border:0;border-radius:14px;padding:10px 15px;background:#0f766e;color:#fff;font-weight:800;cursor:pointer;font-family:inherit}.sc-actions button.secondary{background:#334155}.sc-actions button.warn{background:#b45309}.sc-result{white-space:pre-wrap;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:14px;line-height:1.85;color:#334155;min-height:110px}.sc-chat-box{background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:14px;min-height:220px;max-height:330px;overflow:auto;display:flex;flex-direction:column;gap:10px}.sc-msg{max-width:86%;padding:10px 12px;border-radius:16px;line-height:1.8;white-space:pre-wrap}.sc-msg.user{align-self:flex-start;background:#0f766e;color:#fff;border-bottom-left-radius:4px}.sc-msg.ai{align-self:flex-end;background:#f1f5f9;color:#0f172a;border:1px solid #e2e8f0;border-bottom-right-radius:4px}.sc-pill{display:inline-block;padding:6px 10px;border-radius:999px;background:#ecfeff;color:#0f766e;font-size:12px;font-weight:900;margin:3px}.sc-hidden{display:none!important}@media(max-width:768px){#topAiCenterIcon{left:10px;bottom:10px;width:52px;height:52px}.sc-head h2{font-size:18px}.sc-home{grid-template-columns:1fr}.sc-panel{max-height:94vh}}@media print{#topAiCenterIcon,#schoolCopilotModal{display:none!important}}';
    document.head.appendChild(s);
  }
  var svg='<svg viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="scg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#22d3ee"/><stop offset="52%" stop-color="#60a5fa"/><stop offset="100%" stop-color="#a855f7"/></linearGradient></defs><path d="M18 11h28a7 7 0 0 1 7 7v28a7 7 0 0 1-7 7H18a7 7 0 0 1-7-7V18a7 7 0 0 1 7-7Z" fill="none" stroke="url(#scg)" stroke-width="4"/><path d="M22 34l7 7 15-18M22 23h10" fill="none" stroke="url(#scg)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function renderMode(mode){
    state.currentMode=mode;
    document.querySelectorAll('.sc-task').forEach(function(x){x.classList.toggle('active',x.dataset.mode===mode);});
    var title={home:'المساعد المدرسي الذكي',chat:'ChatGPT السياقي',voice:'محرر الأوامر الصوتية',file:'تحليل الملفات الذكي',complete:'أكمل النموذج بالذكاء',plan:'بناء خطة / هدف / شواهد',review:'المدقق المهني قبل الحفظ',settings:'إعدادات OpenAI'}[mode]||'المساعد المدرسي الذكي';
    byId('scWorkTitle').textContent=title;
    var html='';
    if(mode==='home') html='<div class="sc-card"><h3>واجهة مختصرة بدل ازدحام الأقسام</h3><p>اختر مهمة واحدة فقط، وسيعمل المساعد حسب القسم الحالي والنموذج المفتوح دون إنشاء نماذج مختلفة عن نماذج المنصة.</p><div class="sc-actions"><button type="button" data-go="complete">أكمل النموذج الحالي</button><button type="button" class="secondary" data-go="file">حلل ملف</button></div></div>';
    if(mode==='chat') html='<div class="sc-chat-box" id="scChatBox"><div class="sc-msg ai">مرحبًا، أنا ChatGPT داخل منصة الإدارة المدرسية الذكية. سأجيب حسب القسم والنموذج المفتوح.</div></div><textarea id="scChatPrompt" class="sc-textarea" placeholder="اكتب رسالتك هنا..."></textarea><div class="sc-actions"><button type="button" id="scSendChat">إرسال</button><button type="button" class="secondary" id="scDictateChat">إملاء صوتي</button><button type="button" class="secondary" id="scClearChat">مسح المحادثة</button></div>';
    if(mode==='voice') html='<div class="sc-card"><h3>🎙️ محرر الأوامر الصوتية</h3><p>قل مثلًا: حلل الملف، أكمل النموذج، أنشئ خطة علاجية، راجع التقرير.</p><span class="sc-pill" id="scVoiceStatus">غير نشط</span></div><textarea id="scVoiceText" class="sc-textarea" placeholder="سيظهر النص الصوتي هنا..."></textarea><div class="sc-actions"><button type="button" id="scVoiceStart">بدء الاستماع</button><button type="button" class="secondary" id="scVoiceStop">إيقاف</button><button type="button" class="secondary" id="scVoiceRun">تنفيذ النص</button></div><div class="sc-result" id="scVoiceResult">جاهز.</div>';
    if(mode==='file') html='<div class="sc-card"><h3>📂 تحليل الملفات الذكي</h3><p>ارفع ملفًا يحتاج خطة تحسين أو خطة علاجية أو استكمال تعبئة. يدعم قراءة النصوص وHTML/CSV/TXT مباشرة، وتظهر ملفات PDF/Word/Excel كبيانات ملف تمهيدًا لربط معالج ملفات لاحقًا.</p><input id="scFileInput" class="sc-input" type="file" accept=".txt,.csv,.html,.htm,.json,.pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"><textarea id="scFilePrompt" class="sc-textarea" placeholder="اكتب ما المطلوب من الملف: خطة تحسين، خطة علاجية، توصيات، استكمال نموذج..."></textarea><div class="sc-actions"><button type="button" id="scAnalyzeFile">تحليل الملف</button><button type="button" class="secondary" id="scInsertFileOutput">تنفيذ الناتج داخل النموذج</button></div></div><div class="sc-result" id="scMainResult"></div>';
    if(mode==='complete') html='<div class="sc-card"><h3>✨ أكمل النموذج المفتوح</h3><p>يقرأ المساعد حقول النموذج الحالي ويقترح تعبئة العناصر الناقصة داخل نفس النموذج، مع الحفاظ على صيغة المنصة.</p><textarea id="scCompletePrompt" class="sc-textarea" placeholder="اكتب توجيهك: أكمل خطة تحسين، اقترح أهداف وشواهد، استكمل التوصيات..."></textarea><div class="sc-actions"><button type="button" id="scCompleteForm">توليد الاستكمال</button><button type="button" class="secondary" id="scApplyToForm">تنفيذ داخل الحقول الفارغة</button></div></div><div class="sc-result" id="scMainResult"></div>';
    if(mode==='plan') html='<div class="sc-grid"><div class="sc-card"><h3>نوع المخرج</h3><select id="scPlanType" class="sc-select"><option>خطة تحسين</option><option>خطة علاجية</option><option>هدف وشواهد</option><option>توصيات ومؤشرات</option><option>خطة متابعة</option></select></div><div class="sc-card"><h3>المجال</h3><select id="scPlanDomain" class="sc-select"><option>القيادة المدرسية</option><option>التعليم والتعلم</option><option>نواتج التعلم</option><option>البيئة المدرسية</option><option>التوجيه الطلابي</option><option>النشاط الطلابي</option></select></div></div><textarea id="scPlanPrompt" class="sc-textarea" placeholder="صف الحالة أو المشكلة أو الهدف المطلوب..."></textarea><div class="sc-actions"><button type="button" id="scGeneratePlan">إنشاء</button><button type="button" class="secondary" id="scApplyPlan">تنفيذ داخل النموذج</button></div><div class="sc-result" id="scMainResult"></div>';
    if(mode==='review') html='<div class="sc-card"><h3>✅ المدقق المهني</h3><p>يراجع التقرير المفتوح قبل الحفظ: اكتمال الأهداف، الشواهد، المؤشرات، التوصيات، والصياغة.</p><div class="sc-actions"><button type="button" id="scReviewNow">راجع النموذج الحالي</button><button type="button" class="secondary" id="scImproveNow">اقترح تحسينًا قابلًا للتنفيذ</button></div></div><div class="sc-result" id="scMainResult"></div>';
    if(mode==='settings') html='<div class="sc-grid"><div class="sc-card"><h3>مفتاح OpenAI API</h3><input id="scOpenAIKey" class="sc-input" type="password" placeholder="sk-..."></div><div class="sc-card"><h3>الموديل</h3><select id="scOpenAIModel" class="sc-select"><option value="gpt-4o-mini">gpt-4o-mini</option><option value="gpt-4.1-mini">gpt-4.1-mini</option><option value="gpt-4o">gpt-4o</option></select></div></div><div class="sc-actions"><button type="button" id="scSaveSettings">حفظ الإعدادات</button><button type="button" class="secondary" id="scTestSettings">اختبار الاتصال</button></div><div class="sc-result" id="scMainResult">يحفظ المفتاح محليًا في هذا المتصفح فقط.</div>';
    byId('scWorkBody').innerHTML=html;
    bindWorkEvents(mode);
  }
  function setResult(txt){state.lastOutput=txt||''; var el=byId('scMainResult')||byId('scVoiceResult'); if(el) el.textContent=state.lastOutput;}
  function addMsg(role,txt){var box=byId('scChatBox'); if(!box) return; var d=document.createElement('div'); d.className='sc-msg '+(role==='user'?'user':'ai'); d.textContent=txt; box.appendChild(d); box.scrollTop=box.scrollHeight;}
  async function sendChat(){var inp=byId('scChatPrompt'); var q=clean(inp&&inp.value); if(!q){addMsg('ai','اكتب رسالتك أولًا.');return;} inp.value=''; addMsg('user',q); addMsg('ai','⏳ جارٍ التفكير...'); try{var ans=await callAI('أجب عن رسالة المستخدم حسب السياق والنموذج المفتوح فقط.\n\nالسؤال: '+q+'\n\n'+collectContext()); state.chat.push({q:q,a:ans}); var box=byId('scChatBox'); if(box&&box.lastChild) box.lastChild.textContent=ans;}catch(e){var b=byId('scChatBox'); if(b&&b.lastChild)b.lastChild.textContent='تعذر الاتصال: '+e.message;}}
  function getSR(){return window.SpeechRecognition||window.webkitSpeechRecognition||null;}
  function startVoice(target){var SR=getSR(); var st=byId('scVoiceStatus'); if(!SR){if(st)st.textContent='المتصفح لا يدعم التعرف الصوتي'; return;} try{if(state.recognition)state.recognition.stop(); state.recognition=new SR(); state.recognition.lang='ar-SA'; state.recognition.interimResults=true; if(st)st.textContent='جاري الاستماع...'; state.recognition.onresult=function(e){var tr=''; for(var i=e.resultIndex;i<e.results.length;i++) tr+=e.results[i][0].transcript; var t=byId(target); if(t)t.value=tr;}; state.recognition.onend=function(){if(st)st.textContent='توقف الاستماع';}; state.recognition.start();}catch(e){if(st)st.textContent='تعذر بدء الاستماع';}}
  function stopVoice(){try{if(state.recognition)state.recognition.stop();}catch(e){} var st=byId('scVoiceStatus'); if(st)st.textContent='تم الإيقاف';}
  async function runVoice(){var t=clean(byId('scVoiceText')&&byId('scVoiceText').value); if(!t){setResult('لا يوجد أمر صوتي.');return;} if(/ملف|ارفع|تحليل ملف/.test(t)){renderMode('file'); return;} if(/نموذج|أكمل|اكمل|تعبئة/.test(t)){renderMode('complete'); var p=byId('scCompletePrompt'); if(p)p.value=t; return;} if(/خطة|هدف|شواهد/.test(t)){renderMode('plan'); var pp=byId('scPlanPrompt'); if(pp)pp.value=t; return;} setResult('⏳ جارٍ تنفيذ الأمر...'); try{setResult(await callAI('نفذ الأمر الصوتي التالي داخل النموذج المفتوح: '+t+'\n\n'+collectContext()));}catch(e){setResult('تعذر الاتصال: '+e.message+'\n\n'+fallback('home'));}}
  function applyOutputToForm(){
    var out=state.lastOutput||''; if(!out){alert('لا يوجد ناتج لتنفيذه داخل النموذج.'); return;}
    var fields=Array.from(document.querySelectorAll('textarea,input:not([type=hidden]):not([type=file]),select')).filter(function(el){return !el.closest('#schoolCopilotModal') && !el.disabled && !el.readOnly && el.offsetParent!==null;});
    var textareas=fields.filter(function(el){return el.tagName.toLowerCase()==='textarea' && !clean(el.value);});
    var inputs=fields.filter(function(el){return el.tagName.toLowerCase()==='input' && ['text','search',''].indexOf(el.type||'')>-1 && !clean(el.value);});
    var parts=out.split(/\n\s*\n|\n(?=\d+[\-.]|[-•])/).map(clean).filter(Boolean);
    var used=0;
    textareas.forEach(function(el,i){if(parts[i]){el.value=parts[i]; el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})); used++;}});
    if(!used && inputs.length){inputs[0].value=out.slice(0,220); inputs[0].dispatchEvent(new Event('input',{bubbles:true})); inputs[0].dispatchEvent(new Event('change',{bubbles:true})); used++;}
    if(!used && textareas.length===0 && fields.length){alert('لم أجد حقولًا فارغة مناسبة، يمكنك نسخ الناتج يدويًا.');} else {alert('تم تنفيذ الناتج داخل '+used+' حقل/حقول فارغة في النموذج.');}
  }
  function bindWorkEvents(mode){
    document.querySelectorAll('[data-go]').forEach(function(b){b.onclick=function(){renderMode(b.dataset.go);};});
    if(mode==='chat'){byId('scSendChat').onclick=sendChat; byId('scDictateChat').onclick=function(){startVoice('scChatPrompt');}; byId('scClearChat').onclick=function(){state.chat=[]; var b=byId('scChatBox'); if(b)b.innerHTML='<div class="sc-msg ai">تم مسح المحادثة. كيف أساعدك؟</div>';};}
    if(mode==='voice'){byId('scVoiceStart').onclick=function(){startVoice('scVoiceText');}; byId('scVoiceStop').onclick=stopVoice; byId('scVoiceRun').onclick=runVoice;}
    if(mode==='file'){
      byId('scFileInput').onchange=function(){var f=this.files&&this.files[0]; if(!f)return; state.lastFileName=f.name; var canRead=/text|json|csv|html|xml|javascript|css/.test(f.type)||/\.(txt|csv|html|htm|json|js|css)$/i.test(f.name); if(canRead){var r=new FileReader(); r.onload=function(){state.lastFileText=String(r.result||'').slice(0,20000); setResult('تم تحميل النص من الملف: '+f.name+'\n\n'+state.lastFileText.slice(0,1200));}; r.readAsText(f,'UTF-8');} else {state.lastFileText=''; setResult('تم اختيار الملف: '+f.name+'\nنوع الملف: '+(f.type||'غير محدد')+'\nالحجم: '+Math.round(f.size/1024)+' KB\n\nسيتم استخدام بيانات الملف واسمه في التحليل، أما استخراج النص الكامل من PDF/Word/Excel فيحتاج معالج ملفات مخصص عند الربط النهائي.');}};
      byId('scAnalyzeFile').onclick=async function(){var prompt=clean(byId('scFilePrompt').value)||'حلل الملف واقترح خطة تحسين أو خطة علاجية حسب المحتوى.'; setResult('⏳ جارٍ تحليل الملف...'); try{setResult(await callAI(prompt+'\n\n'+collectContext()));}catch(e){setResult('تعذر الاتصال: '+e.message+'\n\n'+fallback('file'));}};
      byId('scInsertFileOutput').onclick=applyOutputToForm;
    }
    if(mode==='complete'){
      byId('scCompleteForm').onclick=async function(){var p=clean(byId('scCompletePrompt').value)||'أكمل النموذج المفتوح بما يناسب القسم الحالي.'; setResult('⏳ جارٍ استكمال النموذج...'); try{setResult(await callAI(p+'\n\nاقرأ الحقول الحالية واقترح نصوصًا مناسبة للحقول الناقصة فقط.\n\n'+collectContext()));}catch(e){setResult('تعذر الاتصال: '+e.message+'\n\n'+fallback('complete'));}};
      byId('scApplyToForm').onclick=applyOutputToForm;
    }
    if(mode==='plan'){
      byId('scGeneratePlan').onclick=async function(){var type=byId('scPlanType').value, dom=byId('scPlanDomain').value, p=clean(byId('scPlanPrompt').value)||'أنشئ مخرجًا مناسبًا.'; setResult('⏳ جارٍ الإنشاء...'); try{setResult(await callAI('أنشئ '+type+' في مجال '+dom+' بناءً على الوصف التالي، واجعلها قابلة للإدراج داخل النموذج المفتوح: '+p+'\n\n'+collectContext()));}catch(e){setResult('تعذر الاتصال: '+e.message+'\n\n'+fallback('plan'));}};
      byId('scApplyPlan').onclick=applyOutputToForm;
    }
    if(mode==='review'){
      byId('scReviewNow').onclick=async function(){setResult('⏳ جارٍ المراجعة...'); try{setResult(await callAI('راجع النموذج المفتوح مهنيًا قبل الحفظ. أعط درجة اكتمال، النواقص، الشواهد الناقصة، والتوصيات المختصرة.\n\n'+collectContext()));}catch(e){setResult('تعذر الاتصال: '+e.message+'\n\nدرجة محلية تقريبية: يحتاج مراجعة الشواهد والتوصيات قبل الحفظ.');}};
      byId('scImproveNow').onclick=async function(){setResult('⏳ جارٍ اقتراح التحسين...'); try{setResult(await callAI('اقترح تحسينات نصية قابلة للتنفيذ داخل الحقول الحالية للنموذج فقط.\n\n'+collectContext()));}catch(e){setResult('تعذر الاتصال: '+e.message+'\n\n'+fallback('complete'));}};
    }
    if(mode==='settings'){
      if(window.OpenAIEngine && window.OpenAIEngine.getModel && byId('scOpenAIModel')) byId('scOpenAIModel').value=window.OpenAIEngine.getModel();
      byId('scSaveSettings').onclick=function(){try{var key=byId('scOpenAIKey').value, model=byId('scOpenAIModel').value; if(window.OpenAIEngine){if(key)window.OpenAIEngine.setApiKey(key); if(model)window.OpenAIEngine.setModel(model); byId('scOpenAIKey').value=''; setResult('تم حفظ إعدادات OpenAI محليًا.');}else setResult('OpenAI Engine غير موجود في هذه الصفحة.');}catch(e){setResult('تعذر الحفظ: '+e.message);}};
      byId('scTestSettings').onclick=async function(){setResult('⏳ اختبار الاتصال...'); try{setResult(await callAI('اختبار اتصال. أجب: تم الاتصال بنجاح.'));}catch(e){setResult('فشل الاختبار: '+e.message);}};
    }
  }
  function createModal(){
    if(byId('schoolCopilotModal')) return;
    var m=document.createElement('div'); m.id='schoolCopilotModal';
    m.innerHTML='<div class="sc-panel"><div class="sc-head"><div><h2>AI CENTER • AI School Copilot</h2><div class="sc-sub" id="scContextBadge">المساعد المدرسي الذكي</div></div><button type="button" class="sc-close" id="scClose">إغلاق ✕</button></div><div class="sc-body"><div class="sc-home"><div class="sc-card sc-task" data-mode="chat"><h3>💬 ChatGPT</h3><p>محادثة سياقية حسب القسم.</p></div><div class="sc-card sc-task" data-mode="voice"><h3>🎙️ الأوامر الصوتية</h3><p>محرر الأوامر الصوتية كما هو.</p></div><div class="sc-card sc-task" data-mode="file"><h3>📂 تحليل ملف</h3><p>تحليل ملفات وخطط تحسين.</p></div><div class="sc-card sc-task" data-mode="complete"><h3>✨ أكمل النموذج</h3><p>استكمال الحقول داخل النموذج.</p></div><div class="sc-card sc-task" data-mode="plan"><h3>🎯 خطة / هدف / شواهد</h3><p>بناء مخرجات قابلة للتنفيذ.</p></div><div class="sc-card sc-task" data-mode="review"><h3>✅ تدقيق مهني</h3><p>مراجعة التقرير قبل الحفظ.</p></div><div class="sc-card sc-task" data-mode="settings"><h3>⚙️ OpenAI</h3><p>الإعدادات والاختبار.</p></div></div><div class="sc-card sc-work"><h3 id="scWorkTitle">المساعد المدرسي الذكي</h3><div id="scWorkBody"></div></div></div></div>';
    document.body.appendChild(m);
    byId('scClose').onclick=closeModal;
    m.addEventListener('click',function(e){if(e.target===m) closeModal();});
    m.querySelectorAll('.sc-task').forEach(function(c){c.onclick=function(){renderMode(c.dataset.mode);};});
    renderMode('home');
  }
  function openModal(){createModal(); var meta=getMeta(); var b=byId('scContextBadge'); if(b)b.textContent='السياق: '+meta.section+' • '+meta.role+(meta.schoolName?' • '+meta.schoolName:''); byId('schoolCopilotModal').classList.add('open');}
  function closeModal(){var m=byId('schoolCopilotModal'); if(m)m.classList.remove('open');}
  function createIcon(){
    if(byId('topAiCenterIcon')) return;
    var b=document.createElement('button'); b.id='topAiCenterIcon'; b.type='button'; b.title='AI CENTER'; b.innerHTML=svg+'<span>AI CENTER</span>'; b.onclick=openModal; document.body.appendChild(b);
  }
  function boot(){injectStyle(); createModal(); createIcon();}
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
  window.openTopAiCenter=openModal;
})();
