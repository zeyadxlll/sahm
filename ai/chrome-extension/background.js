/**
 * Sahm Trading Copilot - Background Service Worker (Manifest V3)
 * Manages extension state, badge status, and communications.
 */

const DEFAULT_CONFIG = {
  backendWsUrl: "ws://localhost:8000/ws",
  autoSync: true,
  scanIntervalMs: 1500,
  minConfidence: 70,
  soundAlerts: false
};

// Initialize settings on installation
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log("[Sahm Copilot] Extension installed/updated:", details.reason);
  const stored = await chrome.storage.local.get("copilot_settings");
  if (!stored.copilot_settings) {
    await chrome.storage.local.set({ copilot_settings: DEFAULT_CONFIG });
  }
  updateBadge("OFF", "#6b7280");
});

// Update badge utility
function updateBadge(text, color) {
  chrome.action.setBadgeText({ text: text });
  chrome.action.setBadgeBackgroundColor({ color: color });
}

// Listen for messages from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "STATUS_UPDATE") {
    if (message.connected) {
      updateBadge("ON", "#10b981"); // Emerald green
    } else {
      updateBadge("ERR", "#ef4444"); // Red
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
    const urls = ["http://127.0.0.1:8000/analyze", "http://localhost:8000/analyze"];

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
        } catch (e) {
          // Continue to next URL
        }
      }
      return { success: false, error: "Backend HTTP unreachable" };
    };

    tryFetch().then((res) => {
      sendResponse(res);
    });

    return true; // Keep message channel open for async response
  }

  if (message.type === "SAVE_CONFIG") {
    chrome.storage.local.set({ copilot_settings: message.config }, () => {
      // Notify active tabs of config update
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        tabs.forEach((tab) => {
          chrome.tabs.sendMessage(tab.id, {
            type: "CONFIG_UPDATED",
            config: message.config
          }, () => {
            const err = chrome.runtime?.lastError;
          });
        });
      });
      sendResponse({ success: true });
    });
    return true;
  }
});
