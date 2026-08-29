# فحص إصلاح أرشيف التقويم الذاتي V3

- wrapper_iframes: **PASS**
- exact_preview_runtime: **PASS**
- edit_modal_reset: **PASS**
- manager_preview_routes_runtime: **PASS**
- manager_edit_explicit: **PASS**
- inner_js_1_blocks_no_syntax_errors: **PASS**
- manager_js_27_blocks_no_syntax_errors: **PASS**

أخطاء iframe: []

أخطاء manager: []

المبدأ: المعاينة لم تعد تقرأ htmlContent القديم؛ بل تعيد تحميل السجل في مولد التقويم وتستخدم نفس مسار الطباعة وقت المعاينة. التعديل يغلق جميع النوافذ المنبثقة ويعيد التبويب الأصلي حسب type.
