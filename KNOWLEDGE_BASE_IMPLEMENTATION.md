# القاعدة المعرفية المركزية — حالة التنفيذ

تم تنفيذ البنية التالية:

1. قاعدة البيانات في مشروع Supabase الرئيسي:
   - knowledge_documents
   - knowledge_chunks
   - knowledge_audit_log
   - pgvector + match_knowledge_chunks
2. Bucket خاص ومغلق: regulatory-knowledge
3. سياسات Storage: الرفع/القراءة/التعديل/الحذف لمدير النظام المصادق عليه فقط.
4. Edge Function: platform-knowledge (JWT مفعّل)
   - list
   - ingest + embeddings
   - set_status
   - delete
   - signed_url
   - search_test
5. بوابة الذكاء الاصطناعي ASK-AI المركزية:
   - Responses API
   - Embeddings API باستخدام text-embedding-3-small
6. Agent V2:
   - أداة search_regulatory_knowledge
   - إظهار المراجع في واجهة المحادثة
7. واجهة مدير النظام knowledge_base.html:
   - PDF / DOCX / TXT
   - استخراج النص
   - حفظ أرقام صفحات PDF
   - إدارة الإصدار والحالة والاستبدال
   - اختبار البحث الدلالي

المسار التشغيلي:
مدير النظام يرفع الدليل -> Storage -> استخراج وفهرسة -> مقاطع Vector -> Agent V2 يبحث -> المستخدم في المدرسة يحصل على إجابة مع المصدر والصفحة.

ملاحظة:
ملف PDF الممسوح كصور فقط يحتاج OCR قبل الرفع حتى يصبح النص قابلًا للفهرسة.
