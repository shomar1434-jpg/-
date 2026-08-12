(function(){
  'use strict';
  if(window.__SSP_BASE_SETTINGS_SOURCE__) return;
  window.__SSP_BASE_SETTINGS_SOURCE__=true;

  const STAGES=['رياض أطفال','ابتدائية','متوسطة','ثانوية'];
  function hijriYear(){
    try{
      const parts=new Intl.DateTimeFormat('en-US-u-ca-islamic-umalqura',{year:'numeric'}).formatToParts(new Date());
      const y=parseInt((parts.find(p=>p.type==='year')||{}).value,10);
      if(y>=1400&&y<=1600) return y;
    }catch(e){}
    return 1448;
  }
  const START_YEAR=Math.max(1448,hijriYear());
  const YEARS=Array.from({length:Math.max(1,1547-START_YEAR+1)},(_,i)=>START_YEAR+i);

  function parse(v){try{return JSON.parse(v||'null')}catch(e){return null}}
  function schoolId(){
    const q=new URLSearchParams(location.search||'');
    const u=parse(localStorage.getItem('currentSchoolUser'))||parse(localStorage.getItem('currentUser'))||{};
    const s=parse(localStorage.getItem('smartSchool.currentSchool'))||{};
    return String(q.get('school_id')||q.get('schoolId')||localStorage.getItem('active_school_id')||localStorage.getItem('current_school_id')||localStorage.getItem('school_id')||u.schoolId||u.school_id||s.schoolId||s.id||'').trim();
  }
  function scopedKey(){const id=schoolId();return id?'school_base_settings:'+id:'school_base_settings';}
  function read(){
    const scoped=parse(localStorage.getItem(scopedKey()))||{};
    return {
      school:String(scoped.school||localStorage.getItem('setting_school')||'').trim(),
      manager:String(scoped.manager||localStorage.getItem('def_m')||'').trim(),
      education:String(scoped.education||scoped.region||localStorage.getItem('setting_region')||'').trim(),
      year:String(scoped.year||localStorage.getItem('setting_academic_year')||START_YEAR).replace(/\s*هـ?\s*$/,'').trim(),
      signature:scoped.signature||localStorage.getItem('setting_sig')||'',
      stamp:scoped.stamp||localStorage.getItem('setting_stamp')||''
    };
  }
  function write(data){
    const cur=read(); const d=Object.assign({},cur,data||{});
    localStorage.setItem(scopedKey(),JSON.stringify(d));
    if(d.school!=null)localStorage.setItem('setting_school',d.school||'');
    if(d.manager!=null)localStorage.setItem('def_m',d.manager||'');
    if(d.education!=null)localStorage.setItem('setting_region',d.education||'');
    if(d.year!=null)localStorage.setItem('setting_academic_year',String(d.year||''));
    if(d.signature)localStorage.setItem('setting_sig',d.signature);
    if(d.stamp)localStorage.setItem('setting_stamp',d.stamp);
    window.dispatchEvent(new CustomEvent('schoolBaseSettingsUpdated',{detail:d}));
    return d;
  }
  window.SchoolBaseSettings={read,write,years:YEARS.slice(),stages:STAGES.slice(),currentAcademicYear:START_YEAR};

  function textAround(el){
    let t='';
    if(el.id){const lab=document.querySelector('label[for="'+CSS.escape(el.id)+'"]');if(lab)t+=' '+lab.textContent;}
    const p=el.closest('.fg,.field,.form-group,.form-field,.grid>div,td,th,section,div');
    if(p){const lab=p.querySelector(':scope > label, :scope > .label, label');if(lab)t+=' '+lab.textContent;}
    t+=' '+(el.getAttribute('aria-label')||'')+' '+(el.getAttribute('placeholder')||'')+' '+(el.name||'')+' '+(el.id||'');
    return t.replace(/\s+/g,' ').trim();
  }
  function isStage(el){const t=textAround(el);if(/مرحلة\s*(التنفيذ|الخطة|المهمة|المشروع|العمل)/i.test(t))return false;return /المرحلة\s*(الدراسية|التعليمية)|مرحلة\s*التعليم|school.?stage|education.?stage/i.test(t) || /^المرحلة$/i.test(t);}
  function isAcademicYear(el){const t=textAround(el);return /العام\s*الدراسي|السنة\s*الدراسية|academic.?year|school.?year/i.test(t);}
  function isJobTitle(el){const t=textAround(el);return /المسمى\s*الوظيفي|job.?title|position.?title/i.test(t);}
  function copyAttrs(a,b){for(const x of Array.from(a.attributes)){if(['type','value'].includes(x.name))continue;try{b.setAttribute(x.name,x.value)}catch(e){}}}
  function yearText(y){return String(y)+'هـ';}

  function configureStage(el){
    if(el.dataset.sspStageReady)return; el.dataset.sspStageReady='1';
    if(el.tagName==='SELECT'){
      const old=el.value;
      el.innerHTML='<option value="">-- اختر المرحلة --</option>'+STAGES.map(x=>'<option value="'+x+'">'+x+'</option>').join('');
      const map={'ابتدائي':'ابتدائية','متوسط':'متوسطة','ثانوي':'ثانوية','روضة':'رياض أطفال','رياض الاطفال':'رياض أطفال'};
      el.value=STAGES.includes(old)?old:(map[old]||'');
    }else if(el.tagName==='INPUT' && !['hidden','file','checkbox','radio'].includes((el.type||'').toLowerCase())){
      const s=document.createElement('select');copyAttrs(el,s);s.dataset.sspStageReady='1';
      s.innerHTML='<option value="">-- اختر المرحلة --</option>'+STAGES.map(x=>'<option value="'+x+'">'+x+'</option>').join('');
      const old=el.value;const map={'ابتدائي':'ابتدائية','متوسط':'متوسطة','ثانوي':'ثانوية'};s.value=STAGES.includes(old)?old:(map[old]||'');
      el.replaceWith(s);
    }
  }
  function configureYear(el){
    if(el.dataset.sspYearReady)return; el.dataset.sspYearReady='1';
    const settings=read();
    const options='<option value="">-- اختر العام الدراسي --</option>'+YEARS.map(y=>'<option value="'+y+'">'+yearText(y)+'</option>').join('');
    if(el.tagName==='SELECT'){
      const old=String(el.value||'').replace(/\D/g,'');el.innerHTML=options;el.value=YEARS.includes(+old)?old:(YEARS.includes(+settings.year)?String(settings.year):String(START_YEAR));
    }else if(el.tagName==='INPUT' && !['hidden','file','checkbox','radio'].includes((el.type||'').toLowerCase())){
      const s=document.createElement('select');copyAttrs(el,s);s.dataset.sspYearReady='1';s.innerHTML=options;
      const old=String(el.value||'').replace(/\D/g,'');s.value=YEARS.includes(+old)?old:(YEARS.includes(+settings.year)?String(settings.year):String(START_YEAR));
      el.replaceWith(s);
    }
  }
  function configureJobTitle(sel){
    if(sel.tagName!=='SELECT'||sel.dataset.sspJobReady)return;sel.dataset.sspJobReady='1';
    if(!Array.from(sel.options).some(o=>/مسمى\s*آخر/.test(o.textContent))){const o=new Option('مسمى آخر','__ssp_other__');sel.add(o);}
    const wrap=sel.parentElement||sel;
    const inp=document.createElement('input');inp.type='text';inp.placeholder='اكتب المسمى الوظيفي';inp.className=sel.className||'';inp.style.display='none';inp.style.marginTop='8px';inp.dataset.sspOtherJob='1';
    sel.insertAdjacentElement('afterend',inp);
    function toggle(){inp.style.display=sel.value==='__ssp_other__'?'block':'none';if(sel.value==='__ssp_other__')setTimeout(()=>inp.focus(),0)}
    sel.addEventListener('change',toggle);
    inp.addEventListener('change',function(){const v=inp.value.trim();if(!v)return;let o=Array.from(sel.options).find(x=>x.dataset&&x.dataset.sspCustom==='1'&&x.value===v);if(!o){o=new Option(v,v);o.dataset.sspCustom='1';sel.add(o,sel.options.length-1);}sel.value=v;inp.style.display='none';sel.dispatchEvent(new Event('change',{bubbles:true}));});
    toggle();
  }

  function semanticKind(el){
    const t=textAround(el);
    if(/اسم\s*المدرسة|school.?name/i.test(t))return 'school';
    if(/مدير\/?ة?\s*المدرسة|اسم\s*المدير|مدير\s*المدرسة|المدير\s*\/\s*المقي|المدير\s*المعتمد|principal|manager.?name/i.test(t))return 'manager';
    if(/الإدارة\s*التعليمية|إدارة\s*التعليم|المنطقة\s*التعليمية|education.?office|education.?department|region/i.test(t))return 'education';
    if(/العام\s*الدراسي|academic.?year|school.?year/i.test(t))return 'year';
    return '';
  }
  function fillBase(el){
    if(!/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName)||el.type==='file')return;
    const k=semanticKind(el);if(!k)return;const s=read();let v=s[k];if(!v)return;
    if(k==='year')v=String(v).replace(/\D/g,'');
    if(el.tagName==='SELECT'&&!Array.from(el.options).some(o=>String(o.value)===String(v))){el.add(new Option(k==='year'?yearText(v):v,v));}
    if(!el.value||el.dataset.sspBaseAutofill==='1'){el.value=v;el.dataset.sspBaseAutofill='1';}
  }
  function fillImages(root){const s=read();
    root.querySelectorAll('img').forEach(img=>{const t=((img.id||'')+' '+(img.className||'')+' '+(img.alt||'')).toLowerCase();if(s.signature&&/(sig|signature|manager-sig|توقيع)/i.test(t)){img.src=s.signature;img.style.display='';img.classList.remove('hidden')}if(s.stamp&&/(stamp|seal|school-stamp|ختم)/i.test(t)){img.src=s.stamp;img.style.display='';img.classList.remove('hidden')}});
    root.querySelectorAll('[data-signature-source],#sig-display,.manager-signature,.signature-display').forEach(el=>{if(s.signature&&el.tagName!=='INPUT'&&el.tagName!=='BUTTON'){if(el.tagName==='IMG')el.src=s.signature;else el.innerHTML='<img src="'+s.signature+'" alt="توقيع مدير المدرسة" style="max-width:100%;max-height:100%;object-fit:contain">'}});
    root.querySelectorAll('[data-stamp-source],#stamp-display,.school-stamp,.stamp-display').forEach(el=>{if(s.stamp&&el.tagName!=='INPUT'&&el.tagName!=='BUTTON'){if(el.tagName==='IMG')el.src=s.stamp;else el.innerHTML='<img src="'+s.stamp+'" alt="ختم المدرسة" style="max-width:100%;max-height:100%;object-fit:contain">'}});
  }
  function scan(root){root=root&&root.querySelectorAll?root:document;
    root.querySelectorAll('input,select,textarea').forEach(el=>{if(isStage(el))configureStage(el);if(isAcademicYear(el))configureYear(el);if(isJobTitle(el))configureJobTitle(el);fillBase(el)});fillImages(root);
  }
  function init(){scan(document);let queued=false;new MutationObserver(ms=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;ms.forEach(m=>m.addedNodes.forEach(n=>{if(n.nodeType===1)scan(n)}))})}).observe(document.documentElement,{childList:true,subtree:true});}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{init();setTimeout(()=>scan(document),250);setTimeout(()=>scan(document),1000)});else{init();setTimeout(()=>scan(document),250);setTimeout(()=>scan(document),1000);}
  window.addEventListener('platformSettingsUpdated',()=>scan(document));
  window.addEventListener('schoolBaseSettingsUpdated',()=>scan(document));
})();
