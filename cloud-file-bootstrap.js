(function(){
 'use strict';
 const page=(location.pathname.split('/').pop()||'').toLowerCase();
 const map={
  'activity_leader.html':{moduleKey:'activity_leader_workspace',ownershipScope:'user',recordType:'workspace'},
  'activity_leader_records.html':{moduleKey:'activity_leader_records',ownershipScope:'user',recordType:'archive'},
  'admin_employee_management.html':{moduleKey:'admin_employee_management',ownershipScope:'user',recordType:'management'},
  'administrative_employee_execution.html':{moduleKey:'administrative_employee_execution',ownershipScope:'user',recordType:'execution'},
  'administrative_employee_improvement.html':{moduleKey:'administrative_employee_improvement',ownershipScope:'user',recordType:'improvement'},
  'administrative_employee_library.html':{moduleKey:'administrative_employee_library',ownershipScope:'user',recordType:'library'},
  'administrative_employee_portal.html':{moduleKey:'administrative_employee_portal',ownershipScope:'user',recordType:'performance_file'},
  'agent.html':{moduleKey:'vice_principal_workspace',ownershipScope:'user',recordType:'workspace'},
  'agent_exams_management.html':{moduleKey:'vice_principal_exams',ownershipScope:'user',recordType:'exams'},
  'central_task_center.html':{moduleKey:'central_tasks',ownershipScope:'user',recordType:'task'},
  'exam_committees_forms.html':{moduleKey:'exam_committees',ownershipScope:'user',recordType:'committee'},
  'external_evaluation_archive.html':{moduleKey:'external_evaluation_archive',ownershipScope:'school',recordType:'external_evaluation'},
  'external_team_smart_card.html':{moduleKey:'external_team_visit',ownershipScope:'school',recordType:'visit'},
  'impact_assessment.html':{moduleKey:'impact_assessment',ownershipScope:'user',recordType:'assessment'},
  'improvement_plan_linked.html':{moduleKey:'improvement_plans',ownershipScope:'user',recordType:'plan'},
  'manager.html':{moduleKey:'manager_workspace',ownershipScope:'user',recordType:'workspace'},
  'manager_exams_management.html':{moduleKey:'manager_exams',ownershipScope:'user',recordType:'exams'},
  'manager_library_records.html':{moduleKey:'manager_library',ownershipScope:'user',recordType:'library'},
  'manager_records.html':{moduleKey:'manager_records',ownershipScope:'user',recordType:'archive'},
  'meeting_minutes_template.html':{moduleKey:'meeting_minutes',ownershipScope:'school',recordType:'meeting'},
  'school-performance-dashboard.html':{moduleKey:'school_performance',ownershipScope:'school',recordType:'dashboard'},
  'school_health_unified_registry.html':{moduleKey:'school_health_registry',ownershipScope:'user',recordType:'health_registry'},
  'school_information_center.html':{moduleKey:'school_information_center',ownershipScope:'school',recordType:'school_document'},
  'school_readiness.html':{moduleKey:'school_readiness',ownershipScope:'school',recordType:'readiness_plan'},
  'self_evaluation_records.html':{moduleKey:'self_evaluation_records',ownershipScope:'school',recordType:'self_evaluation'},
  'student_advisor.html':{moduleKey:'student_advisor_workspace',ownershipScope:'user',recordType:'workspace'},
  'student_advisor_analysis_tool.html':{moduleKey:'student_advisor_analysis',ownershipScope:'user',recordType:'analysis'},
  'student_advisor_records.html':{moduleKey:'student_advisor_records',ownershipScope:'user',recordType:'archive'},
  'student_followup_analysis_updated.html':{moduleKey:'student_followup_analysis',ownershipScope:'user',recordType:'analysis'},
  'supervisor_visit.html':{moduleKey:'supervisor_visits',ownershipScope:'school',recordType:'visit'},
  'supervisor_visit_form.html':{moduleKey:'supervisor_visit_forms',ownershipScope:'school',recordType:'visit_form'},
  'teacher.html':{moduleKey:'teacher_workspace',ownershipScope:'user',recordType:'workspace'},
  'teacher_comprehensive_record.html':{moduleKey:'teacher_comprehensive_record',ownershipScope:'user',recordType:'performance_file'},
  'teacher_data_analysis.html':{moduleKey:'teacher_data_analysis',ownershipScope:'user',recordType:'analysis'},
  'teacher_records_attendance.html':{moduleKey:'teacher_attendance_records',ownershipScope:'user',recordType:'record'},
  'teacher_records_index.html':{moduleKey:'teacher_records',ownershipScope:'user',recordType:'archive'},
  'teacher_records_participation.html':{moduleKey:'teacher_participation_records',ownershipScope:'user',recordType:'record'},
  'teacher_records_student_work.html':{moduleKey:'teacher_student_work',ownershipScope:'user',recordType:'record'},
  'teacher_section_library.html':{moduleKey:'teacher_library',ownershipScope:'user',recordType:'library'},
  'teacher_weekly_tasks.html':{moduleKey:'teacher_weekly_tasks',ownershipScope:'user',recordType:'task'},
  'wakil-records.html':{moduleKey:'vice_principal_library',ownershipScope:'user',recordType:'library'}
 };
 const context=map[page]||null;
 window.CloudFilePageContext=context;
 if(!window.CLOUD_FILE_PANEL_CONFIG&&context&&/library|records|archive|registry|information_center|performance_file/.test(context.moduleKey+' '+context.recordType)){
   window.CLOUD_FILE_PANEL_CONFIG={...context,relationType:'attachment',mountSelector:'main'};
 }
 window.CloudFileModuleMap=map;
})();
