/**
 * Derayah Global SPX Options - Master Content Script
 * Port: 8002
 */

window.DerayahContent = {
  ws: null,
  wsUrl: "ws://localhost:8002/ws",
  isConnected: false,
  reconnectAttempts: 0,
  maxReconnectDelay: 5000,
  activeMarket: "US",

  init() {
    console.log("[Derayah Global SPX] Content script initialized on:", window.location.href);

    if (window.DerayahSidebar) {
      window.DerayahSidebar.init();
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
        console.log("[Derayah Global SPX] Connected to backend on port 8002");
        this.isConnected = true;
        if (window.DerayahSidebar) {
          window.DerayahSidebar.updateConnectionStatus(true);
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (window.DerayahSidebar) {
            window.DerayahSidebar.updateFromBackend(payload.data || payload);
          }
        } catch (e) {}
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        if (window.DerayahSidebar) {
          window.DerayahSidebar.updateConnectionStatus(false);
        }
        setTimeout(() => this.connectWebSocket(), 3000);
      };
    } catch (e) {
      setTimeout(() => this.connectWebSocket(), 3000);
    }
  },

  startScanner() {
    setInterval(() => {
      if (window.DerayahSPXParser && window.DerayahSPXParser.isOptionsChainPage()) {
        const chainData = window.DerayahSPXParser.parseOptionsChain();
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({
            type: "DOM_UPDATE",
            platform: "DERAYAH_GLOBAL",
            market: "US",
            data: chainData,
            timestamp: Date.now()
          }));
        }
      }
    }, 2000);
  }
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => window.DerayahContent.init());
} else {
  window.DerayahContent.init();
}
