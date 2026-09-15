const NOOR_URLS = ['https://noor.moe.gov.sa/*', 'https://*.noor.moe.gov.sa/*'];

async function sendToNoor(tabId, message) {
  try { return await chrome.tabs.sendMessage(tabId, message); }
  catch (_) {
    await chrome.scripting.executeScript({target:{tabId}, files:['content.js']});
    return await chrome.tabs.sendMessage(tabId, message);
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request?.action !== 'syncNoorAbsence') return false;
  (async () => {
    if (sender.tab?.url && !sender.tab.url.startsWith('https://shomar1434-jpg.github.io/')) {
      throw new Error('تم رفض الطلب لأنه لم يصدر من رابط المنصة المعتمد.');
    }
    const tabs = await chrome.tabs.query({url:NOOR_URLS});
    if (!tabs.length) throw new Error('لا يوجد تبويب مفتوح لنظام نور. افتح كشف الغياب اليومي في نور ثم أعد المحاولة.');
    tabs.sort((a,b) => Number(b.active)-Number(a.active) || Number(b.lastAccessed||0)-Number(a.lastAccessed||0));
    let lastError = null;
    for (const tab of tabs) {
      try {
        const response = await sendToNoor(tab.id, {action:'extractData', type:'absence', expectedDate:request.date});
        if (response?.success) return sendResponse({success:true, data:{records:response.data || [], pageUrl:tab.url}});
        lastError = new Error(response?.error || 'تعذر استخراج الغياب من هذا التبويب.');
      } catch (error) { lastError = error; }
    }
    throw lastError || new Error('تعذر الاتصال بصفحة نور المفتوحة.');
  })().catch(error => sendResponse({success:false, error:String(error?.message || error)}));
  return true;
});
