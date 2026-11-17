/* Runs in Chrome's ISOLATED world, where chrome.storage is available. */
(() => {
  "use strict";
  const CHANNEL = "kick-quality-control-v2";
  const DEFAULTS = { enabled: true, quality: "max" };
  const pending = new Map();

  function send(type, extra = {}) {
    window.postMessage({
      channel: CHANNEL,
      direction: "to-page",
      type,
      ...extra
    }, location.origin);
  }

  chrome.storage.local.get(DEFAULTS, settings => {
    if (chrome.runtime.lastError) {
      console.warn("[Kick Quality] Could not read settings:", chrome.runtime.lastError);
      return;
    }
    send("CONFIG", { settings });
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (!changes.enabled && !changes.quality) return;
    chrome.storage.local.get(DEFAULTS, settings => {
      if (!chrome.runtime.lastError) send("CONFIG", { settings });
    });
  });

  window.addEventListener("message", event => {
    if (event.source !== window || event.origin !== location.origin) return;
    const msg = event.data;
    if (!msg || msg.channel !== CHANNEL ||
        msg.direction !== "to-extension" || msg.type !== "STATUS_RESPONSE") return;
    const request = pending.get(msg.id);
    if (!request) return;
    pending.delete(msg.id);
    clearTimeout(request.timer);
    request.sendResponse({ ok: true, status: msg.status });
  });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === "KMQ_APPLY") {
      send("APPLY");
      sendResponse({ ok: true });
      return false;
    }
    if (message?.type !== "KMQ_STATUS") return false;
    const id = "request-" + Date.now() + "-" +
      Math.random().toString(36).slice(2);
    const timer = setTimeout(() => {
      pending.delete(id);
      sendResponse({ ok: false, error: "Oynatıcı bağlantısından yanıt alınamadı." });
    }, 1200);
    pending.set(id, { timer, sendResponse });
    send("STATUS", { id });
    return true;
  });
})();
