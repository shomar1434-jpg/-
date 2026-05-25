
const form=document.getElementById('visitForm');
const KEY='moe_supervisor_visit_form_v2_item_scores';
function values(){const data={}; form.querySelectorAll('input,textarea,select').forEach(el=>{if(el.type==='checkbox'){data[el.name+'|'+el.value]=el.checked}else{data[el.name]=el.value}});return data}
function loadData(data){form.querySelectorAll('input,textarea,select').forEach(el=>{if(el.type==='checkbox'){el.checked=!!data[el.name+'|'+el.value]}else if(data[el.name]!==undefined){el.value=data[el.name]}})}
function saveLocal(){localStorage.setItem(KEY,JSON.stringify(values())); toast('تم حفظ البيانات داخل المتصفح')}
function autoSave(){localStorage.setItem(KEY,JSON.stringify(values()))}
function clearForm(){if(confirm('هل تريد تفريغ جميع الحقول؟')){form.reset();localStorage.removeItem(KEY);toast('تم تفريغ النموذج')}}
function printForm(){window.print()}
function exportPDF(){alert('اختر من نافذة الطباعة: Save as PDF / حفظ كملف PDF. تم ضبط الصفحات على 8 صفحات A4 مطابقة لعدد صفحات السجل الأصلي.'); window.print()}
function downloadJSON(){const blob=new Blob([JSON.stringify(values(),null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='بيانات_استمارة_زيارة_مشرف_الإدارة_المدرسية.json';a.click();URL.revokeObjectURL(a.href)}
function importJSON(file){const r=new FileReader();r.onload=()=>{try{const data=JSON.parse(r.result);loadData(data);autoSave();toast('تم استيراد البيانات بنجاح')}catch(e){alert('ملف البيانات غير صالح')}};r.readAsText(file)}
function toast(msg){const t=document.createElement('div');t.textContent=msg;t.style.cssText='position:fixed;bottom:18px;right:18px;background:#073b45;color:white;padding:12px 18px;border-radius:12px;z-index:99;box-shadow:0 4px 20px #0005';document.body.appendChild(t);setTimeout(()=>t.remove(),2200)}
form.addEventListener('input',()=>{clearTimeout(window.__sv);window.__sv=setTimeout(autoSave,400)});

function setupHijriDate(){
  const daySel=form.querySelector('[data-hijri-day]');
  const monthSel=form.querySelector('[data-hijri-month]');
  const yearSel=form.querySelector('[data-hijri-year]');
  const weekSel=form.querySelector('[data-weekday-select]');
  const display=form.querySelector('[name="hijri_date_display"]');
  if(!daySel||!monthSel||!yearSel||!display) return;

  const months=[
    'محرم','صفر','ربيع الأول','ربيع الآخر','جمادى الأولى','جمادى الآخرة',
    'رجب','شعبان','رمضان','شوال','ذو القعدة','ذو الحجة'
  ];
  const weekdays=['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];

  function fillSelect(sel, arr, getValue=(x)=>x, getText=(x)=>x){
    const current=sel.value;
    sel.innerHTML='<option value=""></option>'+arr.map(x=>`<option value="${getValue(x)}">${getText(x)}</option>`).join('');
    if(current) sel.value=current;
  }
  fillSelect(daySel, Array.from({length:30},(_,i)=>i+1), x=>String(x).padStart(2,'0'), x=>String(x).padStart(2,'0'));
  fillSelect(monthSel, months.map((m,i)=>({m,i:i+1})), x=>String(x.i).padStart(2,'0'), x=>x.m);
  fillSelect(yearSel, Array.from({length:1477-1447+1},(_,i)=>1447+i), x=>String(x), x=>String(x)+'هـ');

  function getCurrentHijri(){
    try{
      const parts=new Intl.DateTimeFormat('en-u-ca-islamic-umalqura',{day:'numeric',month:'numeric',year:'numeric'}).formatToParts(new Date());
      const obj={};
      parts.forEach(p=>{if(p.type==='day')obj.day=p.value;if(p.type==='month')obj.month=p.value;if(p.type==='year')obj.year=p.value;});
      return {
        day:String(obj.day||'').padStart(2,'0'),
        month:String(obj.month||'').padStart(2,'0'),
        year:String(obj.year||'')
      };
    }catch(e){return {day:'',month:'',year:'1447'}}
  }

  function sync(){
    const d=daySel.value, m=monthSel.value, y=yearSel.value;
    const monthName=months[(parseInt(m,10)||1)-1]||'';
    display.value=(d&&m&&y)?`${d} / ${monthName} / ${y}هـ`:'';
    autoSave();
  }
  [daySel,monthSel,yearSel,weekSel].forEach(el=>el.addEventListener('change',sync));

  const saved=localStorage.getItem(KEY);
  if(!saved){
    const cur=getCurrentHijri();
    if(Number(cur.year)>=1447 && Number(cur.year)<=1477){
      daySel.value=cur.day; monthSel.value=cur.month; yearSel.value=cur.year;
    }else{
      yearSel.value='1447';
    }
    const gDay=weekdays[new Date().getDay()];
    if(weekSel && !weekSel.value) weekSel.value=gDay;
    sync();
  }else{
    sync();
  }
}

setupHijriDate();
const old=localStorage.getItem(KEY);if(old){try{loadData(JSON.parse(old));setupHijriDate()}catch(e){}}


/* ربط استمارة الزيارة الإشرافية بمحفظة اجتماعات المدير دون التأثير على باقي المنصة */
function __visitQueryParams(){ try{return new URLSearchParams(window.location.search||'')}catch(e){return new URLSearchParams()} }
function __visitSchoolId(){ const q=__visitQueryParams(); return q.get('school_id')||q.get('schoolId')||localStorage.getItem('current_school_id')||localStorage.getItem('school_id')||'school'; }
function __visitSchoolName(){ const q=__visitQueryParams(); return q.get('school_name')||q.get('schoolName')||localStorage.getItem('school_name')||localStorage.getItem('persist_school')||'المدرسة'; }
function __safeVisitText(v){ return String(v||'').replace(/[<>]/g,'').trim(); }
function __managerMeetingKeys(){
  const ids=['root','default',__visitSchoolId(),localStorage.getItem('cached_manager_uid'),localStorage.getItem('manager_uid'),localStorage.getItem('current_manager_uid')].filter(Boolean);
  const uniq=[...new Set(ids.map(String))];
  return [...new Set(uniq.map(id=>'school_meetings_archive_'+id).concat(['smartSchoolUnifiedOpsV2_minutes_manager']))];
}
function __readArr(key){ try{ const v=JSON.parse(localStorage.getItem(key)||'[]'); return Array.isArray(v)?v:[]; }catch(e){return []} }
function __writeArr(key,arr){ try{ localStorage.setItem(key,JSON.stringify(arr||[])); }catch(e){} }
function __nextVisitTitle(existing){
  const used=new Set((existing||[]).map(x=>String((x&&x.title)||'')));
  if(!used.has('زيارة إشرافية')) return 'زيارة إشرافية';
  let n=2; while(used.has('زيارة إشرافية ('+n+')')) n++;
  return 'زيارة إشرافية ('+n+')';
}
function __visitData(){ return values(); }

function __visitPrintablePdfHtml(title){
  try{
    // بناء نسخة HTML ثابتة مطابقة لما يظهر عند الطباعة والحفظ، مع تثبيت القيم الحالية داخل الحقول
    const docClone=document.documentElement.cloneNode(true);
    const originalControls=Array.from(document.querySelectorAll('input,textarea,select'));
    const cloneControls=Array.from(docClone.querySelectorAll('input,textarea,select'));
    originalControls.forEach(function(src,i){
      const dst=cloneControls[i]; if(!dst) return;
      const tag=(src.tagName||'').toLowerCase();
      const type=(src.type||'').toLowerCase();
      if(tag==='textarea'){
        dst.textContent=src.value||'';
        dst.setAttribute('data-print-value',src.value||'');
      }else if(tag==='select'){
        Array.from(dst.options||[]).forEach(function(op){op.removeAttribute('selected');});
        if(dst.options && dst.options[src.selectedIndex]) dst.options[src.selectedIndex].setAttribute('selected','selected');
        dst.setAttribute('data-print-value',src.value||'');
      }else if(type==='checkbox' || type==='radio'){
        if(src.checked) dst.setAttribute('checked','checked'); else dst.removeAttribute('checked');
      }else{
        dst.setAttribute('value',src.value||'');
      }
    });
    Array.from(docClone.querySelectorAll('script')).forEach(function(x){x.remove();});
    Array.from(docClone.querySelectorAll('.toolbar,.no-print-note')).forEach(function(x){x.remove();});
    const head=docClone.querySelector('head');
    if(head){
      const meta=document.createElement('meta'); meta.setAttribute('charset','utf-8'); head.prepend(meta);
      const printStyle=document.createElement('style');
      printStyle.textContent='@page{size:A4 portrait;margin:0}html,body{width:210mm!important;background:#fff!important}.sheet{margin:0 auto!important;box-shadow:none!important;width:210mm!important;height:297mm!important;break-after:page;page-break-after:always;overflow:hidden!important}.sheet:last-child{break-after:auto;page-break-after:auto}.toolbar,.no-print-note{display:none!important}input,textarea,select{font-weight:900!important;color:#000!important;-webkit-text-fill-color:#000!important}select{appearance:none!important;-webkit-appearance:none!important}';
      head.appendChild(printStyle);
      const ttl=head.querySelector('title'); if(ttl) ttl.textContent=title||'زيارة إشرافية';
    }
    return '<!DOCTYPE html>\n'+docClone.outerHTML;
  }catch(e){
    return '<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>'+(title||'زيارة إشرافية')+'</title></head><body><pre style="font-family:Arial;white-space:pre-wrap">'+__visitReadableSummary(__visitData())+'</pre></body></html>';
  }
}
function __visitReadableSummary(data){
  const get=k=>__safeVisitText(data[k]);
  const lines=[
    'استمارة زيارة مشرف الإدارة المدرسية',
    'المدرسة: '+(get('school')||__visitSchoolName()),
    'مدير/ة المدرسة: '+get('principal'),
    'المشرف/ـة: '+get('supervisor'),
    'يوم الزيارة: '+get('visit_day'),
    'تاريخ الزيارة: '+(get('hijri_date_display')||[get('hijri_day'),get('hijri_month'),get('hijri_year')].filter(Boolean).join('/')),
    'نقاط القوة: '+get('strengths'),
    'فرص التحسين: '+get('improvements'),
    'خطة العمل المقترحة: '+get('action_plan_text')
  ];
  return lines.filter(x=>!/:\s*$/.test(x)).join('\n');
}
function sendVisitToManagerPortfolio(){
  autoSave();
  const data=__visitData();
  const keys=__managerMeetingKeys();
  let all=[]; keys.forEach(k=>{ all=all.concat(__readArr(k)); });
  const title=__nextVisitTitle(all);
  const date=new Date();
  const yyyy=date.getFullYear(), mm=String(date.getMonth()+1).padStart(2,'0'), dd=String(date.getDate()).padStart(2,'0');
  const hh=String(date.getHours()).padStart(2,'0'), mi=String(date.getMinutes()).padStart(2,'0');
  const summary=__visitReadableSummary(data);
  const record={
    id:'supervisor_visit_'+Date.now()+'_'+Math.random().toString(36).slice(2,7),
    source:'supervisor_visit_form',
    archiveType:'meetingMinutes',
    title:title,
    type:'زيارة إشرافية',
    date: yyyy+'-'+mm+'-'+dd,
    time: hh+':'+mi,
    createdBy:'المشرف الزائر',
    createdByRole:'leadership',
    schoolId:__visitSchoolId(),
    schoolName:__visitSchoolName(),
    participants:[{id:'school_manager',name:'مدير المدرسة',role:'leadership'}],
    agenda:'استمارة الزيارة الإشرافية المعبأة من رابط الزيارة.\n\n'+summary,
    recommendations:__safeVisitText(data.improvements)||'تم إرسال استمارة الزيارة الإشرافية إلى محفظة الاجتماعات.',
    tasks:__safeVisitText(data.action_plan_text)||'',
    attachments:[{name:title+'.pdf',type:'application/pdf',kind:'generated-from-print-html',printReady:true}],
    formData:data,
    minutes:summary,
    summary:summary,
    pdfHtml:__visitPrintablePdfHtml(title),
    officialHtml:__visitPrintablePdfHtml(title),
    templateHtml:__visitPrintablePdfHtml(title),
    pdfFileName:title+'.pdf',
    pdfReady:true,
    createdAt:new Date().toISOString()
  };
  keys.forEach(key=>{
    const arr=__readArr(key);
    if(!arr.some(x=>String(x.id)===String(record.id))){ arr.unshift(record); __writeArr(key,arr); }
  });
  toast('تم إرسال الاستمارة PDF مطابق للطباعة إلى محفظة اجتماعات مدير المدرسة باسم: '+title);
}
