/* Smart School AI Widget - safe frontend connector
   لا يحتوي هذا الملف على مفتاح OpenAI. الاتصال الحقيقي يتم عبر Supabase Edge Function. */
(function(){
  if (window.__smartSchoolAiWidgetV2) return;
  window.__smartSchoolAiWidgetV2 = true;

  const AI_ENDPOINT = window.SMART_SCHOOL_AI_ENDPOINT || 'https://mfzsgaqxvxusayoribfo.supabase.co/functions/v1/ASK-AI';

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
      .ss-ai-overlay{position:fixed;inset:0;background:rgba(15,23,42,.58);z-index:2147482499;display:none;align-items:center;justify-content:center;font-family:Cairo,Arial,sans-serif;direction:rtl;padding:14px}
      .ss-ai-overlay.open{display:flex}
      .ss-ai-modal{width:min(920px,96vw);max-height:90vh;background:#fff;border-radius:28px;box-shadow:0 35px 90px rgba(0,0,0,.32);overflow:hidden;color:#0f172a;display:flex;flex-direction:column}
      .ss-ai-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 18px;background:linear-gradient(135deg,#ecfdf5,#eff6ff);border-bottom:1px solid #dbeafe}
      .ss-ai-title{font-weight:1000;font-size:18px;color:#0f766e}.ss-ai-sub{font-size:11px;color:#64748b;font-weight:800;margin-top:3px}
      .ss-ai-close{border:0;background:#ef4444;color:#fff;border-radius:999px;padding:8px 13px;font-weight:900;cursor:pointer}
      .ss-ai-body{padding:16px;overflow:auto}.ss-ai-grid{display:grid;grid-template-columns:1.1fr .9fr;gap:12px}.ss-ai-card{border:1px solid #e2e8f0;border-radius:20px;background:#f8fafc;padding:12px}
      .ss-ai-label{font-size:12px;font-weight:900;color:#334155;margin-bottom:6px}.ss-ai-textarea{width:100%;min-height:165px;border:1px solid #cbd5e1;border-radius:16px;padding:12px;resize:vertical;font-family:inherit;font-weight:700;background:#fff;color:#0f172a;outline:none}
      .ss-ai-select,.ss-ai-input{width:100%;border:1px solid #cbd5e1;border-radius:14px;padding:10px;margin-top:8px;font-family:inherit;font-weight:800;background:#fff;color:#0f172a;outline:none}
      .ss-ai-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}.ss-ai-action{border:0;border-radius:14px;padding:10px 14px;font-weight:900;cursor:pointer;background:#0f766e;color:#fff}.ss-ai-action.alt{background:#1d4ed8}.ss-ai-action.gray{background:#475569}
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
    dock.appendChild(platform); dock.appendChild(ask); document.body.appendChild(dock);

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
  async function sendAi(){
    const prompt = ($('ss-ai-prompt').value||'').trim();
    const task = $('ss-ai-task').value || 'ask';
    if(!prompt){setOutput('فضلاً اكتب السؤال أو النص المطلوب تحليله.', 'ss-ai-error'); return;}
    setOutput('جاري الاتصال بخدمة الذكاء الاصطناعي...');
    try{
      const res = await fetch(AI_ENDPOINT, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          message: `المهمة: ${task}\nدور المستخدم: ${roleName()}\n\nطلب المستخدم:\n${prompt}\n\nسياق الصفحة الحالي إن وجد:\n${pageText()}`
        })
      });
      const data = await res.json().catch(()=>({}));
      if(!res.ok){
        throw new Error(data.error || data.message || 'تعذر تنفيذ الطلب. تحقق من نشر Edge Function وضبط OPENAI_API_KEY.');
      }
      setOutput(data.result || data.answer || data.output || 'لم يصل رد واضح من الخدمة.', 'ss-ai-ok');
    }catch(err){
      setOutput('تعذر الاتصال بخدمة الذكاء الاصطناعي.\n\nالسبب: '+(err && err.message ? err.message : err)+'\n\nتأكد من: نشر الدالة ASK-AI في Supabase، وإضافة Secret باسم OPENAI_API_KEY، وإيقاف Verify JWT للدالة أو إضافة آلية تفويض.', 'ss-ai-error');
    }
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', build); else build();
})();
