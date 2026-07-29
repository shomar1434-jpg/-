(function(){
 'use strict';
 const page=(location.pathname.split('/').pop()||'').toLowerCase();
 const map={
  'manager_library_records.html':{moduleKey:'manager_library',ownershipScope:'user',recordType:'library'},
  'wakil-records.html':{moduleKey:'vice_principal_library',ownershipScope:'user',recordType:'library'},
  'teacher_section_library.html':{moduleKey:'teacher_library',ownershipScope:'user',recordType:'library'},
  'administrative_employee_library.html':{moduleKey:'administrative_employee_library',ownershipScope:'user',recordType:'library'},
  'activity_leader_records.html':{moduleKey:'activity_leader_records',ownershipScope:'user',recordType:'archive'},
  'student_advisor_records.html':{moduleKey:'student_advisor_records',ownershipScope:'user',recordType:'archive'},
  'manager_records.html':{moduleKey:'manager_records',ownershipScope:'user',recordType:'archive'},
  'self_evaluation_records.html':{moduleKey:'self_evaluation_records',ownershipScope:'school',recordType:'self_evaluation'},
  'external_evaluation_archive.html':{moduleKey:'external_evaluation_archive',ownershipScope:'school',recordType:'external_evaluation'},
  'meeting_minutes_template.html':{moduleKey:'meeting_minutes',ownershipScope:'school',recordType:'meeting'},
  'school_health_unified_registry.html':{moduleKey:'school_health_registry',ownershipScope:'school',recordType:'health_registry'},
  'teacher_comprehensive_record.html':{moduleKey:'teacher_comprehensive_record',ownershipScope:'user',recordType:'performance_file'},
  'administrative_employee_portal.html':{moduleKey:'administrative_employee_portal',ownershipScope:'user',recordType:'performance_file'},
  'external_team_smart_card.html':{moduleKey:'external_team_visit',ownershipScope:'school',recordType:'visit'}
 };
 if(!window.CLOUD_FILE_PANEL_CONFIG&&map[page])window.CLOUD_FILE_PANEL_CONFIG={...map[page],relationType:'attachment',mountSelector:'main'};
})();
