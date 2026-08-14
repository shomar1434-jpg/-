# School Agent Core V2 — المعمارية

## المسار التنفيذي
واجهة القسم → Agent Context → Platform Session Guard → platform-agent → Role Tool Router → OpenAI Responses API → Tool Results → Proposed Actions → User Approval → Existing Platform Engines.

## طبقات النواة
1. `agent-role-profiles.js`: تعريف الخبير المناسب لكل دور.
2. `agent-section-adapters.js`: تعريف القسم المفتوح ومصادر السياق المحلية المسموح بها.
3. `agent-core-v2.js`: السياق، المحادثات، الذاكرة، الإجراءات، الاتصال بالخادم، حماية المدرسة/الدور/العام.
4. `top-ai-center.js`: تجربة الاستخدام الموحدة للوكيل.
5. `openai-engine.js`: طبقة توافق قديمة، لم تعد تتعامل مع مفتاح OpenAI في المتصفح.
6. `platform-agent`: طبقة الخادم والتحقق والأدوات والاتصال بـ OpenAI.

## سياق الوكيل الإلزامي
- school_id
- user_id
- membership_id
- role
- academic_year
- current module/page
- delegation context عند وجوده

## الأمان
- school_id الحقيقي يؤخذ من session server-side.
- role الحقيقي يؤخذ من session server-side.
- الأدوات مفلترة قبل إرسالها للنموذج حسب الدور.
- الكتابة لا تتم عبر function call مباشرة؛ تتحول إلى إجراء مقترح.
- العمليات الحساسة لا توجد لها أداة تنفيذ تلقائي.
- مفتاح OpenAI لا يصل إلى المتصفح.
- `store:false` مستخدم في Responses API لتقليل الاحتفاظ على مستوى استدعاء النموذج.
