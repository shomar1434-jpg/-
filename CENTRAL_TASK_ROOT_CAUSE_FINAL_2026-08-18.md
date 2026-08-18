# إصلاح جذري لمركز التكليفات — 2026-08-18

## السبب المثبت
النسخة المستقرة كانت تجعل CloudTaskEngine يستخدم `platform_file_session_token` الموجود مباشرة قبل استدعاء `PlatformCloudSession.ensure()`.
لاحقًا تغير ترتيب التحقق وأضيف فحص `ensure()` إجباري في `central-task-cloud-adapter.js` عند فتح الصفحة. لذلك كانت الصفحة تدخل مسار الاستعادة وتعرض رسالة حمراء قبل أن تجرب الرمز الموجود أصلًا.

## الإصلاح
1. إعادة أولوية استخدام الرمز الموجود في `cloud-task-engine.js`.
2. إزالة bootstrap الإجباري للجلسة عند فتح `central-task-cloud-adapter.js`.
3. إبقاء استرداد 401 لمرة واحدة فقط بعد أن يرفض الخادم الرمز فعلًا.
4. كسر كاش الملفات الثلاثة الحساسة في `central_task_center.html`.
5. عدم تعديل platform-tasks أو platform-session أو أي قسم آخر.

## اختبارات
- TOKEN_FIRST_TEST=PASS
- 401_RECOVERY_TEST=PASS
- 54 external JS files: 0 syntax failures
- 88 HTML pages / 316 inline scripts: 0 syntax failures
- الملفات خارج نطاق الإصلاح مطابقة SHA-256 للنسخة السابقة.
