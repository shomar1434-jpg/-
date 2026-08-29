# QA — إعادة بناء دخول المدارس المستقلة من المرجع السابق للعزل

تمت مقارنة مسار الدخول مع النسخة السابقة للعزل، ثم دمج المصادقة السحابية المعزولة دون استخدام Supabase Auth داخل متصفح المدرسة.

## الفحوص
- school_login_engine_clean_v3: PASS
- no_browser_supabase_auth_in_school_engine: PASS
- server_platform_session_is_auth_source: PASS
- server_membership_readback: PASS
- strict_school_match: PASS
- single_submit_only: PASS
- system_admin_does_not_clear_localstorage: PASS
- system_admin_sessionstorage_only: PASS
- cloud_verify_access_preserved: PASS
- cloud_system_admin_block_preserved: PASS
- javascript_syntax: PASS

- تدقيق Supabase: جميع المدارس النشطة لديها حساب مدير مطابق لبريد المدرسة.
- المدارس القديمة التي لا تحتوي school_members صريحًا مدعومة في platform-session بتوافق users/manager_email.
- مدير النظام لا يحذف localStorage الخاص بالمدرسة من تبويب آخر، بل يتجاهله فقط داخل سياقه.
- أخطاء Syntax: []
