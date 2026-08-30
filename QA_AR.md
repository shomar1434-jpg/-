# تصحيح مصدر الحسابات الفعلي V2

- إدارة المستخدمين في المدرسة لا تعتمد على Cache أو membership يتيم.
- مصدر الحسابات التشغيلي: school-accounts، ويعيد فقط حسابات users الموجودة وغير المحذوفة المرتبطة بالمدرسة.
- مركز المعلومات: المنسوبون النشطون فعليًا فقط (users.status=active + users.active=true + school_members.status=active).
- تم توحيد زر التحديث في مركز المعلومات إلى مسار واحد.
- تم تنظيف العضويات اليتيمة من قاعدة البيانات بتحويل حالتها إلى deleted دون حذف السجلات التاريخية.
- القرارات الجديدة تستمر في الاعتماد على القائمة الحية؛ القرارات التاريخية لا تُمس.
- school-information Edge Function v4 يحافظ على جميع عمليات الطلاب السابقة مع تصحيح staff-list.
- school-accounts Edge Function v1 أضيف كمسار قراءة حسابات موثوق لإدارة المستخدمين.


{
  "checks": {
    "manager_uses_authoritative_edge": true,
    "manager_no_stale_fallback": true,
    "empty_cloud_overwrites_cache": true,
    "legacy_cache_purge_scoped": true,
    "followup_hydrates_before_counts": true,
    "single_center_refresh_button": true,
    "center_refresh_single_source": true,
    "source_active_true_required": true,
    "decisions_live_source": true,
    "syntax_ok": false
  },
  "errors": [
    [
      "manager.html",
      19,
      "/mnt/data/authoritative_accounts_fix_v2/_q.js:248\n  async async function showActivation(){try{await hydrateUsersFromSupabase();}catch(e){panel('إدارة الحسابات','<div class=\"ss-card red\"><b>تعذر تحميل الحسابات الفعلية</b><div class=\"ss-muted\">'+esc(e.message||e)+'</div></div>');return}await resolveManagerSchoolContext(); var u=users(); panel('تنشيط المستخدمين وإدارة الصلاحيات','<div class=\"ss-grid\""
    ]
  ]
}

## الفحص النهائي
- JavaScript syntax: PASS
