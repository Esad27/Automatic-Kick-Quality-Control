(() => {
  "use strict";
  const DEFAULTS = { enabled: true, quality: "max" };
  const enabled = document.getElementById("enabled");
  const quality = document.getElementById("quality");
  const connection = document.getElementById("connection");
  const current = document.getElementById("current");
  const auto = document.getElementById("auto");
  const available = document.getElementById("available");
  const statusText = document.getElementById("statusText");
  const apply = document.getElementById("apply");
  let activeTabId = null;
  let isKickTab = false;
  let isLoadingStatus = false;

  function renderEnabled() {
    quality.disabled = !enabled.checked;
    apply.disabled = !enabled.checked || !isKickTab;
  }

  function setConnection(text, type = "") {
    connection.textContent = text;
    connection.className = "state" + (type ? " " + type : "");
  }

  async function getCurrentTab() {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    activeTabId = tab?.id ?? null;
    isKickTab = /^https:\/\/(www\.)?kick\.com\//i.test(tab?.url || "");
    renderEnabled();
    return isKickTab;
  }

  async function refreshStatus() {
    if (isLoadingStatus) return;
    isLoadingStatus = true;
    try {
      if (!await getCurrentTab()) {
        setConnection("Kick sekmesi yok", "warn");
        current.textContent = "—";
        auto.textContent = "—";
        available.style.display = "none";
        statusText.textContent = "Kick.com üzerinde bir yayın sekmesine geç.";
        return;
      }
      const response = await chrome.tabs.sendMessage(activeTabId, { type: "KMQ_STATUS" });
      if (!response?.ok) throw Error(response?.error || "Bağlantı yok");
      const state = response.status || {};
      if (!state.connected) {
        setConnection("Bağlanıyor", "warn");
        statusText.textContent = state.error || "Kick oynatıcı modülü bekleniyor.";
      } else if (!state.playerReady) {
        setConnection("Yayın bekleniyor", "warn");
        statusText.textContent = "Bağlandı. Oynatıcı hazır olunca kalite uygulanacak.";
      } else {
        setConnection("Bağlandı", "good");
        const selection = state.selection;
        if (selection?.fallback && enabled.checked && quality.value !== "auto") {
          statusText.textContent = "İstenen kalite bu yayında yok; " + selection.name + " kullanılıyor.";
        } else {
          statusText.textContent = !enabled.checked
            ? "Eklenti kapalı: kalite kontrolünü Kick yönetir."
            : "Kalite ayarı aktif yayına uygulanıyor.";
        }
      }
      current.textContent = state.currentQuality || "—";
      auto.textContent = state.auto === true ? "Açık" : state.auto === false ? "Kapalı" : "—";
      if (Array.isArray(state.availableQualities) && state.availableQualities.length) {
        available.textContent = "Mevcut: " + state.availableQualities.join(" · ");
        available.style.display = "block";
      } else {
        available.style.display = "none";
      }
    } catch (error) {
      setConnection("Bağlanamadı", "warn");
      statusText.textContent = "Sekmeyi yenileyip tekrar kontrol et. " +
        String(error?.message || error);
      current.textContent = "—";
      auto.textContent = "—";
      available.style.display = "none";
    } finally {
      isLoadingStatus = false;
    }
  }

  async function saveSettings() {
    try {
      await chrome.storage.local.set({
        enabled: enabled.checked,
        quality: quality.value
      });
      renderEnabled();
      setTimeout(refreshStatus, 450);
    } catch (error) {
      statusText.textContent = "Ayar kaydedilemedi: " + String(error?.message || error);
    }
  }

  enabled.addEventListener("change", saveSettings);
  quality.addEventListener("change", saveSettings);
  apply.addEventListener("click", async () => {
    if (!activeTabId || !enabled.checked || !isKickTab) return;
    apply.disabled = true;
    try {
      await chrome.tabs.sendMessage(activeTabId, { type: "KMQ_APPLY" });
      statusText.textContent = "Kalite seçimi yeniden istendi.";
      setTimeout(refreshStatus, 550);
    } catch (error) {
      statusText.textContent = "Uygulanamadı: " + String(error?.message || error);
    } finally {
      setTimeout(renderEnabled, 650);
    }
  });

  async function init() {
    try {
      const saved = await chrome.storage.local.get(DEFAULTS);
      enabled.checked = saved.enabled === true;
      quality.value = [...quality.options].some(o => o.value === saved.quality)
        ? saved.quality : "max";
      renderEnabled();
    } catch (error) {
      statusText.textContent = "Ayarlar okunamadı: " + String(error?.message || error);
    }
    await refreshStatus();
    setInterval(refreshStatus, 1800);
  }
  init();
})();
