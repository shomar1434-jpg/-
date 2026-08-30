# تصحيح V3 — الحسابات الفعلية والمعلمون

تم فصل مصدر الحقيقة:
- إدارة المستخدمين: users.school_id هو المصدر الأساسي ويعرض active/pending/disabled ما لم يكن محذوفًا.
- school_members مصدر ثانوي للعضويات والتكليفات، وليس شرطًا لوجود المعلم.
- مركز المعلومات: المستخدم المباشر المفعّل في users يظهر حتى بدون school_members.
- التفعيل والتعطيل من واجهة المدير أصبح سحابيًا أولًا ويزامن status + active معًا.
- الحساب المعلق لا يختفي بعد الإضافة، لذلك لا يحتاج المستخدم لإعادة إضافته ولا يصطدم بالمفتاح الفريد.
- Edge Functions المنشورة: school-accounts v2، school-information v5.

{
  "checks": {
    "cloud_first_activation": true,
    "cloud_first_disable": true,
    "refresh_after_status": true,
    "no_old_local_first_activate": true,
    "syntax_ok": true
  },
  "errors": []
}