document.addEventListener("DOMContentLoaded", () => {
  const wsUrlInput = document.getElementById("input-ws-url");
  const autoSyncToggle = document.getElementById("toggle-autosync");
  const saveBtn = document.getElementById("btn-save");
  const testBtn = document.getElementById("btn-test-connection");
  const statusDot = document.getElementById("connection-dot");
  const statusText = document.getElementById("connection-text");

  chrome.storage.local.get("copilot_settings", (data) => {
    if (data && data.copilot_settings) {
      const cfg = data.copilot_settings;
      if (cfg.backendWsUrl) wsUrlInput.value = cfg.backendWsUrl;
      if (cfg.autoSync !== undefined) autoSyncToggle.checked = cfg.autoSync;
    }
    testConnection();
  });

  function testConnection() {
    statusDot.className = "status-dot";
    statusText.innerText = "جاري الفحص...";
    statusText.style.color = "#94a3b8";

    const url = wsUrlInput.value.trim() || "ws://localhost:8003/ws";

    try {
      const testSocket = new WebSocket(url);
      const timer = setTimeout(() => {
        testSocket.close();
        setStatus(false, "انتهت مهلة الاتصال بالخادم");
      }, 2500);

      testSocket.onopen = () => {
        clearTimeout(timer);
        testSocket.close();
        setStatus(true, "متصل بنجاح بالسيرفر (localhost:8003)");
      };

      testSocket.onerror = () => {
        clearTimeout(timer);
        setStatus(false, "تعذر الاتصال بالسيرفر على المنفذ 8003");
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
      statusDot.className = "status-dot error";
      statusText.innerText = text;
      statusText.style.color = "#FF3B56";
    }
  }

  saveBtn.addEventListener("click", () => {
    const newConfig = {
      backendWsUrl: wsUrlInput.value.trim() || "ws://localhost:8003/ws",
      autoSync: autoSyncToggle.checked
    };

    chrome.storage.local.set({ copilot_settings: newConfig }, () => {
      chrome.runtime.sendMessage({ type: "CONFIG_UPDATED", config: newConfig });
      saveBtn.innerText = "✓ تم الحفظ!";
      saveBtn.style.background = "#059669";
      setTimeout(() => {
        saveBtn.innerText = "حفظ الإعدادات";
        saveBtn.style.background = "";
      }, 1500);
      testConnection();
    });
  });

  testBtn.addEventListener("click", testConnection);
});
