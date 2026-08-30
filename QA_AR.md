# QA — مركز المعلومات والقرارات

{
  "checks": {
    "center_system_admin_gate": true,
    "center_school_uses_verified_session": true,
    "center_system_admin_requires_target": true,
    "center_no_direct_db_client": true,
    "center_teacher_names_cloud_only": true,
    "center_profiles_cannot_resurrect_deleted": true,
    "center_cards_force_live_snapshot": true,
    "source_no_local_user_cache": true,
    "source_dual_context": true,
    "source_active_staff_only": true,
    "decisions_live_current_teachers": true,
    "decisions_no_stale_new_assignee": true,
    "decisions_historical_name_disabled": true,
    "new_decision_requires_live_user_id": true,
    "syntax_ok": true
  },
  "errors": []
}

- فصل السياق الإضافي: مصدر البيانات لا يعتمد على أعلام System Admin العامة في sessionStorage؛ يلزم سياق موثق أو رابط systemAdmin صريح: PASS
