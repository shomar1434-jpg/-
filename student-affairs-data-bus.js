(function(){
'use strict';
if(window.StudentAffairsDataBus) return;
function readJson(k,d){try{return JSON.parse(localStorage.getItem(k)||JSON.stringify(d));}catch(e){return d;}}
function schoolId(){
  try{
    var q=new URLSearchParams(location.search||'');
    var u=readJson('currentSchoolUser',{})||readJson('currentUser',{})||{};
    var s=readJson('smartSchool.currentSchool',{})||readJson('activeSchool',{})||{};
    return String(q.get('schoolId')||q.get('school_id')||localStorage.getItem('active_school_id')||localStorage.getItem('current_school_id')||localStorage.getItem('school_id')||s.id||s.school_id||u.school_id||u.schoolId||'').trim();
  }catch(e){return String(localStorage.getItem('current_school_id')||localStorage.getItem('school_id')||'').trim();}
}
function key(){return 'smartSchool:studentAffairs:events:'+schoolId();}
function list(opts){
  opts=opts||{};
  var rows=readJson(key(),[]); if(!Array.isArray(rows)) rows=[];
  return rows.filter(function(r){
    if(opts.type && r.type!==opts.type) return false;
    if(opts.source && r.source!==opts.source) return false;
    if(opts.national_id && String(r.national_id||'')!==String(opts.national_id)) return false;
    if(opts.student_id && String(r.student_id||'')!==String(opts.student_id)) return false;
    return true;
  });
}
function publish(type,payload,source){
  var sid=schoolId(); if(!sid) return null;
  payload=payload||{};
  var rows=list();
  var rec=Object.assign({},payload,{id:payload.id||('SAE-'+Date.now()+'-'+Math.random().toString(36).slice(2,8)),school_id:sid,type:String(type||'event'),source:String(source||payload.source||'student_affairs'),created_at:payload.created_at||new Date().toISOString()});
  rows.unshift(rec); rows=rows.slice(0,2000);
  localStorage.setItem(key(),JSON.stringify(rows));
  try{window.dispatchEvent(new CustomEvent('student-affairs-data-change',{detail:rec}));}catch(e){}
  try{var bc=new BroadcastChannel('smart-school-student-affairs');bc.postMessage({type:'change',record:rec});bc.close();}catch(e){}
  return rec;
}
function subscribe(fn){
  function onLocal(e){try{fn(e.detail||null);}catch(_){} }
  window.addEventListener('student-affairs-data-change',onLocal);
  var bc=null;try{bc=new BroadcastChannel('smart-school-student-affairs');bc.onmessage=function(e){if(e.data&&e.data.type==='change')try{fn(e.data.record||null)}catch(_){}}}catch(e){}
  return function(){window.removeEventListener('student-affairs-data-change',onLocal);try{bc&&bc.close()}catch(e){}};
}
window.StudentAffairsDataBus={schoolId:schoolId,list:list,publish:publish,subscribe:subscribe,key:key,version:'1.0.0'};
})();
