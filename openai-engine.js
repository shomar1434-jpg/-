(function(){
  if (window.__OPENAI_ENGINE_READY__) return;
  window.__OPENAI_ENGINE_READY__ = true;

  function getApiKey(){
    return (
      localStorage.getItem("OPENAI_API_KEY") ||
      localStorage.getItem("openai_api_key") ||
      localStorage.getItem("school_openai_api_key") ||
      window.OPENAI_API_KEY ||
      window.openaiApiKey ||
      ""
    ).trim();
  }

  function setApiKey(key){
    if(!key || !String(key).trim()) throw new Error("مفتاح OpenAI فارغ.");
    localStorage.setItem("OPENAI_API_KEY", String(key).trim());
  }

  function getModel(){
    return localStorage.getItem("OPENAI_MODEL") || window.OPENAI_MODEL || "gpt-4o-mini";
  }

  function setModel(model){
    localStorage.setItem("OPENAI_MODEL", model || "gpt-4o-mini");
  }

  async function call(systemPrompt, userPrompt, options){
    const key = getApiKey();
    if(!key) throw new Error("لم يتم العثور على مفتاح OpenAI. احفظه في إعدادات OpenAI داخل AI CENTER.");

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + key
      },
      body: JSON.stringify({
        model: (options && options.model) || getModel(),
        temperature: typeof (options && options.temperature) === "number" ? options.temperature : 0.3,
        messages: [
          { role: "system", content: systemPrompt || "أنت مساعد قيادة مدرسية ذكي." },
          { role: "user", content: userPrompt || "" }
        ]
      })
    });

    const data = await response.json().catch(function(){ return {}; });
    if(!response.ok){
      throw new Error(data && data.error && data.error.message ? data.error.message : "فشل الاتصال بـ OpenAI.");
    }
    return data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : "";
  }

  window.OpenAIEngine = {
    call: call,
    getApiKey: getApiKey,
    setApiKey: setApiKey,
    getModel: getModel,
    setModel: setModel,
    isConfigured: function(){ return !!getApiKey(); }
  };

  window.callOpenAI = async function(promptOrSystem, maybeUserPrompt, options){
    if(maybeUserPrompt){
      return await call(promptOrSystem, maybeUserPrompt, options);
    }
    return await call(
      "أنت مساعد قيادة مدرسية ذكي. أجب بالعربية وبصياغة إدارية منظمة ومختصرة.",
      promptOrSystem,
      options
    );
  };
})();