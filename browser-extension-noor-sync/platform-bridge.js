(() => {
  if (window.__SMART_SCHOOL_PLATFORM_BRIDGE_V1__) return;
  window.__SMART_SCHOOL_PLATFORM_BRIDGE_V1__ = true;
  const allowedOrigin = 'https://shomar1434-jpg.github.io';
  if (location.origin !== allowedOrigin) return;
  window.addEventListener('smart-school-noor-sync-request', event => {
    const detail = event.detail || {};
    const requestId = String(detail.requestId || '');
    if (!requestId || requestId.length > 120) return;
    chrome.runtime.sendMessage({action:'syncNoorAbsence', requestId, date:String(detail.date || '')}, response => {
      const error = chrome.runtime.lastError?.message;
      window.dispatchEvent(new CustomEvent('smart-school-noor-sync-response', {detail:{
        requestId,
        success: !error && !!response?.success,
        data: response?.data || null,
        error: error || response?.error || ''
      }}));
    });
  });
})();
