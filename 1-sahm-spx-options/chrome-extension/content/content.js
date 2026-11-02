/**
 * Sahm Trading Copilot - Master Content Script
 * Observes DOM mutations, reads active page context in real-time on https://app.sahmcapital.com/*,
 * detects active market (SA vs US) and session status (Open vs Closed),
 * and maintains resilient WebSocket communication with the Python backend.
 */

window.SahmContent = {
  ws: null,
  wsUrl: "ws://localhost:8000/ws",
  isConnected: false,
  reconnectAttempts: 0,
  maxReconnectDelay: 5000,
  mutationObserver: null,
  scanDebounceTimer: null,
  heartbeatInterval: null,
  lastDispatchedHash: "",
  activePageType: "UNKNOWN",
  activeMarket: "SA", // "SA" or "US"
  marketStatus: "OPEN", // "OPEN" or "CLOSED"
  activeStrategy: "AUTO",

  /**
   * Main Entry Point
   */
  init() {
    console.log("[Sahm Copilot] Initializing Content Script on:", window.location.href);

    // 1. Detect market and session status from initial page state
    this.detectMarketContext();

    // 2. Initialize Floating Sidebar
    if (window.SahmSidebar) {
      window.SahmSidebar.init();
      window.SahmSidebar.setActiveMarket(this.activeMarket, false);
      window.SahmSidebar.setMarketStatus(this.marketStatus);
    }

    // 3. Load configuration from chrome storage
    this.loadConfig();

    // 4. Connect to Python Backend
    this.connectWebSocket();

    // 5. Hook SPA navigation & start 800ms location polling
    this.hookSPANavigation();
    this.startUrlPolling();

    // 6. Start DOM Mutation Observer
    this.startObserver();

    // 7. Start real-time background auto-refresh loop (every 1500ms)
    this.startLiveRefreshLoop();

    // 8. Initial inspection and scan
    setTimeout(() => {
      this.inspectAndScanPage(false);
    }, 1000);
  },

  /**
   * Detect Active Market (SA vs US) and Market Status (Open vs Closed)
   */
  detectMarketContext() {
    // 1. Primary: Direct badge from Sahm platform header
    const badgeEl = document.querySelector('.market-bar-market-info .market-name, .market-bar-market-info, .market-name');
    if (badgeEl) {
      const badgeText = badgeEl.textContent.trim().toUpperCase();
      if (badgeText.includes("US") || badgeText.includes("أمريكي")) {
        this.activeMarket = "US";
      } else if (badgeText.includes("SA") || badgeText.includes("سعودي")) {
        this.activeMarket = "SA";
      }
    } else if (window.SahmMarketParser) {
      this.activeMarket = window.SahmMarketParser.detectActiveMarket();
    }

    // 2. Check URL heuristics
    const url = window.location.href.toLowerCase();
    if (url.includes("code=spx") || url.includes("tab=options") || (window.SahmSPXParser && window.SahmSPXParser.isOptionsChainPage())) {
      this.activeMarket = "US";
    } else if (url.includes("/sa/") || (url.includes("/market") && this.activeMarket === "SA")) {
      this.activeMarket = "SA";
    }

    // 3. Market trading status (Open vs Closed vs Pre-Market vs Overnight)
    let statusText = null;
    if (window.SahmMarketParser) {
      const statusObj = window.SahmMarketParser.detectMarketStatus(this.activeMarket);
      this.marketStatus = statusObj.raw;
      statusText = statusObj.statusText;
    }

    if (window.SahmSidebar) {
      window.SahmSidebar.setActiveMarket(this.activeMarket, false);
      window.SahmSidebar.setMarketStatus(this.marketStatus, statusText);
    }
  },

  /**
   * Continuous 800ms location.href and market-badge polling for Vue SPA
   */
  startUrlPolling() {
    this.lastHref = window.location.href;
    this.lastMarketBadge = "";

    setInterval(() => {
      const currentHref = window.location.href;
      const currentBadge = document.querySelector('.market-bar-market-info .market-name, .market-bar-market-info')?.textContent.trim() || "";

      if (currentHref !== this.lastHref || currentBadge !== this.lastMarketBadge) {
        this.lastHref = currentHref;
        this.lastMarketBadge = currentBadge;
        console.log("[Sahm Copilot] 🔄 SPA Change detected (URL/Market):", currentHref, currentBadge);
        this.detectMarketContext();
        setTimeout(() => {
          this.inspectAndScanPage(false);
        }, 300);
      }
    }, 800);
  },

  /**
   * Real-Time Background Auto-Refresh Loop (1500ms)
   * Continually updates live prices across active tables and evaluates locked-in trade alerts
   */
  startLiveRefreshLoop() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
    this.refreshInterval = setInterval(() => {
      if (!this.isContextValid()) {
        this.handleContextInvalidated();
        return;
      }
      this.inspectAndScanPage(false);
      if (window.SahmSidebar && typeof window.SahmSidebar.checkProximityAlerts === "function") {
        window.SahmSidebar.checkProximityAlerts();
      }
    }, 1500);
  },

  /**
   * Listen to Single Page Application (SPA) route changes
   */
  hookSPANavigation() {
    const handleUrlChange = () => {
      console.log("[Sahm Copilot] 🔄 SPA Navigation detected to:", window.location.href);
      this.detectMarketContext();
      setTimeout(() => {
        this.inspectAndScanPage(false);
      }, 500);
    };

    window.addEventListener("popstate", handleUrlChange);

    const originalPushState = history.pushState;
    history.pushState = function (...args) {
      originalPushState.apply(this, args);
      handleUrlChange();
    };

    const originalReplaceState = history.replaceState;
    history.replaceState = function (...args) {
      originalReplaceState.apply(this, args);
      handleUrlChange();
    };
  },

  /**
   * Check if Chrome extension context is still active and valid.
   */
  isContextValid() {
    try {
      return Boolean(typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.id);
    } catch (e) {
      return false;
    }
  },

  safeSendRuntimeMessage(message, callback) {
    if (!this.isContextValid()) return;
    try {
      chrome.runtime.sendMessage(message, (res) => {
        const err = chrome.runtime?.lastError;
        if (typeof callback === "function") callback(res);
      });
    } catch (e) {}
  },

  handleContextInvalidated() {
    this.stopHeartbeat();
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
    }
    if (this.ws) {
      try { this.ws.close(); } catch (e) {}
    }
    if (window.SahmSidebar) {
      window.SahmSidebar.updateDiagnosticBadge(
        "⚠️ تم تحديث الإضافة: يرجى الضغط على F5 لتحديث الصفحة",
        "تحديث مطلوب"
      );
    }
  },

  loadConfig() {
    if (!this.isContextValid()) return;
    try {
      if (chrome?.storage?.local) {
        chrome.storage.local.get("copilot_settings", (data) => {
          if (data && data.copilot_settings?.backendWsUrl) {
            this.wsUrl = data.copilot_settings.backendWsUrl;
          }
        });
      }

      if (chrome?.runtime?.onMessage) {
        chrome.runtime.onMessage.addListener((msg) => {
          if (msg.type === "CONFIG_UPDATED" && msg.config?.backendWsUrl) {
            this.wsUrl = msg.config.backendWsUrl;
            this.reconnectWebSocket();
          } else if (msg.type === "TV_BRIDGE_STREAM" && msg.payload) {
            if (window.SahmSidebar && typeof window.SahmSidebar.handleTradingViewBridgeUpdate === "function") {
              window.SahmSidebar.handleTradingViewBridgeUpdate(msg.payload);
            }
          }
        });
      }
    } catch (e) {}
  },

  connectWebSocket() {
    if (!this.isContextValid()) return;

    try {
      console.log(`[Sahm Copilot] Connecting to WebSocket: ${this.wsUrl}`);
      this.ws = new WebSocket(this.wsUrl);

      this.ws.onopen = () => {
        console.log("[Sahm Copilot] ✅ WebSocket Connected successfully to Python Backend!");
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.notifyStatus(true);
        this.startHeartbeat();

        this.sendMessage({
          type: "HANDSHAKE",
          client: "SahmChromeExtension_V4",
          url: window.location.href,
          activeMarket: this.activeMarket,
          marketStatus: this.marketStatus,
          timestamp: Date.now()
        });

        this.inspectAndScanPage(false);
      };

      this.ws.onmessage = (event) => {
        try {
          if (!this.isContextValid()) {
            this.handleContextInvalidated();
            return;
          }
          const payload = JSON.parse(event.data);
          this.handleBackendMessage(payload);
        } catch (e) {
          if (String(e).includes("context invalidated")) {
            this.handleContextInvalidated();
          } else {
            console.debug("[Sahm Copilot] WebSocket message error:", e);
          }
        }
      };

      this.ws.onerror = (err) => {
        console.log("[Sahm Copilot] WebSocket status note:", err);
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.notifyStatus(false);
        this.stopHeartbeat();
        this.scheduleReconnect();
      };
    } catch (err) {
      console.log("[Sahm Copilot] Connection attempt note:", err);
      this.scheduleReconnect();
    }
  },

  scheduleReconnect() {
    if (!this.isContextValid()) return;
    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), this.maxReconnectDelay);
    setTimeout(() => {
      if (this.isContextValid()) {
        this.connectWebSocket();
      }
    }, delay);
  },

  reconnectWebSocket() {
    if (this.ws) {
      try { this.ws.close(); } catch (e) {}
    }
    this.connectWebSocket();
  },

  startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (!this.isContextValid()) {
        this.handleContextInvalidated();
        return;
      }
      if (this.isConnected && this.ws?.readyState === WebSocket.OPEN) {
        this.sendMessage({ type: "PING", timestamp: Date.now() });
      }
    }, 10000);
  },

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  },

  notifyStatus(connected, ping = 0) {
    try {
      if (window.SahmSidebar) {
        window.SahmSidebar.updateConnectionStatus(connected, ping);
      }
      this.safeSendRuntimeMessage({ type: "STATUS_UPDATE", connected: connected });
    } catch (e) {}
  },

  handleBackendMessage(payload) {
    if (payload.type === "PONG") {
      const ping = Date.now() - payload.timestamp;
      this.notifyStatus(true, ping);
      return;
    }

    if (payload.type === "ANALYSIS_UPDATE" || payload.type === "COPILOT_SIGNAL") {
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
        this.isConnected = true;
        this.notifyStatus(true);
      } catch (e) {
        wsSent = false;
      }
    }

    // Always fallback to background.js HTTP if WebSocket is not open or if data is DOM_UPDATE
    if (!wsSent || data.type === "DOM_UPDATE") {
      this.safeSendRuntimeMessage({
        type: "HTTP_ANALYZE",
        payload: data
      }, (response) => {
        if (response && response.success && response.data) {
          this.isConnected = true;
          this.notifyStatus(true, 10);
          this.handleBackendMessage(response.data);
        } else if (!wsSent) {
          this.isConnected = false;
          this.notifyStatus(false);
        }
      });
    }

    return wsSent;
  },

  /**
   * Switch Active Market from Sidebar UI
   */
  setMarket(marketCode) {
    this.activeMarket = marketCode;
    this.sendMessage({
      type: "SET_MARKET",
      market: marketCode,
      timestamp: Date.now()
    });
    this.inspectAndScanPage(true);
  },

  /**
   * Set Active Strategy Override
   */
  setStrategy(strategyCode) {
    this.activeStrategy = strategyCode;
    this.sendMessage({
      type: "SET_STRATEGY",
      strategy: strategyCode,
      timestamp: Date.now()
    });
  },

  /**
   * Setup smart MutationObserver with debouncing
   */
  startObserver() {
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
    }

    this.mutationObserver = new MutationObserver((mutations) => {
      let isRelevantChange = false;
      for (const mut of mutations) {
        if (mut.target && (mut.target.id === "sahm-copilot-root" || mut.target.closest?.("#sahm-copilot-root"))) {
          continue;
        }

        const targetNode = mut.target;
        const tag = targetNode.nodeName;
        const cls = targetNode.className ? String(targetNode.className) : "";

        if (
          tag === "TABLE" || tag === "TBODY" || tag === "TR" || tag === "TD" || tag === "TH" ||
          targetNode.getAttribute?.("role") === "row" ||
          targetNode.getAttribute?.("role") === "gridcell" ||
          cls.includes("row") || cls.includes("table") || cls.includes("cell") ||
          cls.includes("trade") || cls.includes("depth") || cls.includes("quote") ||
          cls.includes("option") || cls.includes("market")
        ) {
          isRelevantChange = true;
          break;
        }
      }

      if (isRelevantChange) {
        this.scheduleDebouncedScan();
      }
    });

    this.mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });
  },

  scheduleDebouncedScan() {
    if (this.scanDebounceTimer) {
      clearTimeout(this.scanDebounceTimer);
    }
    this.scanDebounceTimer = setTimeout(() => {
      this.inspectAndScanPage(false);
    }, 400);
  },

  scanAndDispatchNow() {
    this.inspectAndScanPage(true);
  },

  sendFullSnapshot() {
    this.inspectAndScanPage(true);
  },

  /**
   * Core Inspection & Page Scanner
   */
  inspectAndScanPage(isManual = false) {
    this.detectMarketContext();
    const url = window.location.href;

    const payload = {
      type: "DOM_UPDATE",
      url: url,
      timestamp: Date.now(),
      pageType: "UNKNOWN",
      activeMarket: this.activeMarket,
      marketStatus: this.marketStatus,
      activeStrategy: this.activeStrategy,
      data: null
    };

    // 1. Check: SPX Options Chain
    if (window.SahmSPXParser && window.SahmSPXParser.isOptionsChainPage()) {
      payload.pageType = "SPX_OPTIONS";
      payload.activeMarket = "US";
      this.activeMarket = "US";
      payload.data = window.SahmSPXParser.parseOptionsChain();
      this.activePageType = "SPX_OPTIONS";

      if (window.SahmSidebar) {
        if (window.SahmSidebar.tvBridgeData && window.SahmSidebar.tvBridgeData.isConnected && window.SahmSidebar.tvBridgeData.price > 0) {
          if (payload.data) {
            payload.data.indexPrice = window.SahmSidebar.tvBridgeData.price;
            payload.data.changePoints = window.SahmSidebar.tvBridgeData.changePts;
            payload.data.changePercent = window.SahmSidebar.tvBridgeData.changePct;
            payload.data.tvBridge = window.SahmSidebar.tvBridgeData;
          }
        }
        window.SahmSidebar.setActiveMarket("US", false);
        if (payload.data && payload.data.majorIndices) {
          if (!window.SahmSidebar.state.spxEngine) window.SahmSidebar.state.spxEngine = {};
          window.SahmSidebar.state.spxEngine.majorIndices = payload.data.majorIndices;
        }
        if (payload.data.marketStatusRaw) {
          this.marketStatus = payload.data.marketStatusRaw;
          window.SahmSidebar.setMarketStatus(payload.data.marketStatusRaw, payload.data.marketStatusText);
        }
        const count = payload.data.totalStrikesCaptured || (payload.data.calls.length + payload.data.puts.length);
        window.SahmSidebar.updateDiagnosticBadge(
          `✓ عقود SPX (تم مسح ${count} عقد بالسلسلة)`,
          "سلسلة عقود SPX (US)"
        );
      }
    }
    // 2. Check: Single Stock Detail (4D Analysis + Order Flow)
    else if (window.SahmStockParser && window.SahmStockParser.isStockDetailPage()) {
      payload.pageType = "STOCK_DETAIL";
      payload.data = window.SahmStockParser.getSnapshot();
      this.activePageType = "STOCK_DETAIL";

      const stock = payload.data.stock || {};
      const ts = payload.data.timeAndSales || {};
      const ob = payload.data.orderBook || {};
      const fund = payload.data.fundamentals || {};
      const news = payload.data.newsSentiment || {};

      // Determine stock market
      const isSaudi = /^\d{4}$/.test(stock.symbol);
      this.activeMarket = isSaudi ? "SA" : "US";
      payload.activeMarket = this.activeMarket;

      if (window.SahmSidebar) {
        window.SahmSidebar.setActiveMarket(this.activeMarket, false);

        // Update live order flow cache immediately
        window.SahmSidebar.state.orderFlow = {
          symbol: stock.symbol || "1120",
          buyRatio: ts.buyRatio !== undefined ? ts.buyRatio : 50,
          sellRatio: ts.sellRatio !== undefined ? ts.sellRatio : 50,
          netDelta: ts.netDelta || 0,
          sentiment: ts.orderFlowSentiment || "BALANCED",
          totalBuyVolume: ts.totalBuyVolume || 0,
          totalSellVolume: ts.totalSellVolume || 0,
          bidRatio: ob.bidRatio || 50,
          askRatio: ob.askRatio || 50
        };

        const tradesCount = ts.recentTrades ? ts.recentTrades.length : 0;
        window.SahmSidebar.updateDiagnosticBadge(
          `✓ تم التقاط السهم ${stock.symbol} ${stock.name} (${tradesCount} صفقة)`,
          `صفحة السهم (${this.activeMarket})`
        );
      }
    }
    // 3. Check: Market Overview / Watchlist Table
    else if (window.SahmMarketParser && window.SahmMarketParser.isMarketPage()) {
      payload.pageType = "MARKET_OVERVIEW";
      const parseResult = window.SahmMarketParser.parseMarketTable();
      payload.data = parseResult;
      this.activePageType = "MARKET_OVERVIEW";

      this.activeMarket = parseResult.activeMarket || this.activeMarket;
      payload.activeMarket = this.activeMarket;

      const count = parseResult.count || 0;
      if (window.SahmSidebar) {
        window.SahmSidebar.setActiveMarket(this.activeMarket, false);
        if (parseResult && parseResult.majorIndices) {
          if (!window.SahmSidebar.state.spxEngine) window.SahmSidebar.state.spxEngine = {};
          window.SahmSidebar.state.spxEngine.majorIndices = parseResult.majorIndices;
        }
        window.SahmSidebar.updateDiagnosticBadge(
          `✓ تم التقاط ${count} سهم من جدول السوق`,
          `جدول السوق (${this.activeMarket})`
        );
      }
    } else {
      if (isManual && window.SahmSidebar) {
        window.SahmSidebar.updateDiagnosticBadge("⚠️ لم يتم التعرف على جدول تداول في هذه الصفحة", "صفحة غير معروفة");
      }
    }

    // Transmit to Python backend
    if (payload.pageType !== "UNKNOWN" && payload.data) {
      const liveSample = payload.data?.stock?.lastPrice || payload.data?.indexPrice || payload.data?.topCalls?.[0]?.entry || payload.data?.rows?.[0]?.lastPrice || "";
      const hash = `${payload.pageType}_${this.activeMarket}_${JSON.stringify(payload.data).length}_${liveSample}`;
      if (hash !== this.lastDispatchedHash || isManual || Date.now() % 4000 < 1500) {
        this.lastDispatchedHash = hash;
        console.log(`[Sahm Copilot] 🚀 إرسال تحديث DOM (${payload.pageType} - ${this.activeMarket}) للخادم...`);
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
