# نشر Agent Core V2

## 1. قاعدة البيانات
نفّذ في SQL Editor داخل مشروع Supabase:

`SUPABASE_AGENT_CORE_V2.sql`

ينشئ الجداول:
- agent_conversations
- agent_messages
- agent_memories
- agent_audit_log

## 2. أسرار Supabase
يجب أن يبقى مفتاح OpenAI في الخادم فقط:

```bash
supabase secrets set OPENAI_API_KEY="..." --project-ref <PROJECT_REF>
supabase secrets set OPENAI_AGENT_MODEL="gpt-5" --project-ref <PROJECT_REF>
```

لا تحفظ `OPENAI_API_KEY` في localStorage أو في ملفات HTML/JS.

## 3. نشر Edge Function
الـ workflow تم تحديثه لنشر `platform-agent` عند تغير ملفاتها.
يمكن النشر يدوياً كذلك:

```bash
supabase functions deploy platform-agent --project-ref <PROJECT_REF> --no-verify-jwt
```

## 4. شرط الجلسة
`platform-agent` لا يقبل الطلب إلا مع `x-platform-session` صالح، ويتحقق من تطابق المدرسة والدور مع جلسة `platform_sessions`.

## 5. الاختبار بعد النشر
1. تسجيل الدخول لمدرسة مستقلة.
2. فتح AI AGENT.
3. اختبار الموجز الذكي.
4. سؤال الوكيل عن بيانات تحتاج أداة، والتأكد من ظهور اسم الأداة في سجل التدقيق.
5. الانتقال إلى مدرسة ثانية عبر مبدّل المدارس ثم فتح الوكيل والتأكد من تغير المدرسة في بطاقة السياق.
6. اختبار مستخدم غير قيادي والتأكد من عدم ظهور بيانات مستخدم آخر.
7. اختبار اقتراح تعبئة حقل، ثم الموافقة عليه من مركز الإجراءات.
