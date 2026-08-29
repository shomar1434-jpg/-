# Security Isolation V4 Clean — QA

- مصدر البناء: Security Isolation V2 المستقرة، وليس V3/V3.1.
- لم تتم إضافة أي طبقة تصحيح تراكمية من V3 أو V3.1.
- التحقق الأمني للمدير ما زال يعتمد PlatformCloudSession.verifyAccess(['manager']).
- بعد نجاح التحقق: إخفاء activation-overlay، إخفاء dashboard، إظهار welcome-gate مرة واحدة فقط.
- enterApp واحد فقط: يخفي welcome-gate فعلياً (`display:none` + `hidden=true`) ويظهر welcome-dashboard (`hidden=false` + إزالة hidden + display:block).
- لا توجد قواعد pointer-events أو z-index جديدة تخص شاشة الترحيب.
- لا توجد مؤقتات setTimeout لإعادة إظهار شاشة الترحيب.
- لا توجد علامات data-platform-entered أو renderVerifiedWelcome من V3/V3.1.
- فحص JavaScript المضمن في manager.html: 27 كتلة غير فارغة، 0 أخطاء Syntax.
- platform-cloud-session.js: node --check ناجح.
- school-information-source.js: node --check ناجح.
- ملفات عزل مركز المعلومات وخدمة school-information من V2 محفوظة دون تغيير وظيفي.
