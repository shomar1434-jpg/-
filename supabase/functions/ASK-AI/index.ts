import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const message = body.message || body.prompt || body.question || body.text || "";
    const task = body.task || "general";
    const extraData = body.data ? JSON.stringify(body.data).slice(0, 12000) : "";

    if (!message) {
      return new Response(JSON.stringify({
        success: false,
        response: "لم يتم إرسال سؤال أو نص للتحليل.",
        result: "لم يتم إرسال سؤال أو نص للتحليل."
      }), { status: 400, headers: corsHeaders });
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({
        success: false,
        response: "مفتاح OPENAI_API_KEY غير موجود داخل Supabase Secrets.",
        result: "مفتاح OPENAI_API_KEY غير موجود داخل Supabase Secrets."
      }), { status: 500, headers: corsHeaders });
    }

    const systemContent = task === "teams_meeting_minutes"
      ? `أنت مساعد متخصص في إعداد محاضر الاجتماعات المدرسية من نصوص Microsoft Teams داخل منصة الإدارة المدرسية الذكية.
أخرج JSON صحيحًا فقط عند طلب تعبئة محضر اجتماع. لا تضع Markdown. استخرج الحضور الفعلي، المحاور، التوصيات، القرارات، والمهام بصياغة رسمية مختصرة مناسبة لاعتماد مدير/مديرة المدرسة. إذا كانت البيانات ناقصة فاستنتج بشكل محافظ وضع عبارات قابلة للمراجعة.`
      : `أنت مساعد ذكي داخل منصة الإدارة المدرسية الذكية. أجب باللغة العربية بشكل واضح ومختصر ومفيد. إذا سُئلت عن أماكن السجلات أو التقارير داخل المنصة فاشرح المسار العملي للمستخدم خطوة بخطوة.`;

    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        messages: [
          { role: "system", content: systemContent },
          { role: "user", content: message + (extraData ? `

بيانات إضافية من الواجهة:
${extraData}` : "") },
        ],
        temperature: task === "teams_meeting_minutes" ? 0.25 : 0.6,
      }),
    });

    const data = await openaiResponse.json();
    const answer = data?.choices?.[0]?.message?.content || data?.error?.message || "تعذر الحصول على رد من الذكاء الاصطناعي.";

    return new Response(JSON.stringify({
      success: !!data?.choices?.[0]?.message?.content,
      response: answer,
      result: answer,
      answer: answer,
      raw: data?.error ? { error: data.error } : undefined
    }), { headers: corsHeaders });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      response: error?.message || "حدث خطأ غير متوقع.",
      result: error?.message || "حدث خطأ غير متوقع."
    }), { status: 500, headers: corsHeaders });
  }
});
