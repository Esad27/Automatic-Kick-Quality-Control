/*
 * MAIN-world bridge. Kick source bundle examined in October 2026:
 * Turbopack module 159838, export `f`, a Zustand-like store with getState().
 * getState().ivsLivestreamPlayer holds Amazon IVS Player;
 * getState().setQuality(quality, adaptive) is Kick's own UI-synchronizing action.
 * Internal module access is undocumented and may break after a Kick update.
 */
(() => {
  "use strict";
  const CHANNEL = "kick-quality-control-v2";
  const GUARD = "__kickQualityControlV2";
  if (window[GUARD]) return;

  let settings = null; // Wait for chrome.storage settings from the ISOLATED script.
  let store = null;
  let unsubscribe = null;
  let lastAttempt = { key: "", at: 0 };
  let lastSelection = null;
  let attachError = "";
  let lastRuntimeAttempt = 0;
  let runtimeAttempts = 0;
  let checkTimer = null;
  const createdAt = Date.now();
  const log = (...args) => console.info("[Kick Quality]", ...args);
  const warn = (...args) => console.warn("[Kick Quality]", ...args);

  function normalizeSettings(value) {
    const quality = typeof value?.quality === "string" ? value.quality : "max";
    const valid = quality === "max" || quality === "auto" ||
      /^(1080|720|480|360|160)$/.test(quality);
    return {
      enabled: value?.enabled === true,
      quality: valid ? quality : "max"
    };
  }

  function fps(quality) {
    const match = String(quality?.name || "").match(/\dp(\d+)\b/i);
    return match ? Number(match[1]) : 0;
  }

  function videoQualities(qualityList) {
    return (Array.isArray(qualityList) ? qualityList : [])
      .filter(q => q && Number(q.height) > 0 && q.name !== "Auto")
      .slice()
      .sort((a, b) =>
        Number(b.height) - Number(a.height) ||
        fps(b) - fps(a) ||
        Number(b.bitrate || 0) - Number(a.bitrate || 0)
      );
  }

  function chooseQuality(qualities, preference) {
    const video = videoQualities(qualities);
    if (!video.length) return null;
    if (preference === "max") return video[0];
    const requestedHeight = Number(preference);
    // Prefer an exact resolution. If absent, use the closest lower resolution;
    // when there is no lower rendition, choose the lowest available video.
    return video.find(q => Number(q.height) === requestedHeight) ||
      video.find(q => Number(q.height) < requestedHeight) ||
      video[video.length - 1];
  }

  function sameQuality(a, b) {
    if (!a || !b) return false;
    if (a.variantId && b.variantId) return a.variantId === b.variantId;
    return a.name === b.name && a.height === b.height &&
      (a.bitrate == null || b.bitrate == null || a.bitrate === b.bitrate);
  }

  function playerFromStore() {
    return store && typeof store.getState === "function"
      ? store.getState()?.ivsLivestreamPlayer : null;
  }

  function switchToAuto() {
    if (!store) return;
    try {
      const state = store.getState();
      const player = state?.ivsLivestreamPlayer;
      if (!player || typeof player.setAutoQualityMode !== "function") return;
      if (player.isAutoQualityMode?.() === true) return;
      // Use Kick's action to keep its quality menu consistent with IVS.
      if (typeof state.setQuality === "function") state.setQuality({ name: "Auto" });
      else player.setAutoQualityMode(true);
      lastSelection = { name: "Auto", fallback: false };
      log("Auto quality mode enabled.");
    } catch (error) {
      warn("Could not restore Auto mode:", error);
    }
  }

  function applyQuality(force = false) {
    if (!settings?.enabled || !store) return;
    try {
      const state = store.getState();
      const player = state?.ivsLivestreamPlayer;
      if (!player || !state.currentVideoInformations || state.isAdPlaying) return;
      if (["IDLE", "ENDED"].includes(state.currentPlayerState)) return;

      if (settings.quality === "auto") {
        switchToAuto();
        return;
      }
      if (typeof player.getQualities !== "function" ||
          typeof player.setQuality !== "function") return;

      const chosen = chooseQuality(player.getQualities(), settings.quality);
      if (!chosen) return;
      const current = typeof player.getQuality === "function"
        ? player.getQuality() : null;
      const isAuto = typeof player.isAutoQualityMode === "function"
        ? player.isAutoQualityMode() : null;
      if (isAuto === false && sameQuality(current, chosen)) {
        lastSelection = {
          name: chosen.name,
          fallback: settings.quality !== "max" &&
            Number(chosen.height) !== Number(settings.quality),
          requestedHeight: settings.quality
        };
        return;
      }

      // Avoid a selection loop triggered by Kick's QUALITY_CHANGED event.
      const media = state.currentVideoInformations;
      const streamKey = String(media.playbackUrl || media.id || "unknown");
      const qualityKey = String(chosen.variantId || chosen.name);
      const key = streamKey + "|" + qualityKey + "|" + settings.quality;
      const now = Date.now();
      if (!force && lastAttempt.key === key && now - lastAttempt.at < 3200) return;
      lastAttempt = { key, at: now };

      // false: immediate quality change (clear current buffer).
      // This is the action Kick itself uses in the uploaded source bundle.
      if (typeof state.setQuality === "function") state.setQuality(chosen, false);
      else player.setQuality(chosen, false);
      lastSelection = {
        name: chosen.name,
        fallback: settings.quality !== "max" &&
          Number(chosen.height) !== Number(settings.quality),
        requestedHeight: settings.quality
      };
      log("Requested:", chosen.name, "for preference:", settings.quality);
    } catch (error) {
      attachError = "Kalite değiştirme hatası: " + String(error?.message || error);
      warn("Cannot apply selected quality:", error);
    }
  }

  function scheduleApply(delay = 160) {
    if (checkTimer !== null) return;
    checkTimer = setTimeout(() => {
      checkTimer = null;
      applyQuality();
    }, delay);
  }

  function attachStore(imported) {
    if (store || typeof imported?.getState !== "function") return;
    store = imported;
    attachError = "";
    log("Connected to Kick's IVS store (module 159838).");
    if (typeof store.subscribe === "function") {
      unsubscribe = store.subscribe((next, prev) => {
        if (!prev ||
          next.ivsLivestreamPlayer !== prev.ivsLivestreamPlayer ||
          next.currentVideoInformations !== prev.currentVideoInformations ||
          next.currentPlayerState !== prev.currentPlayerState ||
          next.qualities !== prev.qualities ||
          next.currentQuality !== prev.currentQuality ||
          next.isAdPlaying !== prev.isAdPlaying) {
          scheduleApply();
        }
      });
    }
    scheduleApply();
  }

  function tryAttachRuntime() {
    if (store) return;
    const runtime = globalThis.TURBOPACK;
    if (!runtime || typeof runtime.push !== "function") return;
    // Before Turbopack boots, TURBOPACK is an ordinary array. Never push
    // experimental chunks into that uninitialized queue.
    if (Array.isArray(runtime) && runtime.push === Array.prototype.push) return;
    const now = Date.now();
    // The player chunk can be lazy-loaded, so retry until it exists.
    if (now - lastRuntimeAttempt < (runtimeAttempts < 5 ? 2500 : 10000)) return;
    lastRuntimeAttempt = now;
    runtimeAttempts++;
    const id = "kick-quality-bridge-" + now.toString(36) + "-" + runtimeAttempts;
    const chunkPath = "static/chunks/" + id + ".js";
    try {
      // Compressed factory registration: [chunk, moduleId, moduleFactory].
      runtime.push([
        chunkPath,
        id,
        context => {
          try {
            attachStore(context.i(159838)?.f);
          } catch (error) {
            attachError = "Modül henüz hazır değil veya güncellendi";
            if (runtimeAttempts <= 3) warn("Store import failed:", error);
          }
        }
      ]);
      // Register a runtime entry for the exact same synthetic chunk. No
      // network loading is requested (otherChunks is empty).
      runtime.push([
        chunkPath,
        { otherChunks: [], runtimeModuleIds: [id] }
      ]);
    } catch (error) {
      attachError = "Turbopack runtime bağlantısı başarısız";
      warn("Runtime registration failed:", error);
    }
  }

  function getStatus() {
    try {
      const state = store?.getState?.();
      const player = state?.ivsLivestreamPlayer;
      const video = player?.getQualities?.();
      const current = player?.getQuality?.();
      const auto = player?.isAutoQualityMode?.();
      return {
        connected: Boolean(store),
        playerReady: Boolean(player && Array.isArray(video) && video.length),
        streamName: state?.currentVideoInformations?.name || null,
        playerState: state?.currentPlayerState || null,
        currentQuality: auto === true ? "Auto" : (current?.name || state?.currentQuality?.name || null),
        auto: typeof auto === "boolean" ? auto : null,
        availableQualities: videoQualities(video).map(q => q.name),
        selection: lastSelection,
        error: attachError,
        attempts: runtimeAttempts,
        uptimeSeconds: Math.round((Date.now() - createdAt) / 1000)
      };
    } catch (error) {
      return { connected: Boolean(store), playerReady: false,
        currentQuality: null, availableQualities: [],
        error: String(error?.message || error) };
    }
  }

  function receive(event) {
    if (event.source !== window || event.origin !== location.origin) return;
    const data = event.data;
    if (!data || data.channel !== CHANNEL || data.direction !== "to-page") return;

    if (data.type === "CONFIG") {
      const next = normalizeSettings(data.settings);
      const previous = settings;
      settings = next;
      if (!previous || previous.quality !== next.quality) lastSelection = null;
      lastAttempt.at = 0;
      if (previous?.enabled && !next.enabled) switchToAuto();
      else if (next.enabled) scheduleApply(0);
    } else if (data.type === "APPLY") {
      lastAttempt.at = 0;
      applyQuality(true);
    } else if (data.type === "STATUS") {
      window.postMessage({
        channel: CHANNEL, direction: "to-extension",
        type: "STATUS_RESPONSE", id: data.id, status: getStatus()
      }, location.origin);
    }
  }

  window.addEventListener("message", receive);
  const watch = setInterval(() => {
    if (!store) tryAttachRuntime();
    else if (settings?.enabled) scheduleApply();
  }, 1500);

  window[GUARD] = {
    getStatus,
    getStore: () => store,
    apply: () => applyQuality(true),
    stop: () => {
      clearInterval(watch);
      if (checkTimer !== null) clearTimeout(checkTimer);
      if (unsubscribe) unsubscribe();
      window.removeEventListener("message", receive);
      delete window[GUARD];
    }
  };
  tryAttachRuntime();
})();
