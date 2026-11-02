/**
 * Derayah Saudi Pro - Master Content Script
 * Port: 8003
 */

window.DerayahSaudiContent = {
  ws: null,
  wsUrl: "ws://localhost:8003/ws",
  isConnected: false,
  activeMarket: "SA",

  init() {
    console.log("[Derayah Saudi Pro] Content script initialized on:", window.location.href);

    if (window.DerayahSaudiSidebar) {
      window.DerayahSaudiSidebar.init();
    }

    this.loadConfig();
    this.connectWebSocket();
    this.startScanner();
  },

  loadConfig() {
    if (chrome?.storage?.local) {
      chrome.storage.local.get("copilot_settings", (data) => {
        if (data?.copilot_settings?.backendWsUrl) {
          this.wsUrl = data.copilot_settings.backendWsUrl;
        }
      });
    }
  },

  connectWebSocket() {
    try {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => {
        console.log("[Derayah Saudi Pro] Connected to backend on port 8003");
        this.isConnected = true;
        if (window.DerayahSaudiSidebar) {
          window.DerayahSaudiSidebar.updateConnectionStatus(true);
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (window.DerayahSaudiSidebar) {
            window.DerayahSaudiSidebar.updateFromBackend(payload.data || payload);
          }
        } catch (e) {}
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        if (window.DerayahSaudiSidebar) {
          window.DerayahSaudiSidebar.updateConnectionStatus(false);
        }
        setTimeout(() => this.connectWebSocket(), 3000);
      };
    } catch (e) {
      setTimeout(() => this.connectWebSocket(), 3000);
    }
  },

  startScanner() {
    setInterval(() => {
      if (window.DerayahSaudiParser && window.DerayahSaudiParser.isMarketPage()) {
        const marketData = window.DerayahSaudiParser.parseMarketTable();
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({
            type: "DOM_UPDATE",
            platform: "DERAYAH_SAUDI",
            market: "SA",
            data: marketData,
            timestamp: Date.now()
          }));
        }
      }
    }, 2000);
  }
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => window.DerayahSaudiContent.init());
} else {
  window.DerayahSaudiContent.init();
}
