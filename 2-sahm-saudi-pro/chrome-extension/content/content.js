/**
 * Sahm Saudi Pro - Master Content Script (تاسي ونمو)
 * Connects to Python Backend on Port 8001
 */

window.SahmContent = {
  ws: null,
  wsUrls: ["ws://127.0.0.1:8001/ws", "ws://localhost:8001/ws"],
  wsUrlIndex: 0,
  wsUrl: "ws://127.0.0.1:8001/ws",
  isConnected: false,
  reconnectAttempts: 0,
  maxReconnectDelay: 5000,
  mutationObserver: null,
  scanDebounceTimer: null,
  refreshInterval: null,
  lastDispatchedHash: "",
  activeMarket: "SA",
  marketStatus: "OPEN",

  init() {
    console.log("[Sahm Saudi Pro] 🇸🇦 Initializing Saudi Pro Content Script on:", window.location.href);

    if (window.SahmSidebar) {
      window.SahmSidebar.init();
    }

    this.loadConfig();
    this.connectWebSocket();
    this.hookSPANavigation();
    this.startObserver();
    this.startLiveRefreshLoop();

    setTimeout(() => {
      this.inspectAndScanPage(false);
    }, 1000);
  },

  loadConfig() {
    if (chrome?.storage?.local) {
      chrome.storage.local.get("copilot_settings", (data) => {
        if (data?.copilot_settings?.backendWsUrl) {
          this.wsUrl = data.copilot_settings.backendWsUrl;
        }
      });
    }

    if (chrome?.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener((msg) => {
        if (msg.type === "CONFIG_UPDATED" && msg.config?.backendWsUrl) {
          this.wsUrl = msg.config.backendWsUrl;
          this.reconnectWebSocket();
        }
      });
    }
  },

  connectWebSocket() {
    try {
      const activeUrl = this.wsUrl || this.wsUrls[this.wsUrlIndex % this.wsUrls.length];
      this.ws = new WebSocket(activeUrl);

      this.ws.onopen = () => {
        console.log(`[Sahm Saudi Pro] ✅ WebSocket Connected to Port 8001 (${activeUrl})`);
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.notifyStatus(true);

        this.sendMessage({
          type: "HANDSHAKE",
          client: "SahmSaudiPro_V1",
          market: "SA",
          url: window.location.href,
          timestamp: Date.now()
        });

        this.inspectAndScanPage(false);
      };

      this.ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          this.handleBackendMessage(payload);
        } catch (e) {}
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.notifyStatus(false);
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        this.isConnected = false;
        this.notifyStatus(false);
      };
    } catch (e) {
      this.scheduleReconnect();
    }
  },

  scheduleReconnect() {
    this.reconnectAttempts++;
    this.wsUrlIndex = (this.wsUrlIndex + 1) % this.wsUrls.length;
    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), this.maxReconnectDelay);
    setTimeout(() => this.connectWebSocket(), delay);
  },

  reconnectWebSocket() {
    if (this.ws) {
      try { this.ws.close(); } catch (e) {}
    }
    this.connectWebSocket();
  },

  notifyStatus(connected) {
    if (window.SahmSidebar) {
      window.SahmSidebar.updateConnectionStatus(connected);
    }
    try {
      chrome.runtime.sendMessage({ type: "STATUS_UPDATE", connected });
    } catch (e) {}
  },

  handleBackendMessage(payload) {
    if (payload.type === "ANALYSIS_UPDATE" || payload.type === "SAUDI_SIGNAL" || payload.type === "RADAR_UPDATE") {
      if (window.SahmSidebar) {
        window.SahmSidebar.updateFromBackend(payload.data || payload);
      }
    }
  },

  sendMessage(data) {
    let wsSent = false;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(data));
        wsSent = true;
      } catch (e) {}
    }

    // HTTP Fallback ONLY if WebSocket is not open / failed
    if (!wsSent) {
      try {
        chrome.runtime.sendMessage({
          type: "HTTP_ANALYZE",
          payload: data
        }, (res) => {
          if (res?.success && res?.data) {
            this.handleBackendMessage(res.data);
          }
        });
      } catch (e) {}
    }
    return wsSent;
  },

  hookSPANavigation() {
    const handleUrlChange = () => {
      setTimeout(() => this.inspectAndScanPage(false), 600);
    };

    window.addEventListener("popstate", handleUrlChange);
    const originalPushState = history.pushState;
    history.pushState = function (...args) {
      originalPushState.apply(this, args);
      handleUrlChange();
    };
  },

  startObserver() {
    if (this.mutationObserver) this.mutationObserver.disconnect();

    this.mutationObserver = new MutationObserver((mutations) => {
      // 0% CPU optimization: skip when user is on another tab
      if (document.hidden) return;

      let isRelevant = false;
      for (const m of mutations) {
        // Strictly ignore any mutation triggered by or inside our own copilot sidebar
        if (m.target?.id === "sahm-copilot-root" || m.target?.id === "sahm-copilot-sidebar") continue;
        if (m.target?.closest?.("#sahm-copilot-root") || m.target?.closest?.("#sahm-copilot-sidebar")) continue;

        const tag = m.target.nodeName;
        const cls = String(m.target.className || "");

        // Only react to table, order book, or trade list DOM changes
        if (
          tag === "TABLE" || tag === "TBODY" || tag === "TR" ||
          cls.includes("market-table") || cls.includes("n-data-table") ||
          cls.includes("order-book") || cls.includes("depth") || cls.includes("trade")
        ) {
          isRelevant = true;
          break;
        }
      }

      if (isRelevant) {
        if (this.scanDebounceTimer) clearTimeout(this.scanDebounceTimer);
        // Smooth 1200ms debounce to prevent thrashing
        this.scanDebounceTimer = setTimeout(() => this.inspectAndScanPage(false), 1200);
      }
    });

    this.mutationObserver.observe(document.body, { childList: true, subtree: true });
  },

  startLiveRefreshLoop() {
    if (this.refreshInterval) clearInterval(this.refreshInterval);
    // Smooth 3000ms loop with document.hidden guard for 0% CPU consumption
    this.refreshInterval = setInterval(() => {
      if (document.hidden) return;
      this.inspectAndScanPage(false);
      if (window.SahmSidebar?.checkActiveTradeAlerts) {
        window.SahmSidebar.checkActiveTradeAlerts();
      }
    }, 3000);
  },

  inspectAndScanPage(isManual = false) {
    if (document.hidden && !isManual) return;

    const payload = {
      type: "DOM_UPDATE",
      market: "SA",
      platform: "Sahm Saudi Pro",
      url: window.location.href,
      timestamp: Date.now(),
      pageType: "UNKNOWN",
      data: null
    };

    // 1. Check: Single Stock Detail Page (4D & Order Flow)
    if (window.SahmStockParser && window.SahmStockParser.isStockDetailPage()) {
      payload.pageType = "STOCK_DETAIL";
      payload.data = window.SahmStockParser.getSnapshot();

      if (window.SahmSidebar) {
        window.SahmSidebar.updateStockSnapshot(payload.data);
        window.SahmSidebar.updateDiagnosticBadge(
          `✓ تم التقاط السهم ${payload.data.stock.symbol} ${payload.data.stock.name}`,
          "تفاصيل السهم"
        );
      }
    }
    // 2. Check: Saudi Market Overview / Watchlist Table
    else if (window.SahmMarketParser && window.SahmMarketParser.isMarketPage()) {
      payload.pageType = "MARKET_OVERVIEW";
      const tableData = window.SahmMarketParser.parseMarketTable();
      payload.data = tableData;

      if (window.SahmSidebar) {
        window.SahmSidebar.updateMarketOverview(tableData);
        window.SahmSidebar.updateDiagnosticBadge(
          `✓ تم مسح ${tableData.count} سهم سعودي بدقة data-col-key`,
          "جدول السوق (تاسي ونمو)"
        );
      }
    }

    if (payload.data) {
      const hash = `${payload.pageType}_${payload.data.count || payload.data.stock?.symbol}_${payload.data.rows?.[0]?.lastPrice || payload.data.stock?.price}`;
      // Only dispatch if data changed or manually requested (no random polling dispatch)
      if (hash !== this.lastDispatchedHash || isManual) {
        this.lastDispatchedHash = hash;
        this.sendMessage(payload);
      }
    }
  }
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => window.SahmContent.init());
} else {
  window.SahmContent.init();
}
