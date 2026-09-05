# تدقيق واستعادة التصحيحات السابقة للعزل — RL40

تم بناء نسخة مقارنة من:
1. النسخة المرجعية `النسخة المصححة الأخيرة.zip`.
2. جميع Patches من RL18 حتى RL32 بالترتيب.
3. ثم مقارنة الناتج مع التراكم الحالي RL33 → RL39.

## النتيجة

### تصحيحات تأكد بقاؤها أو استعيدت لاحقًا
- مركز المعلومات RL19–RL23: أعيد تثبيته في RL38، لذلك لم نرجع إلى نسخة أقدم.
- المراسلات RL23: ملف `internal-messaging.js` لم يستبدله RL33.
- Backend الانضباط RL27: لم يحتج استعادة من نسخة قديمة.
- `platform-files` بعد RL33: تغيراته أمنية مرتبطة بالعزل، لذلك لم نرجعه إلى RL29.

### رجوع برمجي مؤكد تم استعادته في هذه الحزمة
- القرارات والتكليفات RL24/RL25: استعادة Retry / Same-ID recovery / historical reconcile / send-state persistence.
- الحضور والانضباط RL26: استعادة cloud-confirmed save + reread + pending recovery، مع إزالة أي رجوع لهوية من localStorage.
- مكتبة المدير RL29: استعادة recovery + exact ownership verification + reread after upload/rename/trash.
- أرشيف التقويم الذاتي RL30: استعادة HTML snapshot الفعلي + PDF السحابي + إعادة القراءة + إصلاح الفهرس + استعادة السجلات القديمة.
- الإبقاء على حذف RL39 لأرشيف التقويم الذاتي وعدم استبداله بمسار أقدم.
- الإبقاء على تنسيق قرار اللجنة RL39.
- قياس الأثر RL31: استعادة `syncSurveyToMetrics` فقط؛ لم تُستعد مسارات localStorage القديمة لأنها استبدلت عمدًا بعزل RL33 وEdge Function.

### تغييرات لم تُسترجع عمدًا
- أي fallback لهوية المستخدم/المدرسة من `localStorage`.
- `possibleStorageKeys` و`scanEvidenceSource` القديمة في قياس الأثر لأنها كانت تفحص بيانات محلية عبر الأدوار، وقد استبدلت بمصدر الشواهد المعزول.
- أي نسخة أقدم من `platform-cloud-session.js` أو `platform-files`.

## الملفات المعدلة
- `manager.html`
- `self_evaluation_records.html`
- `decisions_assignments.html`
- `staff_discipline.html`
- `impact_assessment.html`

لا يوجد تعديل على RL36/RL37/RL38 خارج هذه المواضع، ولا يوجد تعديل على قاعدة البيانات أو Edge Functions في هذه الحزمة.
