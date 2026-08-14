(function(){
'use strict';if(window.__AGENT_SECTION_ADAPTERS_V2__)return;window.__AGENT_SECTION_ADAPTERS_V2__=true;
const defs=[
 {id:'readiness',match:/readiness/,label:'الجاهزية المدرسية',keys:['activeOperationalStage','setting_academic_year']},
 {id:'discipline',match:/staff_discipline|discipline/,label:'الانضباط الوظيفي',keys:['academic_year','school_info_academic_year']},
 {id:'performance',match:/performance_evaluation|performance/,label:'الأداء الوظيفي',keys:[]},
 {id:'meetings',match:/meeting/,label:'الاجتماعات',keys:['ss_meeting_template_draft','ss_meeting_template_saved','ss_meeting_template_title']},
 {id:'tasks',match:/task|assignment/,label:'التكليفات',keys:[]},
 {id:'student_advisor',match:/student_advisor|student_followup/,label:'التوجيه الطلابي',keys:['reports_archive','category_goals']},
 {id:'health_advisor',match:/health_advisor|school_health/,label:'التوجيه الصحي',keys:['reports_archive','category_goals']},
 {id:'kindergarten_teacher',match:/kindergarten_teacher/,label:'معلمة رياض الأطفال',keys:['reports_archive','category_goals']},
 {id:'activity_leader',match:/activity_leader/,label:'النشاط المدرسي',keys:['reports_archive','category_goals','activity_leader_records_archive_v2']},
 {id:'administrative_employee',match:/administrative_employee|admin_employee/,label:'الموظف الإداري',keys:['administrative_employee_plans','administrative_employee_improvement_plans']},
 {id:'records',match:/records|archive|library/,label:'السجلات والأرشيف',keys:[]},
 {id:'information_center',match:/school_information_center/,label:'مركز المعلومات المدرسي',keys:[]}
];
function current(){const f=(location.pathname.split('/').pop()||'').toLowerCase();return defs.find(d=>d.match.test(f))||{id:'workspace',label:'مساحة العمل',keys:[]}}
function safe(k){try{const v=localStorage.getItem(k);if(!v)return null;try{return JSON.parse(v)}catch(e){return v}}catch(e){return null}}
function collect(){const d=current(),data={};(d.keys||[]).forEach(k=>{const v=safe(k);if(v!==null)data[k]=v});return{module:d.id,label:d.label,localData:data}}
window.AgentSectionAdapters={defs,current,collect};
})();
