/**
 * Sahm Trading Copilot - Popup Controller
 */

document.addEventListener("DOMContentLoaded", async () => {
  const wsUrlInput = document.getElementById("input-ws-url");
  const autoSyncToggle = document.getElementById("toggle-autosync");
  const alertsToggle = document.getElementById("toggle-alerts");
  const statusDot = document.getElementById("popup-status-dot");
  const statusText = document.getElementById("popup-status-text");
  const btnTest = document.getElementById("btn-test-connection");
  const btnSave = document.getElementById("btn-save");
  const btnSimulator = document.getElementById("btn-open-simulator");

  // Load current settings
  chrome.storage.local.get("copilot_settings", (data) => {
    if (data.copilot_settings) {
      const cfg = data.copilot_settings;
      if (cfg.backendWsUrl) wsUrlInput.value = cfg.backendWsUrl;
      if (cfg.autoSync !== undefined) autoSyncToggle.checked = cfg.autoSync;
      if (cfg.soundAlerts !== undefined) alertsToggle.checked = cfg.soundAlerts;
    }
    testConnection();
  });

  // Test WebSocket connection
  function testConnection() {
    statusDot.className = "status-dot";
    statusText.innerText = "جاري الفحص...";
    statusText.style.color = "#94a3b8";

    const url = wsUrlInput.value.trim() || "ws://127.0.0.1:8001/ws";

    try {
      const testSocket = new WebSocket(url);
      const timer = setTimeout(() => {
        testSocket.close();
        setStatus(false, "انتهت مهلة الاتصال بالخادم");
      }, 2500);

      testSocket.onopen = () => {
        clearTimeout(timer);
        testSocket.close();
        setStatus(true, "متصل بنجاح بالسيرفر (127.0.0.1:8001)");
      };

      testSocket.onerror = () => {
        clearTimeout(timer);
        setStatus(false, "تعذر الاتصال بالسيرفر. هل هو يعمل؟");
      };
    } catch (e) {
      setStatus(false, "صيغة الرابط غير صحيحة");
    }
  }

  function setStatus(connected, text) {
    if (connected) {
      statusDot.className = "status-dot connected";
      statusText.innerText = text;
      statusText.style.color = "#00F090";
    } else {
      statusDot.className = "status-dot disconnected";
      statusText.innerText = text;
      statusText.style.color = "#FF3B56";
    }
  }

  btnTest.addEventListener("click", testConnection);

  btnSave.addEventListener("click", () => {
    const config = {
      backendWsUrl: wsUrlInput.value.trim(),
      autoSync: autoSyncToggle.checked,
      soundAlerts: alertsToggle.checked,
      scanIntervalMs: 1500
    };

    chrome.runtime.sendMessage({ type: "SAVE_CONFIG", config: config }, (res) => {
      const err = chrome.runtime?.lastError;
      btnSave.innerText = "✓ تم الحفظ!";
      setTimeout(() => {
        btnSave.innerText = "حفظ الإعدادات";
      }, 1500);
      testConnection();
    });
  });

  btnSimulator.addEventListener("click", () => {
    chrome.tabs.create({
      url: chrome.runtime.getURL("test-harness/sahm_simulator.html")
    });
  });
});
