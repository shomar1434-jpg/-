/* Smart School AI Widget - safe frontend connector
   لا يحتوي هذا الملف على مفتاح OpenAI. الاتصال الحقيقي يتم عبر Supabase Edge Function. */
(function(){
  if (window.__smartSchoolAiWidgetV2) return;
  window.__smartSchoolAiWidgetV2 = true;

  const AI_ENDPOINT = window.SMART_SCHOOL_AI_ENDPOINT || 'https://mfzsgaqxvxusayoribfo.supabase.co/functions/v1/ASK-AI';
  const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || 'sb_publishable_wrqnWejHyIhaYnMusFfDQQ_6NBvAK9N';

  function roleName(){
    const path = (location.pathname || '').toLowerCase();
    if (path.includes('manager')) return 'مدير المدرسة';
    if (path.includes('agent')) return 'وكيل المدرسة';
    if (path.includes('teacher')) return 'المعلم';
    return 'منصة القيادة المدرسية';
  }
  function pageText(){
    const txt = (document.body && document.body.innerText || '').replace(/\s+/g,' ').trim();
    return txt.slice(0, 6500);
  }
  function $(id){return document.getElementById(id)}
  function el(tag, cls, txt){const e=document.createElement(tag); if(cls)e.className=cls; if(txt!==undefined)e.textContent=txt; return e;}
  function addStyle(){
    if ($('smart-school-ai-style')) return;
    const st = document.createElement('style'); st.id='smart-school-ai-style';
    st.textContent = `
      .ss-ai-dock{position:fixed;left:18px;bottom:18px;z-index:2147482500;display:flex;flex-direction:column;gap:10px;font-family:Cairo,Arial,sans-serif;direction:rtl}
      .ss-ai-btn{border:0;border-radius:999px;padding:11px 16px;color:#fff;font-weight:900;cursor:pointer;box-shadow:0 14px 35px rgba(15,23,42,.24);font-size:13px;min-width:142px;text-align:center}
      .ss-ai-btn.platform{background:linear-gradient(135deg,#0f766e,#14b8a6)}
      .ss-ai-btn.ask{background:linear-gradient(135deg,#1d4ed8,#3b82f6)}
      .ss-ai-btn.decision{background:linear-gradient(135deg,#7c3aed,#a855f7)}
      .ss-ai-overlay{position:fixed;inset:0;background:rgba(15,23,42,.58);z-index:2147482499;display:none;align-items:center;justify-content:center;font-family:Cairo,Arial,sans-serif;direction:rtl;padding:14px}
      .ss-ai-overlay.open{display:flex}
      .ss-ai-modal{width:min(920px,96vw);max-height:90vh;background:#fff;border-radius:28px;box-shadow:0 35px 90px rgba(0,0,0,.32);overflow:hidden;color:#0f172a;display:flex;flex-direction:column}
      .ss-ai-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 18px;background:linear-gradient(135deg,#ecfdf5,#eff6ff);border-bottom:1px solid #dbeafe}
      .ss-ai-title{font-weight:1000;font-size:18px;color:#0f766e}.ss-ai-sub{font-size:11px;color:#64748b;font-weight:800;margin-top:3px}
      .ss-ai-close{border:0;background:#ef4444;color:#fff;border-radius:999px;padding:8px 13px;font-weight:900;cursor:pointer}
      .ss-ai-body{padding:16px;overflow:auto}.ss-ai-grid{display:grid;grid-template-columns:1.1fr .9fr;gap:12px}.ss-ai-card{border:1px solid #e2e8f0;border-radius:20px;background:#f8fafc;padding:12px}
      .ss-ai-label{font-size:12px;font-weight:900;color:#334155;margin-bottom:6px}.ss-ai-textarea{width:100%;min-height:165px;border:1px solid #cbd5e1;border-radius:16px;padding:12px;resize:vertical;font-family:inherit;font-weight:700;background:#fff;color:#0f172a;outline:none}
      .ss-ai-select,.ss-ai-input{width:100%;border:1px solid #cbd5e1;border-radius:14px;padding:10px;margin-top:8px;font-family:inherit;font-weight:800;background:#fff;color:#0f172a;outline:none}
      .ss-ai-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}.ss-ai-action{border:0;border-radius:14px;padding:10px 14px;font-weight:900;cursor:pointer;background:#0f766e;color:#fff}.ss-ai-action.alt{background:#1d4ed8}.ss-ai-action.gray{background:#475569}.ss-ai-action.purple{background:#7c3aed}.ss-decision-badge{display:inline-flex;align-items:center;gap:6px;border-radius:999px;padding:6px 10px;font-weight:1000;font-size:12px;margin:3px;background:#ede9fe;color:#5b21b6}.ss-decision-box{border:1px solid #ddd6fe;background:#faf5ff;border-radius:18px;padding:12px;margin-top:10px;line-height:1.9}.ss-decision-score{font-size:34px;font-weight:1000;color:#5b21b6}
      .ss-ai-output{white-space:pre-wrap;line-height:1.9;min-height:230px;background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:13px;font-size:13px;color:#0f172a}
      .ss-ai-note{font-size:11px;color:#64748b;font-weight:800;line-height:1.8;margin-top:8px}.ss-ai-error{color:#b91c1c;font-weight:900}.ss-ai-ok{color:#0f766e;font-weight:900}
      @media(max-width:760px){.ss-ai-grid{grid-template-columns:1fr}.ss-ai-dock{left:12px;bottom:12px}.ss-ai-btn{min-width:122px;padding:10px 12px;font-size:12px}.ss-ai-modal{max-height:92vh}}
      @media print{.ss-ai-dock,.ss-ai-overlay{display:none!important}}
    `;
    document.head.appendChild(st);
  }
  function build(){
    if ($('ss-ai-dock')) return;
    addStyle();
    const dock = el('div','ss-ai-dock'); dock.id='ss-ai-dock';
    const platform = el('button','ss-ai-btn platform','✨ ذكاء المنصة'); platform.type='button'; platform.onclick=()=>openAi('platform');
    const ask = el('button','ss-ai-btn ask','🤖 اسألني'); ask.type='button'; ask.onclick=()=>openAi('ask');
    const decision = el('button','ss-ai-btn decision','🧠 محرك القرار'); decision.type='button'; decision.onclick=()=>openDecisionEngine();
    dock.appendChild(platform); dock.appendChild(ask); dock.appendChild(decision); document.body.appendChild(dock);

    const overlay = el('div','ss-ai-overlay'); overlay.id='ss-ai-overlay';
    overlay.innerHTML = `
      <div class="ss-ai-modal" role="dialog" aria-modal="true" aria-labelledby="ss-ai-title">
        <div class="ss-ai-head">
          <div><div class="ss-ai-title" id="ss-ai-title">ذكاء المنصة</div><div class="ss-ai-sub" id="ss-ai-sub">تحليل، صياغة، توصيات، وأسئلة مرتبطة بسياق المنصة.</div></div>
          <button type="button" class="ss-ai-close" id="ss-ai-close">إغلاق</button>
        </div>
        <div class="ss-ai-body">
          <div class="ss-ai-grid">
            <div class="ss-ai-card">
              <div class="ss-ai-label" id="ss-ai-prompt-label">اكتب طلبك</div>
              <textarea id="ss-ai-prompt" class="ss-ai-textarea" placeholder="مثال: حلل هذا التقرير واقترح توصيات قابلة للتنفيذ..."></textarea>
              <select id="ss-ai-task" class="ss-ai-select">
                <option value="platform">تحليل إداري وتوصيات</option>
                <option value="ask">إجابة مباشرة على سؤال</option>
                <option value="write">صياغة خطاب أو تعميم رسمي</option>
                <option value="meeting">تلخيص محضر اجتماع واستخراج مهام</option>
                <option value="search">استنتاج من محتوى الصفحة الحالية</option>
                <option value="decision">AI Decision Engine - محرك القرار</option>
              </select>
              <div class="ss-ai-actions">
                <button type="button" class="ss-ai-action" id="ss-ai-send">تنفيذ بالذكاء الاصطناعي</button>
                <button type="button" class="ss-ai-action alt" id="ss-ai-context">استخدام محتوى الصفحة كسياق</button>
                <button type="button" class="ss-ai-action gray" id="ss-ai-copy">نسخ النتيجة</button>
              </div>
              <div class="ss-ai-note">المفتاح لا يوضع داخل هذا الملف. يجب ضبطه في Supabase Secret باسم <b>OPENAI_API_KEY</b>.</div>
            </div>
            <div class="ss-ai-card">
              <div class="ss-ai-label">الناتج</div>
              <div class="ss-ai-output" id="ss-ai-output">جاهز للعمل عبر دالة ASK-AI المنشورة في Supabase.</div>
            </div>
          </div>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    $('ss-ai-close').onclick=closeAi; overlay.onclick=(e)=>{if(e.target===overlay) closeAi();};
    $('ss-ai-context').onclick=()=>{ $('ss-ai-prompt').value = ($('ss-ai-prompt').value ? $('ss-ai-prompt').value + '\n\n' : '') + 'اعتمد على سياق الصفحة الحالي في الإجابة.'; setOutput('تم تجهيز سياق الصفحة للإرسال مع الطلب.'); };
    $('ss-ai-copy').onclick=async()=>{try{await navigator.clipboard.writeText($('ss-ai-output').innerText||''); setOutput(($('ss-ai-output').innerText||'')+'\n\n✅ تم نسخ النتيجة.');}catch(e){alert('تعذر النسخ تلقائيًا. انسخ النص يدويًا.');}};
    $('ss-ai-send').onclick=sendAi;
  }
  function setOutput(t, cls){const o=$('ss-ai-output'); if(o){o.className='ss-ai-output '+(cls||''); o.textContent=t;}}
  function openAi(mode){
    build();
    $('ss-ai-overlay').classList.add('open');
    $('ss-ai-task').value = mode === 'ask' ? 'ask' : 'platform';
    $('ss-ai-title').textContent = mode === 'ask' ? 'اسألني' : 'ذكاء المنصة';
    $('ss-ai-sub').textContent = mode === 'ask' ? 'اطرح سؤالًا وسيتم الرد من خلال الذكاء الاصطناعي.' : 'تحليل سياق المنصة وإنتاج توصيات ومخرجات رسمية.';
    $('ss-ai-prompt-label').textContent = mode === 'ask' ? 'سؤالك' : 'النص أو المهمة';
    $('ss-ai-prompt').focus();
  }
  function closeAi(){const o=$('ss-ai-overlay'); if(o) o.classList.remove('open');}

  function collectDecisionData(){
    const inputs = Array.from(document.querySelectorAll('input, textarea, select')).slice(0,180);
    const fields = inputs.map((x,i)=>{
      const label = (x.closest('label') && x.closest('label').innerText) || x.getAttribute('aria-label') || x.placeholder || x.name || x.id || ('حقل '+(i+1));
      let value = x.type === 'checkbox' ? (x.checked ? 'نعم' : 'لا') : (x.value || '');
      return {label:String(label).slice(0,80), value:String(value).slice(0,350)};
    }).filter(x=>x.value || x.label);
    const text = pageText();
    return {role:roleName(), url:location.pathname, fields, page:text};
  }
  function localDecisionAnalysis(data){
    const hay = JSON.stringify(data, null, 2);
    const totalFields = data.fields.length || 1;
    const filled = data.fields.filter(x=>String(x.value||'').trim()).length;
    const completion = Math.round((filled/totalFields)*40);
    const evidence = /(شاهد|شواهد|مرفق|مرفقات|رابط|صورة|pdf|ملف|توثيق)/i.test(hay) ? 25 : 8;
    const dateOk = /(تاريخ|موعد|اليوم|144|202|\/)/i.test(hay) ? 20 : 8;
    const clarity = hay.length > 1200 ? 15 : hay.length > 500 ? 10 : 6;
    const score = Math.min(100, completion + evidence + dateOk + clarity);
    let level='يحتاج تدخل عاجل', decision='عدم الاعتماد مؤقتًا', action='استكمال النواقص ثم إعادة التحليل';
    if(score>=90){level='ممتاز'; decision='اعتماد وحفظ في الأرشيف'; action='الطباعة أو الإرسال ثم الأرشفة';}
    else if(score>=70){level='جيد'; decision='اعتماد مشروط'; action='مراجعة الملاحظات البسيطة قبل الإرسال';}
    else if(score>=50){level='يحتاج تحسين'; decision='إرجاع للتعديل'; action='استكمال الشواهد والحقول الأساسية';}
    const gaps=[];
    if(filled<totalFields) gaps.push('توجد حقول غير مكتملة');
    if(evidence<20) gaps.push('لا يظهر وجود شواهد أو مرفقات كافية');
    if(dateOk<15) gaps.push('التاريخ أو الموعد غير واضح');
    return {score, level, decision, action, gaps};
  }
  function formatLocalDecision(r){
    return `🧠 AI Decision Engine - نتيجة أولية\n\nدرجة القرار: ${r.score}/100\nالتصنيف: ${r.level}\nالقرار المقترح: ${r.decision}\nالإجراء التالي: ${r.action}\n\nأسباب القرار:\n${(r.gaps.length?r.gaps:['المؤشرات الأساسية مكتملة']).map(x=>'• '+x).join('\n')}\n\nملاحظة: هذه نتيجة محلية فورية، ويمكن تنفيذ التحليل المتقدم عبر زر تنفيذ بالذكاء الاصطناعي.`;
  }
  function openDecisionEngine(){
    build();
    $('ss-ai-overlay').classList.add('open');
    $('ss-ai-task').value='decision';
    $('ss-ai-title').textContent='AI Decision Engine - محرك القرار الإداري';
    $('ss-ai-sub').textContent='مرتبط بذكاء المنصة: يحلل السجلات والتقارير ويقترح قرارًا إداريًا مع الأسباب والإجراء التالي.';
    $('ss-ai-prompt-label').textContent='نطاق القرار المطلوب';
    const data=collectDecisionData();
    const local=localDecisionAnalysis(data);
    $('ss-ai-prompt').value='حلل محتوى هذه الصفحة/النموذج كوكيل مدرسة، ثم أعطني قرارًا إداريًا واضحًا مع درجة، الأسباب، النواقص، والإجراء التالي. اجعل القرار مناسبًا لمنصة القيادة المدرسية الذكية.';
    setOutput(formatLocalDecision(local));
  }
  async function sendDecisionToAI(prompt){
    const data=collectDecisionData();
    const local=localDecisionAnalysis(data);
    return `أنت AI Decision Engine داخل منصة القيادة المدرسية الذكية، ومرتبط بزر ذكاء المنصة.\nالمطلوب إصدار قرار إداري تربوي قابل للتنفيذ.\n\nقواعد القرار المحلية الأولية:\n- الدرجة الأولية: ${local.score}/100\n- التصنيف: ${local.level}\n- القرار المحلي: ${local.decision}\n- الإجراء المحلي: ${local.action}\n- النواقص: ${local.gaps.join('، ')||'لا توجد نواقص واضحة'}\n\nطلب المستخدم:\n${prompt}\n\nبيانات الصفحة/النموذج:\n${JSON.stringify(data).slice(0,9000)}\n\nأعد النتيجة بالعربية بهذه البنية فقط:\n1) القرار النهائي\n2) درجة القرار من 100\n3) أسباب القرار\n4) النواقص أو المخاطر\n5) الإجراء التالي\n6) صيغة مختصرة جاهزة للحفظ في الأرشيف`;
  }
  async function sendAi(){
    const prompt = ($('ss-ai-prompt').value||'').trim();
    const task = $('ss-ai-task').value || 'ask';
    if(!prompt){setOutput('فضلاً اكتب السؤال أو النص المطلوب تحليله.', 'ss-ai-error'); return;}
    setOutput('جاري الاتصال بخدمة الذكاء الاصطناعي...');
    try{
      const res = await fetch(AI_ENDPOINT, {
        method:'POST',
        headers:{
          'Content-Type':'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': 'Bearer ' + SUPABASE_ANON_KEY
        },
        body:JSON.stringify({
          message: `المهمة: ${task}\nدور المستخدم: ${roleName()}\n\nطلب المستخدم:\n${prompt}\n\nسياق الصفحة الحالي إن وجد:\n${pageText()}`
        })
      });
      const data = await res.json().catch(()=>({}));
      if(!res.ok){
        throw new Error(data.error || data.message || 'تعذر تنفيذ الطلب. تحقق من نشر Edge Function وضبط OPENAI_API_KEY.');
      }
      setOutput(data.response || data.result || data.answer || data.output || 'لم يصل رد واضح من الخدمة.', 'ss-ai-ok');
    }catch(err){
      setOutput('تعذر الاتصال بخدمة الذكاء الاصطناعي.\n\nالسبب: '+(err && err.message ? err.message : err)+'\n\nتأكد من: نشر الدالة ASK-AI في Supabase، وإضافة Secret باسم OPENAI_API_KEY، وإيقاف Verify JWT للدالة أو إضافة آلية تفويض.', 'ss-ai-error');
    }
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', build); else build();
})();
