(function(){
'use strict';
if(window.StudentRosterLinker && window.StudentRosterLinker.VERSION==='1.0.0') return;
const VERSION='1.0.0';
const safe=v=>String(v==null?'':v).trim();
const uniq=a=>[...new Set(a.filter(Boolean))];
const by=(o,keys)=>{for(const k of keys){if(o&&o[k]!=null&&safe(o[k]))return safe(o[k]);}return ''};
const studentName=s=>by(s,['student_name','full_name','name','studentName','student_full_name','اسم_الطالب','اسم الطالب']);
const studentGrade=s=>by(s,['grade','class_name','student_class','student_grade','grade_name','class',' الصف','الصف','صف']);
const studentSection=s=>by(s,['section','classroom','student_section','section_name','class_section',' الفصل','الفصل','الشعبة','فصل','شعبة']);
const studentId=s=>by(s,['student_id','id','national_id','civil_id','identity','studentNationalId','السجل_المدني','السجل المدني']);
let cache={schoolId:'',students:[],loaded:false};
let scheduled=false;

function activeSchoolId(){
 try{return safe(window.SchoolInformationSource?.context?.().schoolId||window.PlatformCloudSession?.schoolId?.()||sessionStorage.getItem('current_school_id')||sessionStorage.getItem('smart_school_tab_school_v1')||'')}catch(_){return ''}
}
async function load(force){
 if(!window.SchoolInformationSource?.getStudents) return cache;
 try{
   if(force&&window.SchoolInformationSource.refresh) await window.SchoolInformationSource.refresh();
   const ctx=window.SchoolInformationSource.context?.()||{};
   const sid=safe(ctx.schoolId||activeSchoolId());
   const students=await window.SchoolInformationSource.getStudents(!!force);
   const filtered=(Array.isArray(students)?students:[]).filter(s=>{
     const ssid=safe(s?.school_id||s?.schoolId||sid);
     return !sid||!ssid||ssid===sid;
   });
   cache={schoolId:sid,students:filtered,loaded:true};
 }catch(e){ console.warn('[StudentRosterLinker] load failed',e); }
 return cache;
}
function labelText(el){
 if(!el) return '';
 const id=el.id;
 const explicit=id?document.querySelector('label[for="'+CSS.escape(id)+'"]'):null;
 if(explicit) return safe(explicit.textContent);
 const wrap=el.closest('label,td,th,.field,.form-group,.input-group,.row,[class*="field"]');
 return safe(wrap?.textContent||'');
}
function kindOf(el){
 const t=(labelText(el)+' '+safe(el.name)+' '+safe(el.id)+' '+safe(el.placeholder)).replace(/\s+/g,' ');
 if(/اسم\s*الطالب|الطالب\s*اسم|student.?name/i.test(t)) return 'student';
 if(/الصف|student.?class|grade/i.test(t) && !/الفصل|الشعبة/i.test(t)) return 'grade';
 if(/الفصل|الشعبة|section|classroom/i.test(t)) return 'section';
 return '';
}
function controlsInScope(studentEl){
 const scope=studentEl.closest('form,table,.record-page,.page,.sheet,.card,section')||document;
 let grade=null,section=null;
 [...scope.querySelectorAll('input,select')].forEach(el=>{
   const k=kindOf(el); if(k==='grade'&&!grade)grade=el; if(k==='section'&&!section)section=el;
 });
 return {scope,grade,section};
}
function setOptions(el,values,placeholder,current){
 if(!el) return;
 let target=el;
 if(el.tagName!=='SELECT'){
   const sel=document.createElement('select');
   [...el.attributes].forEach(a=>{if(a.name!=='type'&&a.name!=='list') sel.setAttribute(a.name,a.value)});
   sel.className=el.className; sel.style.cssText=el.style.cssText;
   sel.dataset.studentRosterConverted='1';
   el.replaceWith(sel); target=sel;
 }
 const old=safe(current||target.value);
 target.innerHTML='';
 const p=document.createElement('option'); p.value=''; p.textContent=placeholder; target.appendChild(p);
 values.forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent=v;target.appendChild(o)});
 if(old&&!values.includes(old)){const o=document.createElement('option');o.value=old;o.textContent=old;target.appendChild(o)}
 target.value=old||'';
 return target;
}
function fillRelatedFields(scope,s){
 if(!s) return;
 const pairs=[
   [/السجل\s*المدني|الهوية|national|civil/i,studentId(s)],
   [/اسم\s*ولي\s*الأمر|ولي\s*الأمر|guardian/i,by(s,['guardian_name','parent_name','guardian','اسم_ولي_الأمر','ولي الأمر'])],
   [/رقم.*ولي.*الأمر|جوال.*ولي|هاتف.*ولي|guardian.*phone/i,by(s,['guardian_phone','parent_phone','guardian_mobile','phone','mobile','رقم_ولي_الأمر'])]
 ];
 [...scope.querySelectorAll('input,select,textarea')].forEach(el=>{
   const txt=(labelText(el)+' '+safe(el.name)+' '+safe(el.id)+' '+safe(el.placeholder));
   pairs.forEach(([re,val])=>{if(val&&re.test(txt)&&!safe(el.value)){el.value=val;el.dispatchEvent(new Event('change',{bubbles:true}))}})
 });
}
function wire(studentEl){
 if(!studentEl||studentEl.dataset.studentRosterWired==='1') return;
 const {scope,grade:grade0,section:section0}=controlsInScope(studentEl);
 if(!grade0) return; // لا نغيّر تصميم سجل لا يملك حقل صف أصلاً
 let grade=grade0, section=section0, student=studentEl;
 const oldStudent=safe(student.value), oldGrade=safe(grade.value), oldSection=safe(section?.value);
 const grades=uniq(cache.students.map(studentGrade)).sort((a,b)=>a.localeCompare(b,'ar'));
 grade=setOptions(grade,grades,'اختر الصف',oldGrade);
 function refreshSections(){
   const g=safe(grade.value);
   if(section){
     const sections=uniq(cache.students.filter(s=>!g||studentGrade(s)===g).map(studentSection)).sort((a,b)=>a.localeCompare(b,'ar'));
     section=setOptions(section,sections,'اختر الفصل / الشعبة',safe(section.value)||oldSection);
   }
   refreshStudents();
 }
 function refreshStudents(){
   const g=safe(grade.value), sec=safe(section?.value);
   const list=cache.students.filter(s=>(!g||studentGrade(s)===g)&&(!sec||studentSection(s)===sec));
   const names=uniq(list.map(studentName)).sort((a,b)=>a.localeCompare(b,'ar'));
   student=setOptions(student,names,'اختر الطالب',safe(student.value)||oldStudent);
   student.dataset.studentRosterWired='1';
   student.onchange=function(){
     const s=list.find(x=>studentName(x)===safe(student.value));
     if(!s)return;
     if(!safe(grade.value)&&studentGrade(s)) grade.value=studentGrade(s);
     if(section&&!safe(section.value)&&studentSection(s)) section.value=studentSection(s);
     fillRelatedFields(scope,s);
     student.dispatchEvent(new CustomEvent('student-roster-selected',{bubbles:true,detail:{student:s,schoolId:cache.schoolId}}));
   };
 }
 grade.addEventListener('change',()=>{ if(section)section.value=''; if(student)student.value=''; refreshSections(); });
 if(section)section.addEventListener('change',()=>{ if(student)student.value=''; refreshStudents(); });
 refreshSections();
}
function scan(){
 scheduled=false;
 if(!cache.loaded||!cache.students.length)return;
 [...document.querySelectorAll('input,select')].filter(el=>kindOf(el)==='student').forEach(wire);
}
function schedule(){if(scheduled)return;scheduled=true;setTimeout(scan,0)}
async function init(){await load(false);scan();new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});window.addEventListener('school-information-source-invalidated',async()=>{await load(true);scan()});}
window.StudentRosterLinker={VERSION,load,scan,refresh:async()=>{await load(true);scan()}};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
