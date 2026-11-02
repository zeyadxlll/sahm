/**
 * Derayah Saudi Pro - Background Service Worker (Manifest V3)
 * Port: 8003
 */

const DEFAULT_CONFIG = {
  backendWsUrl: "ws://localhost:8003/ws",
  autoSync: true,
  scanIntervalMs: 1500,
  minConfidence: 70,
  soundAlerts: false
};

chrome.runtime.onInstalled.addListener(async (details) => {
  console.log("[Derayah Saudi Pro] Extension installed/updated:", details.reason);
  const stored = await chrome.storage.local.get("copilot_settings");
  if (!stored.copilot_settings) {
    await chrome.storage.local.set({ copilot_settings: DEFAULT_CONFIG });
  }
  updateBadge("OFF", "#6b7280");
});

function updateBadge(text, color) {
  chrome.action.setBadgeText({ text: text });
  chrome.action.setBadgeBackgroundColor({ color: color });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "STATUS_UPDATE") {
    if (message.connected) {
      updateBadge("ON", "#10b981");
    } else {
      updateBadge("ERR", "#ef4444");
    }
    sendResponse({ ack: true });
    return true;
  }

  if (message.type === "GET_CONFIG") {
    chrome.storage.local.get("copilot_settings", (data) => {
      sendResponse(data.copilot_settings || DEFAULT_CONFIG);
    });
    return true;
  }

  if (message.type === "HTTP_ANALYZE") {
    const urls = ["http://127.0.0.1:8003/analyze", "http://localhost:8003/analyze"];

    const tryFetch = async () => {
      for (const url of urls) {
        try {
          const resp = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify(message.payload || {})
          });
          if (resp.ok) {
            const data = await resp.json();
            updateBadge("ON", "#10b981");
            return { success: true, data: data };
          }
        } catch (e) {}
      }
      updateBadge("ERR", "#ef4444");
      return { success: false, error: "Derayah Saudi Backend unreachable" };
    };

    tryFetch().then(sendResponse);
    return true;
  }
});
