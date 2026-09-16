(function(){
'use strict';
const VERSION='1.0.0-RL170';
if(window.RecordsInteractivityEngine?.VERSION===VERSION)return;

const ROOTS=['#paper','#formPage'];
const NAME_RE=/(?:^|\s)(?:الاسم|اسم الطالب(?:\/الطالبة)?|اسم المعلم(?:\/المعلمة)?|اسم الموظف(?:\/الموظفة)?|اسم العضو(?:\/العضوة)?|اسم المكلف(?:\/المكلفة)?)(?:\s|:|\/|$)/;
const STUDENT_RE=/(طالب|طالبة|الطلاب|الطالبات)/;
const TEACHER_RE=/(معلم|معلمة|الهيئة التعليمية)/;
const JOB_RE=/(المسمى الوظيفي|المسمي الوظيفي|الوظيفة|الدور الوظيفي)/;
const NATIONAL_RE=/(السجل المدني|رقم الهوية|الهوية الوطنية)/;
const STUDENT_NO_RE=/(الرقم الطلابي|رقم الطالب|رقم الطالبة)/;
const EMAIL_RE=/(البريد الإلكتروني|البريد الالكتروني)/;
const PHONE_RE=/(الجوال|رقم الجوال|الهاتف)/;
const SPECIALTY_RE=/(التخصص|المادة التي يدرسها|المادة التعليمية)/;
const STAGE_RE=/(المرحلة)/;
const GRADE_RE=/(الصف)(?!ة)/;
const SECTION_RE=/(الفصل|الشعبة)/;
const TRACK_RE=/(المسار)/;
const PROMPT_RE=/^(الاسم|اسم الطالب(?:\/الطالبة)?|اسم المعلم(?:\/المعلمة)?|اسم الموظف(?:\/الموظفة)?|اسم العضو(?:\/العضوة)?|المؤهل|سنوات الخدمة|التخصص|المادة|الوظيفة|المسمى الوظيفي|المسمي الوظيفي|المرحلة|الصف|الفصل|الشعبة|المسار|رقم الهوية|السجل المدني|الرقم الطلابي|البريد الإلكتروني|البريد الالكتروني|رقم الجوال|الجوال|الهاتف|الملاحظات|التوصيات|الإجراءات|القرار|النتيجة)\s*[.:：\/]?\s*$/;
const LONG_PROMPT_RE=/(الإجراءات والتوصيات|أسباب|مبررات|ملحوظات|ملاحظات|فرص التحسين|نقاط القوة|الهدف|التوصيات|القرار|النتيجة|الرأي)\s*[.:：\/]?\s*$/;
let running=false,timer=0,serial=0;

function clean(v){return String(v||'').replace(/\s+/g,' ').trim()}
function ensureStyle(){
 if(document.getElementById('records-interactivity-engine-style'))return;
 const s=document.createElement('style');s.id='records-interactivity-engine-style';s.textContent=`
  [data-records-interactive="1"]{box-sizing:border-box;width:100%;min-width:0;margin-top:5px;border:1px solid #9bbfb0;border-radius:5px;background:#fff;color:#111827;padding:5px 7px;font:inherit;pointer-events:auto!important}
  textarea[data-records-interactive="1"]{min-height:58px;resize:vertical;line-height:1.6}
  select[data-records-interactive="1"]{cursor:pointer}
  [data-records-interactive="1"]:focus{outline:2px solid #0da9a6;outline-offset:1px;border-color:#0da9a6}
  @media print{[data-records-interactive="1"]{border:0!important;border-bottom:1px dotted #667085!important;border-radius:0!important;background:transparent!important;outline:0!important;resize:none!important}}
 `;(document.head||document.documentElement).appendChild(s);
}
function root(){return ROOTS.map(s=>document.querySelector(s)).find(Boolean)||null}
function keyAttr(){return document.querySelector('#formPage')?'field':'k'}
function recordId(scope){return clean(scope?.getAttribute('data-current-record')||scope?.getAttribute('data-current-form')||window.current?.id||'record').replace(/[^\w\-\u0600-\u06ff]/g,'_')}
function headerText(el){
 const cell=el.closest?.('td,th'),table=cell?.closest?.('table');if(!cell||!table)return '';
 const idx=cell.cellIndex,rows=Array.from(table.rows||[]),pos=rows.indexOf(cell.parentElement);
 for(let i=pos-1;i>=0;i--){const c=rows[i]?.cells?.[idx];if(!c)continue;const t=clean(c.textContent);if(t)return t}
 return '';
}
function context(el){
 const box=el.closest?.('td,.field,.ref-paragraph,.section')||el.parentElement;
 return clean([headerText(el),box?.textContent,el.getAttribute?.('placeholder'),el.getAttribute?.('aria-label')].filter(Boolean).join(' ')).slice(0,320)
}
function infoType(text){
 text=clean(text);
 if(NATIONAL_RE.test(text))return 'nationalId';
 if(STUDENT_NO_RE.test(text))return 'studentNumber';
 if(EMAIL_RE.test(text))return 'email';
 if(PHONE_RE.test(text))return 'phone';
 if(JOB_RE.test(text))return 'jobTitle';
 if(SPECIALTY_RE.test(text))return 'specialization';
 if(NAME_RE.test(text))return STUDENT_RE.test(text)?'student':(TEACHER_RE.test(text)?'teacher':'staff');
 if(STAGE_RE.test(text))return 'stage';
 if(GRADE_RE.test(text))return 'grade';
 if(SECTION_RE.test(text))return 'section';
 if(TRACK_RE.test(text))return 'track';
 return '';
}
function isHeaderCell(cell){
 if(!cell||cell.tagName==='TH')return true;
 const table=cell.closest('table'),row=cell.parentElement;if(!table||!row)return false;
 const rows=Array.from(table.rows||[]),at=rows.indexOf(row),idx=cell.cellIndex;
 if(at<0)return false;
 for(let i=at+1;i<Math.min(rows.length,at+4);i++)if(rows[i]?.cells?.[idx]?.querySelector('input,textarea,select'))return true;
 return false;
}
function stableKey(el,kind){
 const scope=root(),rid=recordId(scope),cell=el.closest?.('td,th'),table=cell?.closest?.('table');
 if(cell&&table){const tables=Array.from(scope.querySelectorAll('table'));return `${rid}_interactive_t${tables.indexOf(table)+1}_r${cell.parentElement.rowIndex+1}_c${cell.cellIndex+1}_${kind}`}
 const paragraph=el.closest?.('.ref-paragraph');
 if(paragraph){const paragraphs=Array.from(scope.querySelectorAll('.ref-paragraph')),slot=paragraph.querySelectorAll('[data-records-interactive="1"]').length+1;return `${rid}_interactive_p${paragraphs.indexOf(paragraph)+1}_${kind}_${slot}`}
 return `${rid}_interactive_${kind}_${++serial}`;
}
function makeControl(container,label,kind='input'){
 const attr=keyAttr(),doc=container.ownerDocument||document,el=doc.createElement(kind==='textarea'?'textarea':kind==='select'?'select':'input');
 if(kind==='input')el.type='text';el.className=kind==='textarea'?'ref-cell-input interactive-textarea':'ref-cell-input interactive-field';el.setAttribute('autocomplete','off');
 el.dataset[attr]=stableKey(container,kind);el.dataset.recordsInteractive='1';
 const type=infoType(label);if(type)el.dataset.infoType=type;
 container.appendChild(el);return el;
}
function enhanceChoices(scope){
 const choices=[
  {re:/(إصدار).*(تعديل).*(إلغاء)/,values:['إصدار','تعديل','إلغاء']},
  {re:/(موافق).*(غير موافق)/,values:['موافق','غير موافق']},
  {re:/(منفذ).*(غير منفذ)/,values:['منفذ','غير منفذ']},
  {re:/(مناسب).*(غير مناسب)/,values:['مناسب','غير مناسب']},
  {re:/(نعم).*(لا)/,values:['نعم','لا']}
 ];
 scope.querySelectorAll('.ref-paragraph,td').forEach(box=>{
  if(box.querySelector('input,textarea,select')||box.dataset.recordsChoice==='1')return;
  const txt=clean(box.textContent),match=choices.find(c=>c.re.test(txt));if(!match)return;
  const select=makeControl(box,txt,'select'),blank=document.createElement('option');blank.value='';blank.textContent='اختر';select.appendChild(blank);
  match.values.forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent=v;select.appendChild(o)});box.dataset.recordsChoice='1';
 });
}
function enhancePromptCells(scope){
 scope.querySelectorAll('td,.ref-paragraph').forEach(box=>{
  if(box.querySelector('input,textarea,select')||box.dataset.recordsPrompt==='1')return;
  const txt=clean(box.textContent);if(!txt)return;
  const exact=PROMPT_RE.test(txt),long=LONG_PROMPT_RE.test(txt);
  if(!exact&&!long)return;if(box.tagName==='TD'&&isHeaderCell(box))return;
  makeControl(box,txt,long?'textarea':'input');box.dataset.recordsPrompt='1';
 });
}
function enhanceLinePrompts(scope){
 const walker=document.createTreeWalker(scope,NodeFilter.SHOW_TEXT),nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
 nodes.forEach(node=>{
  const parent=node.parentElement;if(!parent||parent.closest('script,style,input,textarea,select')||parent.dataset.recordsLinePrompt==='1')return;
  if(parent.matches('th')||parent.closest('th'))return;
  const txt=clean(node.nodeValue);if(!PROMPT_RE.test(txt))return;
  const cell=parent.closest('td');if(cell&&isHeaderCell(cell))return;
  const type=infoType(txt);if(!type&&!LONG_PROMPT_RE.test(txt))return;
  const input=makeControl(parent,txt,LONG_PROMPT_RE.test(txt)?'textarea':'input');parent.dataset.recordsLinePrompt='1';
  if(type)input.dataset.infoType=type;
 });
}
function classifyControls(scope){
 scope.querySelectorAll('input,textarea,select').forEach(el=>{
  if(el.type==='hidden'||el.type==='file'||el.type==='button'||el.type==='submit')return;
  const type=infoType(context(el));if(type)el.dataset.infoType=type;
  if(!el.getAttribute('aria-label')){const label=clean(headerText(el)||context(el));if(label)el.setAttribute('aria-label',label.slice(0,100))}
 });
}
function bindPersistence(scope){
 scope.querySelectorAll('[data-records-interactive="1"]').forEach(el=>{
  if(el.dataset.recordsPersistenceBound==='1')return;el.dataset.recordsPersistenceBound='1';
  el.addEventListener('input',()=>{try{if(typeof window.autoDraft==='function')window.autoDraft()}catch(_){}});
  el.addEventListener('change',()=>{try{if(typeof window.autoDraft==='function')window.autoDraft()}catch(_){}});
 });
}
async function enhance(){
 if(running)return;const scope=root();if(!scope)return;running=true;
 try{
  const before=scope.querySelectorAll('[data-records-interactive="1"]').length;
  enhanceChoices(scope);enhancePromptCells(scope);enhanceLinePrompts(scope);classifyControls(scope);bindPersistence(scope);
  scope.dataset.recordsInteractivity='ready';
  const rid=recordId(scope),after=scope.querySelectorAll('[data-records-interactive="1"]').length;
  if(after>before&&scope.dataset.recordsInteractivityRestored!==rid&&typeof window.loadDraft==='function'){
   scope.dataset.recordsInteractivityRestored=rid;try{window.loadDraft()}catch(_){ }
  }
  if(window.SchoolInformationSource?.bindInformationFields)await window.SchoolInformationSource.bindInformationFields(scope);
  if(window.RecordDateSync?.refresh)window.RecordDateSync.refresh();
 }catch(e){console.warn('[records-interactivity]',e)}finally{running=false}
}
function schedule(){clearTimeout(timer);timer=setTimeout(enhance,35)}
function boot(){ensureStyle();const scope=root();if(!scope)return;schedule();new MutationObserver(changes=>{if(changes.some(c=>Array.from(c.addedNodes||[]).some(n=>n.nodeType===1&&!n.matches?.('[data-records-interactive="1"],.sis-stable-dropdown,[data-sis-dropdown-root]'))))schedule()}).observe(scope,{childList:true,subtree:true})}
window.RecordsInteractivityEngine={VERSION,refresh:enhance};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
