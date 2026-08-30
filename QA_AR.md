# QA — روابط تسجيل ودخول الموظف الإداري

- manager_route_preserved: PASS
- agent_route_preserved: PASS
- registration_link_has_school_id: PASS
- registration_link_has_school_code: PASS
- registration_link_has_registration_code: PASS
- registration_link_preserves_supervisor: PASS
- registration_page_strict_school_contract: PASS
- registration_creates_admin_role: PASS
- login_link_scoped_to_school: PASS
- admin_login_no_bridge_login: PASS
- admin_login_no_supabase_auth_signin: PASS
- admin_login_uses_platform_session: PASS
- admin_login_checks_active_before_session: PASS
- admin_login_rechecks_membership: PASS
- admin_login_role_restricted: PASS
- admin_login_school_match: PASS
- login_does_not_clear_shared_localstorage: PASS
- portal_prefers_tab_context: PASS
- register_success_link_scoped: PASS
- javascript_syntax: PASS
- manager_link_contract_complete: PASS
- agent_link_contract_complete: PASS

- Syntax errors: []

تمت مراجعة المسارين manager→admin_employee_management?supervisor=manager و agent→admin_employee_management?supervisor=agent دون تعديلهما.
الدخول الإداري لا يستدعي Supabase Auth ولا loginSchoolUser؛ يستخدم PlatformCloudSession مع تحقق المدرسة والدور والعضوية النشطة.
