إعداد ربط الذكاء الاصطناعي
=========================

تم ربط الواجهة مباشرة بدالة Supabase التالية:
https://mfzsgaqxvxusayoribfo.supabase.co/functions/v1/ASK-AI

ما تم داخل المشروع:
1) إضافة زر ✨ ذكاء المنصة.
2) إضافة زر 🤖 اسألني.
3) تعديل smart-ai-widget.js ليستدعي دالة ASK-AI.
4) عدم وضع مفتاح OpenAI داخل ملفات HTML أو GitHub.

المطلوب منك في Supabase:
1) تأكد من وجود Secret باسم:
OPENAI_API_KEY

2) داخل الدالة ASK-AI > Settings:
أوقف خيار Verify JWT إذا أردت أن يعمل الموقع مباشرة بدون إضافة anon key داخل الواجهة.
هذا لا يكشف مفتاح OpenAI، لأن المفتاح محفوظ داخل Supabase Secrets فقط.

3) إذا أبقيت Verify JWT مفعّلًا، فسيحتاج المشروع إلى anon key الخاص بمشروع Supabase داخل الواجهة أو آلية تسجيل دخول قبل استدعاء الدالة.

ملاحظة مهمة:
لا ترفع مفتاح OpenAI إلى GitHub أبداً.


تم تحديث الربط النهائي:
SUPABASE_URL=https://mfzsgaqxvxusayoribfo.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_wrqnWejHyIhaYnMusFfDQQ_6NBvAK9N
AI_FUNCTION=https://mfzsgaqxvxusayoribfo.supabase.co/functions/v1/ASK-AI
