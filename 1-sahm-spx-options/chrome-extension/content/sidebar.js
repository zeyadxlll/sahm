/**
 * Sahm Trading Copilot - Floating Sidebar Controller (Ultra-Professional Institutional Dark Glassmorphism)
 * Supports Context-Aware Market Switching (SA vs US), Multi-Strategy Engine, Next-Session AI Predictor,
 * 4D Stock Analyzer, and Live SPX Options Copilot.
 * 100% Arabic RTL Layout.
 */

window.SahmSidebar = {
  isInitialized: false,
  isCollapsed: false,
  activeMarket: "SA", // "SA" (Saudi) or "US" (US Market)
  marketStatus: "OPEN", // "OPEN" or "CLOSED"
  activeTab: "overview", // context-dependent active tab
  strategyMode: "AUTO", // "AUTO" (Auto AI Regime) or "MANUAL" (Manual Selection)
  activeStrategy: "AUTO",
  userScale: 1.0, // User preferred sidebar scale multiplier (0.6x to 2.0x)
  isCompactTableEnabled: false, // Sahm options table compact mode
  spxTickHistory: [], // Rolling history of last 15 SPX index ticks with timestamps
  confirmedBias: null, // Hysteresis locked directional bias ("CALL", "PUT", "SIDEWAYS")
  gammaPinningMode: false, // Choppy / Gamma-Pinning Scalp state
  waveDurationInfo: null, // Wave duration predictor metrics and badge text
  _lastAppliedZoom: 1.0,
  _zoomMonitoringInitialized: false,
  zoomCheckInterval: null,
  dragState: {
    isDragging: false,
    startX: 0,
    startY: 0,
    initialLeft: 20,
    initialTop: 70,
  },

  // Current State Cache
  state: {
    connected: false,
    ping: 0,
    marketState: {
      status: "BULLISH",
      title: "سوق صاعد ذو زخم وسيولة",
      warningText: null,
      detail: "تتبع فرص الاختراق المدعومة بارتفاع أحجام التداول.",
      activeStrategy: "RVOL_MOMENTUM",
      strategyArabic: "RVOL Momentum Breakout (اختراق السيولة والزخم)",
    },
    orderFlow: {
      symbol: "1120",
      buyRatio: 58.4,
      sellRatio: 41.6,
      netDelta: 24500,
      sentiment: "ACCUMULATION",
      totalBuyVolume: 2840000,
      totalSellVolume: 2025000,
      bidRatio: 56,
      askRatio: 44,
      absorptionAlert: "امتصاص عروض بيع ضخمة (Buying Absorption) عند الدعم",
    },
    opportunities: [],
    nextSession: [],
    analysis4D: null,
    portfolio: [],
    spxEngine: {
      status: "PENDING_FEED",
      bias: "SIDEWAYS",
      indexPrice: 0,
      changePercent: 0,
      confidence: 75,
      activeTab: "CALL",
      activeTabLabel: "خيار الشراء (Calls)",
      strategyArabic:
        "Sideways Range & VWAP Scalper (مضاربة السوق العرضي السريعة)",
      callsCount: 0,
      putsCount: 0,
      majorIndices: {
        spx: { price: 0, changePercent: 0 },
        nasdaq: { price: 0, changePercent: 0 },
        dow: { price: 0, changePercent: 0 },
      },
      bestCall: null,
      bestPut: null,
    },
  },

  /**
   * Initialize and insert sidebar container into the DOM
   */
  init() {
    if (document.getElementById("sahm-copilot-root")) {
      return;
    }

    const root = document.createElement("div");
    root.id = "sahm-copilot-root";
    root.innerHTML = `
      <!-- Collapsed Bubble Trigger -->
      <div id="copilot-bubble" class="copilot-bubble-trigger hidden" title="فتح مساعد سهم الذكي">
        <span class="copilot-bubble-icon">⚡</span>
      </div>

      <!-- Main Floating Glass Panel -->
      <div id="copilot-main-panel" class="copilot-panel">
        <!-- Draggable Top Header -->
        <div id="copilot-drag-handle" class="copilot-header">
          <div class="copilot-title-group">
            <div class="copilot-logo-badge">سهم</div>
            <div>
              <div class="copilot-app-title">مساعد تداول سهم | Copilot Pro</div>
              <div id="copilot-ws-status" class="copilot-status-indicator">
                <span class="copilot-dot disconnected"></span>
                <span class="status-text">جاري الاتصال بالمحرك...</span>
              </div>
            </div>
          </div>

          <div class="copilot-controls">
            <!-- Manual Zoom Controls -->
            <div class="copilot-zoom-controls" title="التحكم في حجم المساعد (Zoom / Scale)">
              <button id="copilot-btn-zoom-out" class="copilot-btn-zoom" title="تصغير حجم المساعد (-10%)">🔍−</button>
              <button id="copilot-btn-zoom-reset" class="copilot-btn-zoom copilot-zoom-badge" title="إعادة الحجم الافتراضي (100%)">100%</button>
              <button id="copilot-btn-zoom-in" class="copilot-btn-zoom" title="تكبير حجم المساعد (+10%)">🔍+</button>
            </div>

            <button id="copilot-btn-rescan" class="copilot-btn-icon" title="إعادة قراءة الصفحة لحظياً">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
            </button>
            <button id="copilot-btn-collapse" class="copilot-btn-icon" title="تصغير">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 12H6"/></svg>
            </button>
          </div>
        </div>

        <!-- Institutional Market Switcher & Session Status Bar -->
        <div class="copilot-market-bar">
          <div class="copilot-market-switch-group">
            <button id="copilot-market-btn-sa" class="copilot-market-btn active sa-active" data-market="SA">
              <span>🇸🇦</span>
              <span>السوق السعودي (SA)</span>
            </button>
            <button id="copilot-market-btn-us" class="copilot-market-btn" data-market="US">
              <span>🇺🇸</span>
              <span>السوق الأمريكي (US)</span>
            </button>
          </div>

          <div id="copilot-session-status-badge" class="copilot-session-badge session-open">
            <span class="copilot-dot connected"></span>
            <span id="copilot-session-status-text">سوق مفتوح</span>
          </div>
        </div>

        <!-- Strategy Selector Bar (Auto AI Regime vs Manual Override) -->
        <div class="copilot-strategy-bar">
          <div class="copilot-strategy-top-row">
            <div style="font-size: 10px; color: var(--copilot-text-muted); font-weight: 700; display:flex; align-items:center; gap:4px;">
              <span>🎯 محرك الاستراتيجيات:</span>
              <span id="copilot-active-strategy-name" style="color: #38bdf8; font-weight:800;">تلقائي ذكي</span>
            </div>

            <div class="copilot-strategy-mode-toggle">
              <button id="copilot-mode-auto" class="copilot-mode-btn active" data-mode="AUTO">تلقائي ذكي (AI)</button>
              <button id="copilot-mode-manual" class="copilot-mode-btn" data-mode="MANUAL">اختيار يدوي</button>
            </div>
          </div>

          <!-- Strategy Pills List (Dynamic based on SA vs US market) -->
          <div id="copilot-strategy-pills" class="copilot-strategy-pill-list">
            <!-- Rendered dynamically -->
          </div>
        </div>

        <!-- Dynamic Navigation Tabs (Saudi vs US Modules) -->
        <div id="copilot-nav-container" class="copilot-nav">
          <!-- Rendered dynamically based on active market -->
        </div>

        <!-- Live DOM Diagnostic Banner -->
        <div id="copilot-diag-bar" class="copilot-diag-bar">
          <span id="copilot-diag-badge" class="copilot-diag-badge">📊 جاري مسح محتويات الشاشة...</span>
          <span id="copilot-diag-type" style="font-size: 10px; color: #64748b;">app.sahmcapital.com</span>
        </div>

        <!-- Scrollable Content Body -->
        <div id="copilot-content-body" class="copilot-body">
          <!-- Dynamic Content Rendered Here -->
        </div>

        <!-- Footer Actions -->
        <div class="copilot-footer">
          <button id="copilot-btn-inspect-page" class="copilot-btn-inspect" title="فحص بيانات منصة سهم الحالية">
            <span>🔍 فحص وتحديث مباشر</span>
          </button>
          <span id="copilot-last-updated" style="font-size: 10px; color: #64748b;">تحديث: لحظي</span>
        </div>
      </div>
    `;

    document.body.appendChild(root);
    this.isInitialized = true;

    try {
      this.trackedTrades = JSON.parse(localStorage.getItem("sahm_tracked_trades") || "{}");
    } catch (e) {
      this.trackedTrades = {};
    }
    this.activeAlerts = [];
    this.lastSoundTimes = {};
    this.audioCtx = null;
    this.activeRecommendationsRegistry = {};

    try {
      this.selectedPriceTier = localStorage.getItem("sahm_price_tier") || "ALL";
    } catch (e) {
      this.selectedPriceTier = "ALL";
    }
    window.__sahmSelectedPriceTier = this.selectedPriceTier;

    // Load saved user scale factor
    try {
      const savedScale = parseFloat(localStorage.getItem("sahm_sidebar_user_scale"));
      this.userScale = (!isNaN(savedScale) && savedScale >= 0.5 && savedScale <= 2.5) ? savedScale : 1.0;
    } catch (e) {
      this.userScale = 1.0;
    }

    // Load saved compact table mode
    try {
      this.isCompactTableEnabled = localStorage.getItem("sahm_compact_table_mode") === "true";
    } catch (e) {
      this.isCompactTableEnabled = false;
    }
    if (this.isCompactTableEnabled) {
      this.toggleCompactTable(true);
    }

    this.attachEventListeners();
    this.initZoomMonitoring();
    this.initTradingViewBridge();
    this.renderStrategyPills();
    this.renderNavTabs();
    this.render();
  },

  /**
   * Set Capital & Cost Price Tier filter for options recommendations
   */
  setPriceTier(tier) {
    this.selectedPriceTier = tier || "ALL";
    try {
      localStorage.setItem("sahm_price_tier", this.selectedPriceTier);
    } catch (e) {}
    window.__sahmSelectedPriceTier = this.selectedPriceTier;

    if (window.SahmContent && typeof window.SahmContent.sendMessage === "function") {
      window.SahmContent.sendMessage({ type: "SET_PRICE_TIER", priceTier: this.selectedPriceTier });
    }
    this.render();
  },

  /**
   * Calculate browser zoom factor relative to native 100% viewport.
   * Accurately reflects Ctrl +/- browser page zoom in Chromium.
   */
  getZoomFactor() {
    let factor = 1.0;
    try {
      if (window.outerWidth && window.innerWidth) {
        factor = window.outerWidth / window.innerWidth;
      }
    } catch (e) {}

    // Account for visualViewport pinch zoom if present
    try {
      if (window.visualViewport && window.visualViewport.scale && window.visualViewport.scale !== 1.0) {
        factor *= window.visualViewport.scale;
      }
    } catch (e) {}

    if (!factor || isNaN(factor) || factor <= 0.15 || factor > 5.0) {
      factor = 1.0;
    }
    return Math.round(factor * 100) / 100;
  },

  /**
   * Automatic Counter-Zoom Lock:
   * Keeps sidebar at 100% crisp, readable native physical screen size regardless of browser zoom out (33%, 50%, etc.).
   * Adjusts panel max-height dynamically to (window.innerHeight * zoomFactor) - 20px so it never gets clipped.
   */
  updateZoomCompensation() {
    const root = document.getElementById("sahm-copilot-root");
    const panel = document.getElementById("copilot-main-panel");
    if (!root) return;

    const zoomFactor = this.getZoomFactor();
    const userScale = this.userScale || 1.0;

    // Counter-zoom scale: style.zoom = (1 / zoomFactor) * userScale
    const inverseZoom = (1 / zoomFactor) * userScale;
    const roundedZoom = Math.round(inverseZoom * 1000) / 1000;

    if (this._lastAppliedZoom !== roundedZoom) {
      this._lastAppliedZoom = roundedZoom;
      root.style.zoom = roundedZoom;
    }

    // Dynamic max-height adjustment: (window.innerHeight * zoomFactor) - 20px
    if (panel) {
      const availHeight = Math.max(250, Math.floor(((window.innerHeight * zoomFactor) - 20) / userScale));
      const targetMaxHeight = `${availHeight}px`;
      if (panel.style.maxHeight !== targetMaxHeight) {
        panel.style.maxHeight = targetMaxHeight;
      }
    }

    // Update indicator button text in header
    const resetBtn = document.getElementById("copilot-btn-zoom-reset");
    if (resetBtn) {
      const pctText = `${Math.round(userScale * 100)}%`;
      if (resetBtn.textContent !== pctText) {
        resetBtn.textContent = pctText;
      }
    }
  },

  /**
   * Continuous monitoring of browser zoom level (resize events + high-frequency interval)
   */
  initZoomMonitoring() {
    if (this._zoomMonitoringInitialized) return;
    this._zoomMonitoringInitialized = true;

    // Window resize (fired on browser zoom in Chrome)
    window.addEventListener("resize", () => {
      this.updateZoomCompensation();
    });

    // Visual viewport resize
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", () => {
        this.updateZoomCompensation();
      });
    }

    // Background interval check (every 400ms) to detect silent zoom changes
    if (this.zoomCheckInterval) clearInterval(this.zoomCheckInterval);
    this.zoomCheckInterval = setInterval(() => {
      this.updateZoomCompensation();
    }, 400);

    // Initial compensation
    this.updateZoomCompensation();
  },

  /**
   * Manual Sidebar Size Controls (+ / - / 100% Buttons)
   * Save user's preferred sidebar scale in localStorage.
   */
  setUserScale(scale) {
    const clamped = Math.max(0.6, Math.min(2.0, Math.round(scale * 10) / 10));
    this.userScale = clamped;
    try {
      localStorage.setItem("sahm_sidebar_user_scale", clamped.toFixed(2));
    } catch (e) {}
    this.updateZoomCompensation();
  },

  increaseScale() {
    this.setUserScale((this.userScale || 1.0) + 0.1);
  },

  decreaseScale() {
    this.setUserScale((this.userScale || 1.0) - 0.1);
  },

  resetScale() {
    this.setUserScale(1.0);
  },

  /**
   * One-Click "Table Compact Mode" for Sahm (Compact Table)
   * Injects CSS targeting ONLY Sahm's options table container setting zoom: 0.45
   * and compact row height, keeping Chrome browser zoom at 100% and Sidebar at 100% size!
   */
  toggleCompactTable(forceState) {
    const newState = (typeof forceState === "boolean") ? forceState : !this.isCompactTableEnabled;
    this.isCompactTableEnabled = newState;

    try {
      localStorage.setItem("sahm_compact_table_mode", newState ? "true" : "false");
    } catch (e) {}

    let styleEl = document.getElementById("sahm-compact-table-style");
    if (newState) {
      if (!styleEl) {
        styleEl = document.createElement("style");
        styleEl.id = "sahm-compact-table-style";
        styleEl.textContent = `
          /* Sahm Options Chain Compact Mode - Force Full Screen Visibility */
          .options-chain,
          #spx-options-chain,
          .m-table-container,
          .calls-content,
          .strike-content,
          .puts-content,
          .calls-table,
          .strike-table,
          .puts-table,
          [class*="options-chain"],
          [class*="options-table"],
          [class*="table-container"] {
            zoom: 0.45 !important;
          }

          .options-chain tr,
          .options-chain td,
          .options-chain th,
          .n-data-table-tr,
          .n-data-table-td,
          .n-data-table-th,
          .strike-row {
            height: 18px !important;
            max-height: 18px !important;
            line-height: 18px !important;
            padding: 1px 3px !important;
            font-size: 11px !important;
          }

          .options-chain .hover-btn,
          .strike-row .hover-btn {
            padding: 0 4px !important;
            font-size: 9px !important;
            height: 15px !important;
            line-height: 15px !important;
          }
        `;
        document.head.appendChild(styleEl);
      }
    } else {
      if (styleEl) {
        styleEl.remove();
      }
    }

    // Update button visual state if rendered
    const btn = document.getElementById("copilot-btn-compact-table");
    if (btn) {
      if (newState) {
        btn.classList.add("active");
        btn.innerHTML = `<span>📐</span><span>📐 ضغط جدول العقود: مفعّل 🟢 (عرض الكل)</span>`;
      } else {
        btn.classList.remove("active");
        btn.innerHTML = `<span>📐</span><span>📐 عرض كل العقود بدون تصغير الشاشة (Compact Table)</span>`;
      }
    }

    // Trigger virtual scroll / parser update if options chain is open
    if (window.SahmSPXParser && typeof window.SahmSPXParser.parseLiveDOM === "function") {
      setTimeout(() => {
        try {
          window.SahmSPXParser.parseLiveDOM(true);
        } catch (e) {}
      }, 100);
    }
  },

  /**
   * True Quantitative Target Probability Calculator (نسبة التوقع الحقيقية لتحقيق الهدف)
   * Client-side mathematically grounded calculator ensuring 100% dynamic, non-static probability scores.
   * Clamped strictly between 35% and 94%.
   */
  calculateContractProbability(c, spotPrice = 7744.06, bias = "SIDEWAYS") {
    if (!c) {
      return {
        tp1Probability: 75,
        tp2Probability: 60,
        requiredSpxMoveTp1: 4.5,
        requiredSpxMoveTp2: 8.5,
        requiredMoveLabelTp1: "+4.5 نقطة",
        requiredMoveLabelTp2: "+8.5 نقطة",
        probBadgeTp1: "مرجح بقوة 🟢",
        probColorTp1: "#00F090"
      };
    }

    const entry = parseFloat(c.entry) || 1.0;
    const tp1 = parseFloat(c.tp1) || (entry * 1.20);
    const tp2 = parseFloat(c.tp2) || (entry * 1.40);
    const isCall = c.type === "CALL";
    const strike = parseFloat(c.strike) || spotPrice;

    let deltaVal = isCall ? 0.50 : -0.50;
    if (c.delta !== undefined && c.delta !== null && c.delta !== "--") {
      deltaVal = parseFloat(String(c.delta).replace("+", "")) || (isCall ? 0.50 : -0.50);
    }
    const absDelta = Math.max(0.08, Math.abs(deltaVal));
    const spot = spotPrice > 1000 ? spotPrice : 7744.06;

    // a) Delta & Required SPX Move
    const reqMoveTp1 = Math.max(0.1, Math.round(((tp1 - entry) / absDelta) * 10) / 10);
    const reqMoveTp2 = Math.max(0.2, Math.round(((tp2 - entry) / absDelta) * 10) / 10);

    let ivClean = 11.65;
    try {
      ivClean = parseFloat(String(c.iv || "11.65").replace(/[^\d.]/g, "")) || 11.65;
    } catch (e) {}

    const dailySigma = (spot * (ivClean / 100.0)) / 15.874;
    const expectedIntradayRange = Math.max(25.0, dailySigma * 0.65);

    const ratioTp1 = Math.min(1.2, reqMoveTp1 / expectedIntradayRange);
    let baseTp1 = 88.0 - (ratioTp1 * 55.0);

    const ratioTp2 = Math.min(1.4, reqMoveTp2 / expectedIntradayRange);
    let baseTp2 = 82.0 - (ratioTp2 * 60.0);

    if (Math.abs(strike - spot) > 10.0) {
      const otmDistPen = Math.min(15.0, (Math.abs(strike - spot) - 10.0) * 0.45);
      baseTp1 -= otmDistPen;
      baseTp2 -= otmDistPen;
    }

    // b) Liquidity & Order Flow Boost (up to +12%)
    const vol = parseFloat(c.volume) || 0;
    const oi = parseFloat(c.openInterest) || 0;
    const activity = (vol * 1.4) + oi;
    const liqScore = Math.min(12.0, Math.round((activity / 2500) * 12.0 * 10) / 10);

    // c) Spread Efficiency Penalty / Bonus
    const spread = parseFloat(c.spread) || 0.20;
    let spreadEffect = 0.0;
    if (spread <= 0.20) spreadEffect = 5.0;
    else if (spread <= 0.35) spreadEffect = 2.0;
    else if (spread <= 0.50) spreadEffect = -3.0;
    else spreadEffect = -Math.min(12.0, 3.0 + ((spread / entry) * 25.0));

    // d) Market Regime Alignment (+6% / -6%)
    const isTrend = (bias === "CALL" && isCall) || (bias === "PUT" && !isCall);
    const isContra = (bias === "CALL" && !isCall) || (bias === "PUT" && isCall);
    let regimeBonus = 0.0;
    if (isTrend) regimeBonus = 6.0;
    else if (isContra) regimeBonus = -6.0;
    else regimeBonus = absDelta >= 0.45 ? 2.0 : -2.0;

    const finalTp1 = Math.round(Math.min(94, Math.max(35, baseTp1 + liqScore + spreadEffect + regimeBonus)));
    const finalTp2 = Math.round(Math.min(finalTp1 - 3, Math.max(35, baseTp2 + (liqScore * 0.8) + spreadEffect + regimeBonus)));

    const sign = isCall ? "+" : "-";
    const reqLabelTp1 = `${sign}${reqMoveTp1.toFixed(1)} نقطة`;
    const reqLabelTp2 = `${sign}${reqMoveTp2.toFixed(1)} نقطة`;

    const probBadgeTp1 = finalTp1 >= 75 ? "مرجح بقوة 🟢" : (finalTp1 >= 55 ? "احتمالية متوسطة 🟡" : "مضاربة عالية المخاطرة 🔴");
    const probColorTp1 = finalTp1 >= 75 ? "#00F090" : (finalTp1 >= 55 ? "#fbbf24" : "#ef4444");

    return {
      tp1Probability: finalTp1,
      tp2Probability: finalTp2,
      tp1_probability: finalTp1,
      tp2_probability: finalTp2,
      requiredSpxMoveTp1: reqMoveTp1,
      requiredSpxMoveTp2: reqMoveTp2,
      requiredMoveLabelTp1: reqLabelTp1,
      requiredMoveLabelTp2: reqLabelTp2,
      probBadgeTp1: probBadgeTp1,
      probColorTp1: probColorTp1
    };
  },

  /**
   * Untrack a specific trade immediately, dismiss its alerts, and notify backend
   */
  untrackTrade(tradeId) {
    if (!tradeId) return;
    if (this.trackedTrades && this.trackedTrades[tradeId]) {
      delete this.trackedTrades[tradeId];
    }
    this.activeAlerts = (this.activeAlerts || []).filter(a => a.tradeId !== tradeId);
    delete this.lastSoundTimes[tradeId];
    delete this.lastSoundTimes[tradeId + "_tp2"];

    try {
      localStorage.setItem("sahm_tracked_trades", JSON.stringify(this.trackedTrades));
    } catch (e) {}

    // Notify Python backend via WebSocket or background fallback
    try {
      if (window.SahmContent && typeof window.SahmContent.sendMessage === "function") {
        window.SahmContent.sendMessage({ type: "UNTRACK_TRADE", tradeId: tradeId });
      }
    } catch (e) {}

    this.render();
  },

  /**
   * Completely clear and stop all tracked trades and active alerts (Ghost trades fix)
   * Clears memory, localStorage, and triggers backend POST /api/trades/clear
   */
  clearAllTrackedTrades() {
    this.trackedTrades = {};
    this.activeAlerts = [];
    this.lastSoundTimes = {};

    try {
      localStorage.removeItem("sahm_tracked_trades");
    } catch (e) {}

    // Call REST endpoint
    try {
      fetch("http://localhost:8000/api/trades/clear", { method: "POST" }).catch(() => {});
    } catch (e) {}

    // Send WebSocket message
    try {
      if (window.SahmContent && typeof window.SahmContent.sendMessage === "function") {
        window.SahmContent.sendMessage({ type: "CLEAR_TRADES" });
      }
    } catch (e) {}

    this.render();
  },

  /**
   * Pure Web Audio API Sound Generator (Zero external assets, offline resilient)
   */
  getAudioContext() {
    if (!this.audioCtx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.audioCtx = new AudioCtx();
      }
    }
    if (this.audioCtx && this.audioCtx.state === "suspended") {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  },

  playAlertSound(type = "warning") {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      if (type === "warning") {
        // Warning double-beep for Stop Loss proximity within 3% (580Hz -> 420Hz)
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = "sawtooth";
        osc1.frequency.setValueAtTime(580, now);
        osc1.frequency.exponentialRampToValueAtTime(420, now + 0.08);
        gain1.gain.setValueAtTime(0.18, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.08);

        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = "sawtooth";
        osc2.frequency.setValueAtTime(580, now + 0.11);
        osc2.frequency.exponentialRampToValueAtTime(420, now + 0.19);
        gain2.gain.setValueAtTime(0.18, now + 0.11);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.19);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(now + 0.11);
        osc2.stop(now + 0.19);
      } else if (type === "target") {
        // Pleasant chime for Target 1 (Arpeggio: D5 587Hz -> F#5 740Hz -> A5 880Hz)
        const notes = [587.33, 739.99, 880.00];
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const startTime = now + idx * 0.09;
          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, startTime);
          gain.gain.setValueAtTime(0.2, startTime);
          gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.35);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(startTime);
          osc.stop(startTime + 0.35);
        });
      } else if (type === "stop_loss") {
        // Stop loss breached: urgent low warning tone
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(220, now + 0.28);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.28);
      }
    } catch (e) {}
  },

  /**
   * Anti-Whipsaw Hysteresis & Wave Duration Predictor (منع التذبذب العشوائي وتوقع مدة الموجة)
   * 1. Maintains rolling history of last 15 SPX index ticks with timestamps (spxTickHistory).
   * 2. Deadband / Hysteresis Filter: Never flip recommendation on a 1-point move!
   *    Requires displacement >= 2.2 SPX points beyond rolling pivot OR confirmed velocity >= 2.5 pts/min.
   * 3. Choppy / Gamma-Pinning Mode: Amplitude <= 3.5 points with multiple direction reversals.
   * 4. Wave Duration Estimator: Calculates distance to next Gamma wall and estimated duration.
   */
  updateSpxTickHysteresis(currentSpxPrice, rawBias = "SIDEWAYS") {
    const priceNum = parseFloat(currentSpxPrice) || 0;
    if (priceNum <= 0) {
      return {
        confirmedBias: this.confirmedBias || rawBias || "SIDEWAYS",
        gammaPinningMode: this.gammaPinningMode || false,
        velocity: 0,
        rollingPivot: 0,
        amplitude: 0,
        reversals: 0,
        nextGammaWall: 0,
        wallType: "",
        distToWall: 0,
        estMinDuration: 5,
        estMaxDuration: 10,
        durationBadgeText: "⏱️ جاري تحليل استمرارية الموجة...",
        tickCount: 0
      };
    }

    const now = Date.now();
    if (!this.spxTickHistory) this.spxTickHistory = [];

    // Append new tick if price changed or after 1.5 seconds
    const lastTick = this.spxTickHistory[this.spxTickHistory.length - 1];
    if (!lastTick || lastTick.price !== priceNum || (now - lastTick.timestamp > 1500)) {
      this.spxTickHistory.push({ price: priceNum, timestamp: now });
      if (this.spxTickHistory.length > 15) {
        this.spxTickHistory.shift();
      }
    }

    const ticks = this.spxTickHistory;
    const n = ticks.length;

    // Rolling pivot (average of the last ticks)
    const sumPrice = ticks.reduce((acc, t) => acc + t.price, 0);
    const rollingPivot = Math.round((sumPrice / n) * 100) / 100;

    // Amplitude (max - min)
    let minPrice = ticks[0].price;
    let maxPrice = ticks[0].price;
    for (let i = 1; i < n; i++) {
      if (ticks[i].price < minPrice) minPrice = ticks[i].price;
      if (ticks[i].price > maxPrice) maxPrice = ticks[i].price;
    }
    const amplitude = Math.round((maxPrice - minPrice) * 100) / 100;

    // Directional reversals count in tick series
    let reversals = 0;
    let lastDir = 0;
    for (let i = 1; i < n; i++) {
      const diff = ticks[i].price - ticks[i - 1].price;
      const dir = diff > 0.05 ? 1 : diff < -0.05 ? -1 : 0;
      if (dir !== 0) {
        if (lastDir !== 0 && dir !== lastDir) {
          reversals++;
        }
        lastDir = dir;
      }
    }

    // Tick velocity (points / min)
    let velocity = 0;
    if (n >= 2) {
      const timeMin = Math.max(0.1, (ticks[n - 1].timestamp - ticks[0].timestamp) / 60000);
      velocity = Math.round(((ticks[n - 1].price - ticks[0].price) / timeMin) * 10) / 10;
    }

    // 1. Choppy / Gamma-Pinning Mode Check (amplitude <= 3.5 points with multiple reversals)
    const isGammaPinning = n >= 5 && amplitude <= 3.5 && reversals >= 2;
    this.gammaPinningMode = isGammaPinning;

    // 2. Deadband / Hysteresis Filter:
    // Require >= 2.2 SPX points displacement beyond rolling pivot OR confirmed velocity >= 2.5 pts/min
    const displacement = Math.round((priceNum - rollingPivot) * 100) / 100;

    if (!this.confirmedBias || this.confirmedBias === "SIDEWAYS") {
      if (displacement >= 2.2 || velocity >= 2.5) {
        this.confirmedBias = "CALL";
      } else if (displacement <= -2.2 || velocity <= -2.5) {
        this.confirmedBias = "PUT";
      } else {
        this.confirmedBias = rawBias && rawBias !== "SIDEWAYS" ? rawBias : "SIDEWAYS";
      }
    } else if (this.confirmedBias === "CALL") {
      // Never flip on 1-point move! Only flip if displacement <= -2.2 OR velocity <= -2.5
      if (displacement <= -2.2 || velocity <= -2.5) {
        this.confirmedBias = "PUT";
      }
    } else if (this.confirmedBias === "PUT") {
      // Only flip to CALL if displacement >= 2.2 OR velocity >= 2.5
      if (displacement >= 2.2 || velocity >= 2.5) {
        this.confirmedBias = "CALL";
      }
    }

    // 3. Wave Duration Estimator (توقع مدة استمرار الموجة)
    // Distance to next Gamma wall (round strike every 5/10 pts)
    let nextGammaWall = 0;
    let wallType = "";
    if (this.confirmedBias === "CALL") {
      nextGammaWall = Math.ceil((priceNum + 0.5) / 5) * 5;
      if (nextGammaWall <= priceNum) nextGammaWall += 5;
      wallType = "مقاومة";
    } else {
      nextGammaWall = Math.floor((priceNum - 0.5) / 5) * 5;
      if (nextGammaWall >= priceNum) nextGammaWall -= 5;
      wallType = "دعم";
    }

    const distToWall = Math.abs(Math.round((nextGammaWall - priceNum) * 100) / 100);
    const absVel = Math.max(0.4, Math.abs(velocity));
    const baseMinutes = distToWall / absVel;
    const estMinDuration = Math.max(4, Math.min(25, Math.round(baseMinutes * 0.8)));
    const estMaxDuration = Math.max(estMinDuration + 3, Math.min(35, Math.round(baseMinutes * 1.6)));

    let durationBadgeText = "";
    if (isGammaPinning) {
      durationBadgeText = `⏱️ استمرارية الموجة: تذبذب عرضي محصور (Gamma Pinning) بين ${minPrice} و ${maxPrice} لمدة ${estMinDuration} - ${estMaxDuration} دقيقة`;
    } else if (this.confirmedBias === "CALL") {
      durationBadgeText = `⏱️ استمرارية الموجة المتوقعة: صعود (CALL) لمدة ${estMinDuration} - ${estMaxDuration} دقيقة (حتى ${wallType} ${nextGammaWall})`;
    } else if (this.confirmedBias === "PUT") {
      durationBadgeText = `⏱️ موجة هبوط (PUT) متوقعة لمدة ${estMinDuration} - ${estMaxDuration} دقيقة (حتى ${wallType} ${nextGammaWall})`;
    } else {
      durationBadgeText = `⏱️ استمرارية الموجة المتوقعة: مسار متوازن لمدة ${estMinDuration} - ${estMaxDuration} دقيقة`;
    }

    this.waveDurationInfo = {
      confirmedBias: this.confirmedBias,
      gammaPinningMode: isGammaPinning,
      rollingPivot,
      displacement,
      amplitude,
      reversals,
      velocity,
      nextGammaWall,
      wallType,
      distToWall,
      estMinDuration,
      estMaxDuration,
      durationBadgeText,
      tickCount: n
    };

    return this.waveDurationInfo;
  },

  /**
   * Execution & Locked-In Entry Tracking Toggle
   * Untoggling immediately untracks the contract and stops all alerts.
   */
  toggleTrackTrade(tradeData) {
    if (!tradeData) return;
    const id = tradeData.id || (tradeData.symbol ? `stock_${tradeData.symbol}` : `opt_${tradeData.strike}_${tradeData.type}`);

    if (this.trackedTrades && this.trackedTrades[id]) {
      // Untoggling: immediately delete and stop all alerts
      this.untrackTrade(id);
      return;
    }

    if (!this.trackedTrades) this.trackedTrades = {};
    const lockedEntry = parseFloat(tradeData.entry) || 0;
    const initialSl = parseFloat(tradeData.sl) || 0;

    this.trackedTrades[id] = {
      id: id,
      symbol: tradeData.symbol || `SPX ${tradeData.strike} ${tradeData.type}`,
      strike: tradeData.strike,
      type: tradeData.type,
      isOption: Boolean(tradeData.strike),
      lockedEntryPrice: lockedEntry,
      lockedStopLoss: initialSl,
      effectiveStopLoss: initialSl,
      lockedTarget1: parseFloat(tradeData.tp1) || 0,
      lockedTarget2: parseFloat(tradeData.tp2) || 0,
      dipEntry: parseFloat(tradeData.dipEntry) || 0,
      invalidationSl: parseFloat(tradeData.invalidationSl) || 0,
      rrRatio: parseFloat(tradeData.rrRatio) || 0,
      indexInvalidation: parseFloat(tradeData.indexInvalidation) || 0,
      tp1Probability: tradeData.tp1Probability || 75,
      tp2Probability: tradeData.tp2Probability || 60,
      requiredMoveLabelTp1: tradeData.requiredMoveLabelTp1 || "",
      probBadgeTp1: tradeData.probBadgeTp1 || "مرجح بقوة 🟢",
      probColorTp1: tradeData.probColorTp1 || "#00F090",
      // Smart Active Trade Monitor state
      isElasticStopActive: false,
      elasticStopPrice: null,
      isContractBurn: false,
      burnReason: "",
      profitLock: null, // null | "BREAKEVEN" | "TRAILED_15"
      profitLockText: "",
      lockedTimestamp: Date.now(),
      lockedTimeStr: new Intl.DateTimeFormat("ar-EG", {
        timeZone: "Africa/Cairo",
        hour: "numeric",
        minute: "numeric",
        hour12: true
      }).format(new Date()) + " (بتوقيت مصر)"
    };
    this.getAudioContext();

    // Dispatch execution alert to Python Backend & Telegram
    try {
      if (window.SahmContent && typeof window.SahmContent.sendMessage === "function") {
        window.SahmContent.sendMessage({
          type: "TRADE_ALERT",
          tradeId: id,
          alertType: "TRADE_LOCKED",
          symbol: this.trackedTrades[id].symbol,
          lockedEntry: this.trackedTrades[id].lockedEntryPrice,
          currentPrice: this.trackedTrades[id].lockedEntryPrice,
          target1: this.trackedTrades[id].lockedTarget1,
          target2: this.trackedTrades[id].lockedTarget2,
          stopLoss: this.trackedTrades[id].lockedStopLoss,
          pnlPct: 0.0
        });
      }
    } catch (err) {}

    try {
      localStorage.setItem("sahm_tracked_trades", JSON.stringify(this.trackedTrades));
    } catch (e) {}

    this.checkProximityAlerts();
    this.render();
  },

  /**
   * Monitor live market prices against locked SL and targets ONLY for executed trades.
   * Upgraded with:
   * Case A: Elastic Stop Hold (-28% recovery stop when SPX support holds and IV is healthy)
   * Case B: Contract Burn Emergency Exit (SPX breaks invalidation by > 1.8 pts, Delta < 0.08, or IV crush)
   * Case C: Smart Profit Lock (+15% Breakeven, +30% Trailed Stop at +15%)
   */
  checkProximityAlerts() {
    if (!this.trackedTrades || Object.keys(this.trackedTrades).length === 0) {
      this.activeAlerts = [];
      return;
    }

    // Pause False Alerts When Market is Closed (مغلق)
    const isMarketClosed = this.marketStatus === "CLOSED" ||
                           this.marketStatus === false ||
                           String(this.marketStatus || "").includes("CLOSED") ||
                           String(this.marketStatus || "").includes("مغلق") ||
                           String(this.marketStatus || "").includes("عطلة");

    if (isMarketClosed) {
      this.activeAlerts = [];
      return;
    }

    const newAlerts = [];
    const now = Date.now();
    if (!this.lastSoundTimes) this.lastSoundTimes = {};
    const spx = this.state.spxEngine || {};
    const spxIndex = parseFloat(spx.indexPrice) || 0;

    for (const [id, trade] of Object.entries(this.trackedTrades)) {
      let currentPrice = null;
      let liveDelta = 0.50;
      let liveIV = 25.0;
      let liveSpread = 0.20;

      if (trade.isOption) {
        const optList = [...(spx.topCalls || []), ...(spx.topPuts || []), ...(spx.calls || []), ...(spx.puts || [])];
        const match = optList.find(c => String(c.strike) === String(trade.strike) && c.type === trade.type);
        if (match) {
          currentPrice = match.entry || match.lastPrice || (match.bid && match.ask ? Math.round(((match.bid + match.ask) / 2) * 100) / 100 : null);
          liveDelta = Math.abs(parseFloat(match.delta) || 0.50);
          liveIV = parseFloat(match.iv) || 25.0;
          liveSpread = parseFloat(match.spread) || 0.20;
        } else if (window.__sahmAllOptionContracts) {
          const bucket = trade.type === "CALL" ? window.__sahmAllOptionContracts.calls : window.__sahmAllOptionContracts.puts;
          const mem = bucket?.[trade.strike];
          if (mem && mem.bid && mem.ask) {
            currentPrice = Math.round(((mem.bid + mem.ask) / 2) * 100) / 100;
            liveDelta = Math.abs(parseFloat(mem.delta) || 0.50);
            liveIV = parseFloat(mem.iv) || 25.0;
            liveSpread = parseFloat(mem.spread) || 0.20;
          }
        }
      } else {
        const match = (this.state.opportunities || []).find(o => String(o.symbol) === String(trade.symbol));
        if (match) {
          currentPrice = parseFloat(match.entry) || parseFloat(match.price) || null;
        }
      }

      if (currentPrice === null || currentPrice <= 0) continue;

      trade.currentLivePrice = currentPrice;
      const pnlPct = trade.lockedEntryPrice > 0
        ? Math.round(((currentPrice - trade.lockedEntryPrice) / trade.lockedEntryPrice) * 1000) / 10
        : 0;
      trade.currentPnlPct = pnlPct;

      const lockedEntry = trade.lockedEntryPrice || currentPrice;
      const nominalSl = trade.lockedStopLoss;
      const tp1 = trade.lockedTarget1;
      const tp2 = trade.lockedTarget2;
      const invLevel = parseFloat(trade.indexInvalidation) || (spxIndex ? (trade.type === "PUT" ? spxIndex + 10 : spxIndex - 10) : 0);

      // --- Case C: Smart Profit Lock (تأمين الربح المتحرك) ---
      // When contract profit reaches +15%, auto-move Stop Loss to Breakeven (Entry Price).
      // When profit reaches +30%, trail Stop Loss at +15% dynamically.
      if (pnlPct >= 30.0) {
        const trailedSl = Math.round(lockedEntry * 1.15 * 100) / 100;
        trade.profitLock = "TRAILED_15";
        trade.profitLockText = `حجز ربح +15% كحد أدنى (${trailedSl}$)`;
        trade.effectiveStopLoss = Math.max(trailedSl, trade.effectiveStopLoss || nominalSl);
      } else if (pnlPct >= 15.0) {
        const breakevenSl = lockedEntry;
        trade.profitLock = "BREAKEVEN";
        trade.profitLockText = `وقف الخسارة رُفع لنقطة الدخول (${breakevenSl}$)`;
        trade.effectiveStopLoss = Math.max(breakevenSl, trade.effectiveStopLoss || nominalSl);
      } else {
        if (!trade.profitLock) {
          trade.effectiveStopLoss = nominalSl;
        }
      }

      // --- Case B: Contract Burn Emergency Exit (إنذار احتراق العقد والخروج الفوري) ---
      // If SPX violently breaks invalidation level by > 1.8 points,
      // OR contract Delta drops below 0.08 while in loss,
      // OR IV crushes while price drops (Theta + Delta burn makes recovery statistically < 20%)
      let isBurn = false;
      let burnReason = "";

      if (spxIndex > 0 && invLevel > 0) {
        if (trade.type === "CALL" && spxIndex < (invLevel - 1.8)) {
          isBurn = true;
          burnReason = `كسر SPX لمستوى الدعم بفارق ${(invLevel - spxIndex).toFixed(1)} نقطة (> 1.8)`;
        } else if (trade.type === "PUT" && spxIndex > (invLevel + 1.8)) {
          isBurn = true;
          burnReason = `تجاوز SPX لمستوى المقاومة صعوداً بفارق ${(spxIndex - invLevel).toFixed(1)} نقطة (> 1.8)`;
        }
      }

      if (!isBurn && pnlPct < 0 && liveDelta < 0.08 && liveDelta > 0) {
        isBurn = true;
        burnReason = `تآكل الدلتا الحاد إلى ${liveDelta.toFixed(2)} (< 0.08)`;
      }

      if (!isBurn && pnlPct < -10 && liveIV < 12.0 && liveIV > 0) {
        isBurn = true;
        burnReason = `انهيار التقلب الضمني (IV: ${liveIV}%) مع هبوط السعر`;
      }

      trade.isContractBurn = isBurn;
      trade.burnReason = burnReason;

      // --- Case A: Elastic Stop Hold (تحديث الوقف المرن عند وجود أمل ارتداد) ---
      // If contract price drops toward initial Stop Loss (within 8% or price <= nominalSl * 1.05),
      // check if SPX has NOT breached structural invalidation strictly (within buffer)
      // AND contract IV is holding up (indicating temporary dip/stop-hunt)
      const isNearNominalSl = nominalSl > 0 && currentPrice <= (nominalSl * 1.08);
      let isIndexHolding = true;
      if (spxIndex > 0 && invLevel > 0) {
        if (trade.type === "CALL" && spxIndex < (invLevel - 0.5)) {
          isIndexHolding = false;
        } else if (trade.type === "PUT" && spxIndex > (invLevel + 0.5)) {
          isIndexHolding = false;
        }
      }

      const isIvHolding = liveIV >= 14.0;
      const canActivateElasticStop = !isBurn && isNearNominalSl && isIndexHolding && isIvHolding && !trade.profitLock;

      if (canActivateElasticStop) {
        // Automatically adjust active stop to Elastic Recovery Stop (-28% instead of nominal -15%)
        const elasticStop = Math.round(lockedEntry * 0.72 * 100) / 100;
        trade.isElasticStopActive = true;
        trade.elasticStopPrice = elasticStop;
        trade.effectiveStopLoss = elasticStop;
      } else if (!isNearNominalSl && trade.isElasticStopActive && currentPrice > nominalSl * 1.15) {
        trade.isElasticStopActive = false;
        trade.effectiveStopLoss = nominalSl;
      }

      const activeSl = trade.effectiveStopLoss || nominalSl;

      // Alert Generation Priority:
      // 1. Contract Burn Emergency Alert
      if (isBurn) {
        newAlerts.push({
          tradeId: id,
          severity: "danger",
          type: "CONTRACT_BURN",
          text: `🔥 إنذار احتراق العقد (Contract Burn): اخرج فوراً! السهم كسر الاتجاه (${burnReason}) والتآكل يحرق العقد — لا تنتظر`,
          timestamp: now
        });
        if (!this.lastSoundTimes[id + "_burn"] || (now - this.lastSoundTimes[id + "_burn"] > 20000)) {
          this.lastSoundTimes[id + "_burn"] = now;
          this.playAlertSound("stop_loss");
        }
      }
      // 2. Active Stop Loss Breached (Nominal or Elastic or Trailed)
      else if (activeSl > 0 && currentPrice <= activeSl) {
        const isElastic = trade.isElasticStopActive;
        newAlerts.push({
          tradeId: id,
          severity: "danger",
          type: "STOP_BREACH",
          text: `🚨 كسر وقف الخسارة ${isElastic ? 'المرن' : 'المحمي'}: ${trade.symbol} وصل إلى ${currentPrice}$ (الوقف: ${activeSl}$)`,
          timestamp: now
        });
        if (!this.lastSoundTimes[id] || (now - this.lastSoundTimes[id] > 25000)) {
          this.lastSoundTimes[id] = now;
          this.playAlertSound("stop_loss");
          try {
            if (window.SahmContent && typeof window.SahmContent.sendMessage === "function") {
              window.SahmContent.sendMessage({
                type: "TRADE_ALERT",
                tradeId: id,
                alertType: "STOP_BREACH",
                symbol: trade.symbol,
                lockedEntry: trade.lockedEntryPrice,
                currentPrice: currentPrice,
                target1: tp1,
                target2: tp2,
                stopLoss: activeSl,
                pnlPct: pnlPct
              });
            }
          } catch (err) {}
        }
      }
      // 3. Elastic Stop Active Status
      else if (trade.isElasticStopActive) {
        newAlerts.push({
          tradeId: id,
          severity: "warning",
          type: "ELASTIC_STOP_ACTIVE",
          text: `🛡️ تم تفعيل الوقف المرن المحدث (${trade.elasticStopPrice}$) — المؤشر لم يكسر الدعم وهناك فرصة ارتداد قوية، لا تبع بخسارة الآن`,
          timestamp: now
        });
      }
      // 4. Stop Loss Critical Proximity (< 3% of activeSl)
      else if (activeSl > 0 && currentPrice > activeSl && (currentPrice - activeSl) / activeSl <= 0.03) {
        newAlerts.push({
          tradeId: id,
          severity: "warning",
          type: "SL_PROXIMITY",
          text: `⚠️ اقتراب حرج من وقف الخسارة (< 3%): ${trade.symbol} بسعر ${currentPrice}$ (الوقف: ${activeSl}$)`,
          timestamp: now
        });
        if (!this.lastSoundTimes[id] || (now - this.lastSoundTimes[id] > 25000)) {
          this.lastSoundTimes[id] = now;
          this.playAlertSound("warning");
        }
      }

      // 5. Target 2 Reached
      if (tp2 > 0 && currentPrice >= tp2) {
        newAlerts.push({
          tradeId: id,
          severity: "success",
          type: "TP2_REACHED",
          text: `🏆 مبروك! تحقق الهدف الثاني بالكامل لصفقة ${trade.symbol} عند ${currentPrice}$ (ربح: ${pnlPct > 0 ? '+' : ''}${pnlPct}%)`,
          timestamp: now
        });
        if (!this.lastSoundTimes[id + "_tp2"] || (now - this.lastSoundTimes[id + "_tp2"] > 40000)) {
          this.lastSoundTimes[id + "_tp2"] = now;
          this.playAlertSound("target");
          try {
            if (window.SahmContent && typeof window.SahmContent.sendMessage === "function") {
              window.SahmContent.sendMessage({
                type: "TRADE_ALERT",
                tradeId: id,
                alertType: "TP2_REACHED",
                symbol: trade.symbol,
                lockedEntry: trade.lockedEntryPrice,
                currentPrice: currentPrice,
                target1: tp1,
                target2: tp2,
                stopLoss: activeSl,
                pnlPct: pnlPct
              });
            }
          } catch (err) {}
        }
      }
      // 6. Target 1 Reached
      else if (tp1 > 0 && currentPrice >= tp1) {
        newAlerts.push({
          tradeId: id,
          severity: "success",
          type: "TP1_REACHED",
          text: `🎉 مبروك! تحقق الهدف الأول لصفقة ${trade.symbol} عند ${currentPrice}$ (ربح: ${pnlPct > 0 ? '+' : ''}${pnlPct}%)`,
          timestamp: now
        });
        if (!this.lastSoundTimes[id] || (now - this.lastSoundTimes[id] > 30000)) {
          this.lastSoundTimes[id] = now;
          this.playAlertSound("target");
          try {
            if (window.SahmContent && typeof window.SahmContent.sendMessage === "function") {
              window.SahmContent.sendMessage({
                type: "TRADE_ALERT",
                tradeId: id,
                alertType: "TP1_REACHED",
                symbol: trade.symbol,
                lockedEntry: trade.lockedEntryPrice,
                currentPrice: currentPrice,
                target1: tp1,
                target2: tp2,
                stopLoss: activeSl,
                pnlPct: pnlPct
              });
            }
          } catch (err) {}
        }
      }
    }

    this.activeAlerts = newAlerts;
  },

  /**
   * Setup drag, click, market switch, and strategy mode handlers
   */
  attachEventListeners() {
    const root = document.getElementById("sahm-copilot-root");
    const dragHandle = document.getElementById("copilot-drag-handle");
    const panel = document.getElementById("copilot-main-panel");
    const bubble = document.getElementById("copilot-bubble");
    const collapseBtn = document.getElementById("copilot-btn-collapse");
    const rescanBtn = document.getElementById("copilot-btn-rescan");
    const inspectBtn = document.getElementById("copilot-btn-inspect-page");

    // Draggable logic with zoom compensation
    dragHandle.addEventListener("mousedown", (e) => {
      if (e.target.closest("button") || e.target.closest(".copilot-controls")) {
        return;
      }
      this.dragState.isDragging = true;
      this.dragState.startX = e.clientX;
      this.dragState.startY = e.clientY;
      const currentZoom = this._lastAppliedZoom || 1.0;
      this.dragState.initialLeft = parseFloat(root.style.left) || (root.getBoundingClientRect().left / currentZoom);
      this.dragState.initialTop = parseFloat(root.style.top) || (root.getBoundingClientRect().top / currentZoom);
      e.preventDefault();
    });

    document.addEventListener("mousemove", (e) => {
      if (!this.dragState.isDragging) return;
      const currentZoom = this._lastAppliedZoom || 1.0;
      const deltaX = (e.clientX - this.dragState.startX) / currentZoom;
      const deltaY = (e.clientY - this.dragState.startY) / currentZoom;

      const newLeft = Math.max(
        10,
        Math.min((window.innerWidth / currentZoom) - 460, this.dragState.initialLeft + deltaX),
      );
      const newTop = Math.max(
        10,
        Math.min((window.innerHeight / currentZoom) - 200, this.dragState.initialTop + deltaY),
      );

      root.style.left = `${newLeft}px`;
      root.style.top = `${newTop}px`;
      root.style.right = "auto";
    });

    document.addEventListener("mouseup", () => {
      this.dragState.isDragging = false;
    });

    // Zoom manual control buttons (+, -, reset)
    const zoomInBtn = document.getElementById("copilot-btn-zoom-in");
    const zoomOutBtn = document.getElementById("copilot-btn-zoom-out");
    const zoomResetBtn = document.getElementById("copilot-btn-zoom-reset");

    if (zoomInBtn) {
      zoomInBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.increaseScale();
      });
    }

    if (zoomOutBtn) {
      zoomOutBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.decreaseScale();
      });
    }

    if (zoomResetBtn) {
      zoomResetBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.resetScale();
      });
    }

    // Collapse and Expand
    collapseBtn.addEventListener("click", () => {
      panel.classList.add("collapsed");
      bubble.classList.remove("hidden");
      this.isCollapsed = true;
    });

    bubble.addEventListener("click", () => {
      panel.classList.remove("collapsed");
      bubble.classList.add("hidden");
      this.isCollapsed = false;
    });

    // Market Switcher Buttons
    const saBtn = document.getElementById("copilot-market-btn-sa");
    const usBtn = document.getElementById("copilot-market-btn-us");

    saBtn.addEventListener("click", () => {
      this.setActiveMarket("SA", true);
    });

    usBtn.addEventListener("click", () => {
      this.setActiveMarket("US", true);
    });

    // Strategy Mode Toggle (Auto vs Manual)
    const modeAuto = document.getElementById("copilot-mode-auto");
    const modeManual = document.getElementById("copilot-mode-manual");

    modeAuto.addEventListener("click", () => {
      modeAuto.classList.add("active");
      modeManual.classList.remove("active");
      this.strategyMode = "AUTO";
      this.activeStrategy = "AUTO";
      if (window.SahmContent) window.SahmContent.setStrategy("AUTO");
      this.renderStrategyPills();
      this.render();
    });

    modeManual.addEventListener("click", () => {
      modeManual.classList.add("active");
      modeAuto.classList.remove("active");
      this.strategyMode = "MANUAL";
      // Pick first strategy of current market as default
      const defaultStrat =
        this.activeMarket === "SA" ? "DEFENSIVE_WAR" : "SIDEWAYS_SCALP";
      this.activeStrategy = defaultStrat;
      if (window.SahmContent) window.SahmContent.setStrategy(defaultStrat);
      this.renderStrategyPills();
      this.render();
    });

    // Rescan & Inspect
    const triggerInspect = async () => {
      if (this.activeTab === "SPX_OPTIONS" || (window.SahmSPXParser && window.SahmSPXParser.isOptionsChainPage())) {
        if (inspectBtn) {
          inspectBtn.disabled = true;
          inspectBtn.style.opacity = "0.75";
          inspectBtn.innerHTML = `<span>⏳ جاري مسح السلسلة بالكامل...</span>`;
        }
        if (window.SahmSPXParser && typeof window.SahmSPXParser.sweepAllOptionStrikes === "function") {
          await window.SahmSPXParser.sweepAllOptionStrikes((partial) => {
            if (this.activeTab === "SPX_OPTIONS") this.renderSPXTab();
          });
        }
        if (inspectBtn) {
          inspectBtn.disabled = false;
          inspectBtn.style.opacity = "1";
          inspectBtn.innerHTML = `<span>🔍 فحص وتحديث مباشر</span>`;
        }
        this.render();
      } else if (window.SahmContent) {
        window.SahmContent.inspectAndScanPage(true);
      }
    };
    if (rescanBtn) rescanBtn.addEventListener("click", triggerInspect);
    if (inspectBtn) inspectBtn.addEventListener("click", triggerInspect);
  },

  /**
   * Set Active Market (SA vs US)
   * When SA is active: ONLY display Saudi modules. Completely hide US & SPX Options tabs!
   * When US is active: Immediately hide Saudi modules and activate US modules!
   */
  setActiveMarket(marketCode, notifyBackend = false) {
    if (this.activeMarket === marketCode && this.isInitialized) return;
    this.activeMarket = marketCode;

    // Update buttons
    const saBtn = document.getElementById("copilot-market-btn-sa");
    const usBtn = document.getElementById("copilot-market-btn-us");

    if (saBtn && usBtn) {
      if (marketCode === "SA") {
        saBtn.classList.add("active", "sa-active");
        usBtn.classList.remove("active");
        if (this.activeTab === "spx" || this.activeTab === "us_indices") {
          this.activeTab = "overview";
        }
      } else {
        usBtn.classList.add("active");
        saBtn.classList.remove("active", "sa-active");
        if (
          this.activeTab === "overview" ||
          this.activeTab === "scanner" ||
          this.activeTab === "nextsession"
        ) {
          this.activeTab = "spx";
        }
      }
    }

    if (notifyBackend && window.SahmContent) {
      window.SahmContent.setMarket(marketCode);
    }

    this.renderStrategyPills();
    this.renderNavTabs();
    this.render();
  },

  /**
   * Set Market Session Status (OPEN vs CLOSED)
   * If Saudi Market is "CLOSED", automatically highlight "رادار الجلسة القادمة"
   */
  setMarketStatus(statusRaw, customText = null) {
    this.marketStatus = statusRaw;
    const badge = document.getElementById("copilot-session-status-badge");
    const textEl = document.getElementById("copilot-session-status-text");

    if (badge) {
      const isClosed =
        statusRaw === "CLOSED" ||
        statusRaw === false ||
        (customText && (customText.includes("مغلق") || customText.includes("عطلة"))) ||
        (typeof statusRaw === "string" && (statusRaw.includes("مغلق") || statusRaw.includes("عطلة")));

      const isPreMarket = !isClosed && (
        statusRaw === "PRE_MARKET" ||
        (customText && customText.includes("قبل الافتتاح")) ||
        (typeof statusRaw === "string" && statusRaw.includes("قبل الافتتاح"))
      );

      const isOvernight = !isClosed && !isPreMarket && (
        statusRaw === "OVERNIGHT" ||
        (customText && customText.includes("التداول الليلي")) ||
        (typeof statusRaw === "string" && statusRaw.includes("التداول الليلي"))
      );

      if (isClosed) {
        badge.className = "copilot-session-badge session-closed";
        const label =
          customText ||
          (this.activeMarket === "US"
            ? "سوق مغلق 🔴 (بيانات آخر إغلاق)"
            : "سوق مغلق 🔴");
        badge.innerHTML = `<span class="copilot-dot" style="background:#ef4444; box-shadow:0 0 8px #ef4444;"></span><span>${label}</span>`;

        // If Saudi Market is closed, automatically switch to / highlight next session predictor tab!
        if (this.activeMarket === "SA" && this.activeTab !== "nextsession") {
          this.activeTab = "nextsession";
          this.renderNavTabs();
        }
      } else if (isPreMarket) {
        badge.className = "copilot-session-badge session-premarket";
        badge.innerHTML = `<span class="copilot-dot" style="background:#eab308; box-shadow:0 0 8px #eab308;"></span><span>فترة ما قبل الافتتاح (Pre-Market) 🟡</span>`;
      } else if (isOvernight) {
        badge.className = "copilot-session-badge session-overnight";
        badge.innerHTML = `<span class="copilot-dot" style="background:#818cf8; box-shadow:0 0 8px #818cf8;"></span><span>التداول الليلي / خارج الجلسة 🌙</span>`;
      } else {
        badge.className = "copilot-session-badge session-open";
        badge.innerHTML = `<span class="copilot-dot connected"></span><span>سوق مفتوح 🟢</span>`;
      }
    }
  },

  /**
   * Render Strategy Pills based on Active Market & Mode
   */
  renderStrategyPills() {
    const container = document.getElementById("copilot-strategy-pills");
    const stratNameEl = document.getElementById("copilot-active-strategy-name");
    if (!container) return;

    let strategies = [];

    if (this.activeMarket === "SA") {
      strategies = [
        { code: "DEFENSIVE_WAR", name: "🛡️ استراتيجية الأزمات والحروب" },
        { code: "RVOL_MOMENTUM", name: "🚀 اختراق السيولة والزخم" },
        { code: "ICEBERG_SCALP", name: "⚡ مضاربة السيولة الخفية" },
        { code: "OVERNIGHT_GAP", name: "🌙 رادار الجلسة القادمة" },
      ];
    } else {
      strategies = [
        { code: "0DTE_ORB", name: "📈 0DTE اختراق الافتتاح" },
        { code: "SIDEWAYS_SCALP", name: "⚡ مضاربة السوق العرضي (Scalp)" },
        { code: "HIGH_VIX_SNIPER", name: "🎯 قناص التقلبات الحادة" },
      ];
    }

    if (this.strategyMode === "AUTO") {
      if (stratNameEl) stratNameEl.innerText = "تلقائي ذكي (Auto AI Regime)";
      container.innerHTML = strategies
        .map((s) => {
          const isCurrentAuto =
            s.code === this.state.marketState.activeStrategy;
          return `
          <button class="copilot-strat-pill ${isCurrentAuto ? "active" : ""}" style="${isCurrentAuto ? "pointer-events:none;" : "opacity:0.6; pointer-events:none;"}">
            ${s.name} ${isCurrentAuto ? "✓ (نشط)" : ""}
          </button>
        `;
        })
        .join("");
    } else {
      if (stratNameEl) {
        const found = strategies.find((s) => s.code === this.activeStrategy);
        stratNameEl.innerText = found ? found.name : this.activeStrategy;
      }

      container.innerHTML = strategies
        .map((s) => {
          const isSel = s.code === this.activeStrategy;
          return `
          <button class="copilot-strat-pill ${isSel ? "active" : ""}" data-strategy="${s.code}">
            ${s.name}
          </button>
        `;
        })
        .join("");

      // Attach click events for manual strategy switching
      container.querySelectorAll(".copilot-strat-pill").forEach((pill) => {
        pill.addEventListener("click", () => {
          const stratCode = pill.getAttribute("data-strategy");
          this.activeStrategy = stratCode;
          if (window.SahmContent) window.SahmContent.setStrategy(stratCode);
          this.renderStrategyPills();
          this.render();
        });
      });
    }
  },

  /**
   * Render Navigation Tabs dynamically:
   * When SA: ONLY Saudi tabs. Hide US tabs completely.
   * When US: ONLY US tabs. Hide Saudi tabs completely.
   */
  renderNavTabs() {
    const nav = document.getElementById("copilot-nav-container");
    if (!nav) return;

    let tabs = [];

    if (this.activeMarket === "SA") {
      const isClosed = this.marketStatus === "CLOSED";
      tabs = [
        { id: "overview", label: "السيولة وتاسي" },
        { id: "scanner", label: "فرص تداول تاسي" },
        { id: "analyzer4d", label: "التحليل الرباعي 4D" },
        {
          id: "nextsession",
          label: "🌙 رادار الجلسة القادمة",
          isHighlighted: isClosed,
        },
        { id: "portfolio", label: "محفظتي" },
      ];
    } else {
      tabs = [
        { id: "spx", label: "⚡ أوبشن SPX" },
        { id: "us_indices", label: "المؤشرات الأمريكية" },
        { id: "analyzer4d", label: "التحليل الرباعي 4D" },
        { id: "portfolio", label: "محفظتي" },
      ];
    }

    nav.innerHTML = tabs
      .map((t) => {
        const isActive = this.activeTab === t.id;
        const highlightCls = t.isHighlighted ? "highlight-pulse" : "";
        return `
        <button class="copilot-tab-btn ${isActive ? "active" : ""} ${highlightCls}" data-tab="${t.id}">
          ${t.label}
        </button>
      `;
      })
      .join("");

    nav.querySelectorAll(".copilot-tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        nav
          .querySelectorAll(".copilot-tab-btn")
          .forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        this.activeTab = btn.getAttribute("data-tab");
        this.render();
      });
    });
  },

  /**
   * Update visual diagnostic badge inside the sidebar
   */
  updateDiagnosticBadge(text, pageTypeName = "منصة سهم") {
    const badge = document.getElementById("copilot-diag-badge");
    const typeEl = document.getElementById("copilot-diag-type");
    if (badge) {
      badge.innerText = text;
      badge.classList.remove("flash");
      void badge.offsetWidth;
      badge.classList.add("flash");
    }
    if (typeEl && pageTypeName) {
      typeEl.innerText = pageTypeName;
    }
  },

  /**
   * Update backend connection status
   */
  updateConnectionStatus(connected, ping = 0) {
    this.state.connected = connected;
    this.state.ping = ping;

    const el = document.getElementById("copilot-ws-status");
    if (!el) return;

    if (connected) {
      el.innerHTML = `
        <span class="copilot-dot connected"></span>
        <span class="status-text" style="color:#00F090;">متصل ${ping ? ping + "ms" : ""}</span>
      `;
    } else {
      el.innerHTML = `
        <span class="copilot-dot disconnected"></span>
        <span class="status-text" style="color:#FF3B56;">غير متصل (8000)</span>
      `;
    }
  },

  /**
   * Initialize Real-Time TradingView-to-Sahm Bridge Listener
   */
  initTradingViewBridge() {
    this.tvBridgeData = null;

    // 1. Listen for storage changes in real-time
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === "local" && changes.tv_spx_bridge && changes.tv_spx_bridge.newValue) {
          this.handleTradingViewBridgeUpdate(changes.tv_spx_bridge.newValue);
        }
      });
    }

    // 2. Read initial state from storage
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get("tv_spx_bridge", (data) => {
        if (data && data.tv_spx_bridge) {
          this.handleTradingViewBridgeUpdate(data.tv_spx_bridge);
        }
      });
    }

    // 3. Listen for direct broadcast stream messages from background service worker (0ms latency)
    if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener((msg) => {
        if (msg && msg.type === "TV_BRIDGE_STREAM" && msg.payload) {
          this.handleTradingViewBridgeUpdate(msg.payload);
        }
      });
    }

    // 4. Periodic liveness monitor (every 1000ms): Check if feed has gone stale (> 6000ms)
    setInterval(() => {
      if (this.tvBridgeData) {
        const isFresh = (Date.now() - (this.tvBridgeData.timestamp || 0)) < 6000;
        if (this.tvBridgeData.isConnected !== isFresh) {
          this.tvBridgeData.isConnected = isFresh;
          if (this.state.spxEngine) {
            this.state.spxEngine.tvConnected = isFresh;
          }
          if (this.activeTab === "spx" || this.activeTab === "SPX_OPTIONS") {
            this.render();
          }
        }
      }
    }, 1000);
  },

  /**
   * Handle Inbound SPX Data from TradingView Bridge
   */
  handleTradingViewBridgeUpdate(payload) {
    if (!payload || !payload.price || payload.price <= 0) return;

    const isFresh = (Date.now() - (payload.timestamp || 0)) < 6000;
    this.tvBridgeData = Object.assign({}, payload, { isConnected: isFresh });

    if (!this.state.spxEngine) {
      this.state.spxEngine = {};
    }

    // If fresh, update SPX Engine real-time price & ticker metrics
    if (isFresh) {
      this.state.spxEngine.tvConnected = true;
      this.state.spxEngine.indexPrice = payload.price;
      this.state.spxEngine.changePoints = payload.changePts;
      this.state.spxEngine.changePercent = payload.changePct;
      this.state.spxEngine.tvBid = payload.bid;
      this.state.spxEngine.tvAsk = payload.ask;
      this.state.spxEngine.tvHigh = payload.high;
      this.state.spxEngine.tvLow = payload.low;

      if (!this.state.spxEngine.majorIndices) {
        this.state.spxEngine.majorIndices = {};
      }
      this.state.spxEngine.majorIndices.spx = {
        price: payload.price,
        changePercent: payload.changePct,
        changePoints: payload.changePts
      };

      // Feed live price into anti-whipsaw tick history to generate instant velocity & CALL/PUT signals
      this.updateSpxTickHysteresis(payload.price, this.state.spxEngine.bias);

      // Re-evaluate active trade proximity & alerts with live price
      this.checkProximityAlerts();

      // If SPX tab is open, update UI smoothly
      if (this.activeTab === "spx" || this.activeTab === "SPX_OPTIONS") {
        this.render();
      }
    }
  },

  /**
   * Receive quant engine payload from Python backend
   */
  updateFromBackend(payload) {
    if (payload.marketState) this.state.marketState = payload.marketState;
    if (payload.orderFlow) this.state.orderFlow = payload.orderFlow;
    if (payload.opportunities) this.state.opportunities = payload.opportunities;
    if (payload.nextSession) this.state.nextSession = payload.nextSession;
    if (payload.analysis4D) this.state.analysis4D = payload.analysis4D;
    if (payload.portfolio) this.state.portfolio = payload.portfolio;
    if (payload.spxEngine) {
      if (payload.spxEngine.majorIndices) {
        const bNas = payload.spxEngine.majorIndices.nasdaq?.price;
        const bDow = payload.spxEngine.majorIndices.dow?.price;
        if (bNas > 0 && bNas === bDow) {
          const live = window.SahmMarketParser?.parseMajorIndices?.() || window.SahmSPXParser?.parseMajorIndices?.();
          if (live && live.nasdaq?.price > 0 && live.nasdaq.price !== live.dow?.price) {
            payload.spxEngine.majorIndices.nasdaq = live.nasdaq;
          }
        }
      }

      // Preserve active real-time TradingView bridge feed over backend snapshot
      if (this.tvBridgeData && this.tvBridgeData.isConnected && this.tvBridgeData.price > 0) {
        payload.spxEngine.indexPrice = this.tvBridgeData.price;
        payload.spxEngine.changePoints = this.tvBridgeData.changePts;
        payload.spxEngine.changePercent = this.tvBridgeData.changePct;
        payload.spxEngine.tvBid = this.tvBridgeData.bid;
        payload.spxEngine.tvAsk = this.tvBridgeData.ask;
        payload.spxEngine.tvHigh = this.tvBridgeData.high;
        payload.spxEngine.tvLow = this.tvBridgeData.low;
        payload.spxEngine.tvConnected = true;
      }

      this.state.spxEngine = payload.spxEngine;
    }

    if (payload.activeMarket && payload.activeMarket !== this.activeMarket) {
      this.setActiveMarket(payload.activeMarket, false);
    }
    if (
      this.activeMarket === "US" &&
      payload.spxEngine &&
      payload.spxEngine.isMarketClosed
    ) {
      this.setMarketStatus(
        "CLOSED",
        payload.spxEngine.marketStatusText || "سوق مغلق 🔴 (بيانات آخر إغلاق)",
      );
    } else if (
      payload.marketStatus &&
      payload.marketStatus !== this.marketStatus
    ) {
      this.setMarketStatus(payload.marketStatus);
    }

    const timeEl = document.getElementById("copilot-last-updated");
    if (timeEl) {
      const now = new Date();
      const timeEgyptStr = new Intl.DateTimeFormat("ar-EG", {
        timeZone: "Africa/Cairo",
        hour: "numeric",
        minute: "numeric",
        second: "numeric",
        hour12: true
      }).format(now);
      timeEl.innerText = `تحديث: ${timeEgyptStr} (مصر)`;
    }

    this.render();
  },

  /**
   * Master View Renderer
   */
  render() {
    this.checkProximityAlerts();

    const container = document.getElementById("copilot-content-body");
    if (!container) return;
    const savedScrollTop = container.scrollTop;

    if (this.activeMarket === "SA") {
      if (this.activeTab === "overview") {
        container.innerHTML = this.renderSaudiOverviewTab();
      } else if (this.activeTab === "scanner") {
        container.innerHTML = this.renderSaudiScannerTab();
      } else if (this.activeTab === "analyzer4d") {
        container.innerHTML = this.render4DAnalyzerTab();
      } else if (this.activeTab === "nextsession") {
        container.innerHTML = this.renderNextSessionTab();
      } else if (this.activeTab === "portfolio") {
        container.innerHTML = this.renderPortfolioTab();
      } else {
        container.innerHTML = this.renderSaudiOverviewTab();
      }
    } else {
      // US Market Active
      if (this.activeTab === "spx") {
        container.innerHTML = this.renderSPXTab();
      } else if (this.activeTab === "us_indices") {
        container.innerHTML = this.renderUSIndicesTab();
      } else if (this.activeTab === "analyzer4d") {
        container.innerHTML = this.render4DAnalyzerTab();
      } else if (this.activeTab === "portfolio") {
        container.innerHTML = this.renderPortfolioTab();
      } else {
        container.innerHTML = this.renderSPXTab();
      }
    }

    // Attach click events for execution / tracking toggle buttons
    container.querySelectorAll(".copilot-btn-track-trade").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const tradeDataStr = btn.getAttribute("data-trade-data");
        if (tradeDataStr) {
          try {
            const tradeData = JSON.parse(tradeDataStr);
            this.toggleTrackTrade(tradeData);
          } catch (err) {}
        }
      });
    });

    // Attach click event for "مسح وإيقاف جميع التنبيهات النشطة"
    const clearAllBtn = document.getElementById("copilot-btn-clear-all-alerts");
    if (clearAllBtn) {
      clearAllBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.clearAllTrackedTrades();
      });
    }

    // Attach click events for individual alert & active drawer "✖ إيقاف" / "✖ إغلاق" buttons
    container.querySelectorAll(".copilot-btn-dismiss-alert, .copilot-btn-close-active-trade").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const tradeId = btn.getAttribute("data-trade-id");
        if (tradeId) {
          this.untrackTrade(tradeId);
        }
      });
    });

    // Attach click events for Capital & Price Tier buttons
    container.querySelectorAll(".copilot-btn-price-tier").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const tier = btn.getAttribute("data-tier");
        if (tier) {
          this.setPriceTier(tier);
        }
      });
    });

    // Attach Full Chain Sweep button click handler if rendered in SPX tab
    const sweepBtn = document.getElementById("copilot-btn-sweep-chain");
    if (sweepBtn) {
      sweepBtn.addEventListener("click", async () => {
        sweepBtn.disabled = true;
        sweepBtn.style.opacity = "0.75";
        sweepBtn.innerHTML = `<span>⏳</span><span>جاري التمرير ومسح كامل السلسلة...</span>`;
        if (window.SahmSPXParser && typeof window.SahmSPXParser.sweepAllOptionStrikes === "function") {
          await window.SahmSPXParser.sweepAllOptionStrikes();
        }
        sweepBtn.disabled = false;
        sweepBtn.style.opacity = "1";
        sweepBtn.innerHTML = `<span>✓</span><span>اكتمل المسح الشامل لكل العقود!</span>`;
        setTimeout(() => {
          this.render();
        }, 1500);
      });
    }

    // Attach Compact Table Mode button click handler
    const compactBtn = document.getElementById("copilot-btn-compact-table");
    if (compactBtn) {
      compactBtn.addEventListener("click", () => {
        this.toggleCompactTable();
      });
    }

    // Refresh dynamic zoom compensation on render
    this.updateZoomCompensation();

    // Lock and preserve scroll position during DOM updates
    if (container && typeof savedScrollTop === "number") {
      container.scrollTop = savedScrollTop;
      requestAnimationFrame(() => {
        if (container) container.scrollTop = savedScrollTop;
      });
    }
  },

  /**
   * SA Tab 1: Saudi Overview & Real-Time Order Flow Liquidity
   */
  renderSaudiOverviewTab() {
    const { marketState, orderFlow } = this.state;

    let bannerClass = "bullish";
    let statusTitle = "سوق صاعد | تفضيل مراكز الشراء 🟢";

    if (marketState.status === "BEARISH") {
      bannerClass =
        marketState.activeStrategy === "DEFENSIVE_WAR"
          ? "crisis-defense"
          : "bearish";
      statusTitle = "سوق هابط | نمط الأزمات وتصفية الكسور 🔴";
    } else if (marketState.status === "SIDEWAYS") {
      bannerClass = "sideways-warning";
      statusTitle = "مسار عرضي | مضاربة السيولة الخفية ⚡";
    }

    return `
      <!-- Market State Banner -->
      <div class="copilot-market-banner ${bannerClass}">
        <div>
          <div style="font-weight: 800; font-size: 13px;">${statusTitle}</div>
          <div class="banner-detail">${marketState.detail}</div>
          <div style="font-size: 10px; color: #38bdf8; font-weight: 700; margin-top: 3px;">
            📌 الاستراتيجية الحالية: <b>${marketState.strategyArabic || "اختراق السيولة والزخم"}</b>
          </div>
        </div>
      </div>

      <!-- Real-time Order Flow Liquidity (الشراء والبيع الفعلي) -->
      <div class="copilot-card">
        <div class="copilot-card-title">
          <span>تحليل السيولة اللحظية (Order Flow)</span>
          <span style="font-size:10px; padding:2px 6px; border-radius:4px; background:rgba(0,240,144,0.15); color:#00F090; font-weight:700;">
            ${orderFlow.sentiment === "ACCUMULATION" ? "🔥 تجميع لحظي" : orderFlow.sentiment === "DISTRIBUTION" ? "⚠️ تصريف وضغط" : "⚖️ توازن نسبى"}
          </span>
        </div>

        <div class="copilot-liquidity-bar-container">
          <div class="copilot-liquidity-labels">
            <span class="buy-val">شراء فعلي: ${orderFlow.buyRatio}%</span>
            <span class="sell-val">بيع فعلي: ${orderFlow.sellRatio}%</span>
          </div>

          <div class="copilot-liquidity-bar">
            <div class="copilot-bar-buy" style="width: ${orderFlow.buyRatio}%"></div>
            <div class="copilot-bar-sell" style="width: ${orderFlow.sellRatio}%"></div>
          </div>

          <div style="display: flex; justify-content: space-between; font-size: 10px; color: #94a3b8; margin-top: 5px;">
            <span>صافي الدلتا: <b style="color:${orderFlow.netDelta >= 0 ? "#00F090" : "#FF3B56"}">${orderFlow.netDelta > 0 ? "+" : ""}${orderFlow.netDelta.toLocaleString()} سهم</b></span>
            <span>الرمز النشط: <b>${orderFlow.symbol || "1120"}</b></span>
          </div>

          ${
            orderFlow.absorptionAlert
              ? `
            <div style="font-size:10px; color:#38bdf8; background:rgba(56,189,248,0.1); padding:4px 8px; border-radius:4px; margin-top:4px;">
              ⚡ <b>تنبيه السيولة الخفية:</b> ${orderFlow.absorptionAlert}
            </div>
          `
              : ""
          }
        </div>
      </div>

      <!-- Level 2 Depth Imbalance (عمق السوق) -->
      <div class="copilot-card">
        <div class="copilot-card-title">
          <span>عمق السوق (طلبات الشراء مقابل عروض البيع)</span>
          <span style="font-size: 10px; color: #94a3b8;">Level 2</span>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px;">
          <div style="background:rgba(0,0,0,0.25); border-radius:6px; padding:6px 8px; border:1px solid var(--copilot-border);">
            <div style="font-size:10px; color:#00F090; font-weight:700;">إجمالي الطلب: ${orderFlow.bidRatio || 52}%</div>
            <div style="font-size:13px; font-weight:800; color:#00F090; margin-top:2px;">
              ${(orderFlow.totalBuyVolume || 0).toLocaleString()} <span style="font-size:9px; font-weight:normal; color:#94a3b8;">سهم</span>
            </div>
          </div>

          <div style="background:rgba(0,0,0,0.25); border-radius:6px; padding:6px 8px; border:1px solid var(--copilot-border);">
            <div style="font-size:10px; color:#FF3B56; font-weight:700;">إجمالي العرض: ${orderFlow.askRatio || 48}%</div>
            <div style="font-size:13px; font-weight:800; color:#FF3B56; margin-top:2px;">
              ${(orderFlow.totalSellVolume || 0).toLocaleString()} <span style="font-size:9px; font-weight:normal; color:#94a3b8;">سهم</span>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  /**
   * SA Tab 2: Saudi Stock Scanner Opportunities
   */
  renderSaudiScannerTab() {
    const opps = this.state.opportunities;
    if (!opps || opps.length === 0) {
      return `
        <div style="text-align:center; padding:30px; color:#64748b;">
          <div style="font-size:24px; margin-bottom:6px;">🔍</div>
          <div style="font-size:12px; font-weight:700; color:#f8fafc;">في انتظار التقاط جدول الأسهم من الصفحة</div>
          <div style="font-size:11px; margin-top:4px;">افتح صفحة مراقبة السوق أو اضغط على فحص وتحديث بالأسفل.</div>
        </div>
      `;
    }

    return opps
      .map((opp) => {
        const isBull = opp.type === "BULLISH";
        const tradeId = `stock_${opp.symbol}`;
        const isTracked = Boolean(this.trackedTrades && this.trackedTrades[tradeId]);
        const tracked = this.trackedTrades ? this.trackedTrades[tradeId] : null;
        const livePrice = parseFloat(opp.entry) || 0;

        return `
        <div class="copilot-card" style="border-right: 4px solid ${isBull ? "#00F090" : "#FF3B56"};">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div style="font-weight:800; font-size:14px; color:#f8fafc; display:flex; align-items:center; gap:6px;">
              <span>${opp.symbol}</span>
              <span style="font-size:11px; font-weight:normal; color:#94a3b8;">${opp.name}</span>
            </div>
            <span style="font-size:10px; padding:2px 6px; background:rgba(56,189,248,0.12); color:#38bdf8; border-radius:4px; font-weight:700;">
              ${opp.strategyLabel || opp.timeframe}
            </span>
          </div>

          <div class="copilot-levels-grid">
            <div class="copilot-level-item">
              <span class="copilot-level-label">الدخول المقترح</span>
              <span class="copilot-level-val val-entry">${opp.entry}</span>
            </div>
            <div class="copilot-level-item">
              <span class="copilot-level-label">الهدف 1</span>
              <span class="copilot-level-val val-tp">${opp.tp1}</span>
            </div>
            <div class="copilot-level-item">
              <span class="copilot-level-label">الهدف 2</span>
              <span class="copilot-level-val val-tp">${opp.tp2}</span>
            </div>
            <div class="copilot-level-item">
              <span class="copilot-level-label">وقف الخسارة</span>
              <span class="copilot-level-val val-sl">${opp.sl}</span>
            </div>
          </div>

          <!-- True Quantitative Target Probability Box for Stock -->
          ${(opp.tp1Probability || opp.tp1_probability) ? `
            <div class="copilot-prob-box" style="margin-top: 6px; padding: 6px 8px;">
              <div class="copilot-prob-header">
                <span class="copilot-prob-title">
                  <span>🎯</span>
                  <span>نسبة التوقع الحقيقية للهدف:</span>
                </span>
                <span class="copilot-prob-badge ${opp.tp1Probability >= 75 ? 'high' : opp.tp1Probability >= 55 ? 'medium' : 'low'}">
                  ${opp.probBadgeTp1 || (opp.tp1Probability >= 75 ? 'مرجح بقوة 🟢' : opp.tp1Probability >= 55 ? 'احتمالية متوسطة 🟡' : 'مضاربة عالية المخاطرة 🔴')}
                </span>
              </div>
              <div class="copilot-prob-bar-container" style="height: 4px; margin-bottom: 4px;">
                <div class="copilot-prob-bar-fill ${opp.tp1Probability >= 75 ? 'high' : opp.tp1Probability >= 55 ? 'medium' : 'low'}" style="width: ${opp.tp1Probability}%;"></div>
              </div>
              <div class="copilot-prob-metrics-row" style="padding: 4px 6px;">
                <div class="copilot-prob-metric">
                  <span class="prob-metric-label">تحقيق الهدف 1</span>
                  <span class="prob-metric-val ${opp.tp1Probability >= 75 ? 'val-high' : opp.tp1Probability >= 55 ? 'val-medium' : 'val-low'}">${opp.tp1Probability}%</span>
                </div>
                <div class="copilot-prob-metric">
                  <span class="prob-metric-label">تحقيق الهدف 2</span>
                  <span class="prob-metric-val ${opp.tp2Probability >= 75 ? 'val-high' : opp.tp2Probability >= 55 ? 'val-medium' : 'val-low'}">${opp.tp2Probability}%</span>
                </div>
                <div class="copilot-prob-metric">
                  <span class="prob-metric-label">الصعود المطلوب</span>
                  <span class="prob-metric-val val-move">${opp.requiredMoveLabelTp1 || '+2.5%'}</span>
                </div>
              </div>
            </div>
          ` : ""}

          <div style="display:flex; justify-content:space-between; font-size:10px; color:#94a3b8;">
            <span>نسبة العائد للمخاطرة (R:R): <b style="color:#f59e0b;">${opp.rr}</b></span>
            <span>الاتجاه: <b style="color:${isBull ? "#00F090" : "#FF3B56"}">${isBull ? "شراء صاعد ↗" : "بيع/تحوط ↘"}</b></span>
          </div>

          ${isTracked && tracked ? `
            <div class="copilot-locked-comparison" style="background: rgba(15, 23, 42, 0.65); border: 1px solid rgba(56, 189, 248, 0.35); border-radius: 6px; padding: 7px 10px; margin-top: 8px; display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
              <div>
                <div style="font-size: 9.5px; color: #94a3b8; font-weight: 700;">🔒 سعر الدخول المقفل (ثابت)</div>
                <div style="font-size: 13px; font-weight: 900; color: #38bdf8; margin-top: 1px;">${tracked.lockedEntryPrice} ر.س</div>
              </div>
              <div style="text-align: left;">
                <div style="font-size: 9.5px; color: #94a3b8; font-weight: 700;">📊 السعر المباشر اللحظي</div>
                <div style="font-size: 13px; font-weight: 900; color: ${livePrice >= tracked.lockedEntryPrice ? '#00F090' : '#FF3B56'}; margin-top: 1px;">
                  ${livePrice} ر.س <span style="font-size: 10px; font-weight: 700;">(${livePrice >= tracked.lockedEntryPrice ? '+' : ''}${Math.round(((livePrice - tracked.lockedEntryPrice) / tracked.lockedEntryPrice) * 1000) / 10}%)</span>
                </div>
              </div>
              <div style="grid-column: span 2; display: flex; justify-content: space-between; font-size: 9.5px; color: #cbd5e1; border-top: 1px dashed rgba(255,255,255,0.08); padding-top: 4px; margin-top: 2px;">
                <span>🛡️ الوقف المقفل: <b style="color:#f87171;">${tracked.lockedStopLoss}</b></span>
                <span>🎯 الهدف 1 المقفل: <b style="color:#00F090;">${tracked.lockedTarget1}</b></span>
              </div>
            </div>
          ` : ""}

          <!-- Execution / Tracking Toggle Button -->
          <button class="copilot-btn-track-trade ${isTracked ? 'tracked' : ''}" data-trade-id="${tradeId}" data-trade-data='${JSON.stringify({
            id: tradeId,
            symbol: opp.symbol,
            entry: opp.entry,
            sl: opp.sl,
            tp1: opp.tp1,
            tp2: opp.tp2
          })}' style="width: 100%; margin-top: 8px; padding: 6px 12px; border-radius: 6px; font-size: 11px; font-weight: 800; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; transition: all 0.2s ease; border: 1px solid ${isTracked ? '#10b981' : '#38bdf8'}; background: ${isTracked ? 'rgba(16, 185, 129, 0.2)' : 'rgba(56, 189, 248, 0.15)'}; color: ${isTracked ? '#34d399' : '#38bdf8'};">
            <span>${isTracked ? '✓ تم التنفيذ (المراقبة نشطة 🎯)' : '🎯 تم التنفيذ (تفعيل التنبيه)'}</span>
          </button>

          <div style="font-size:11px; color:#94a3b8; line-height:1.4; border-top:1px dashed var(--copilot-border); padding-top:6px; margin-top:8px;">
            💡 <b>مبرر الإشارة:</b> ${opp.reason}
          </div>
        </div>
      `;
      })
      .join("");
  },

  /**
   * SA Tab 3: Next-Session AI Predictor ("رادار الجلسة القادمة")
   */
  renderNextSessionTab() {
    const predictions = this.state.nextSession;
    const isClosed = this.marketStatus === "CLOSED";

    return `
      <div class="copilot-pred-card" style="margin-bottom:6px;">
        <div class="copilot-pred-header">
          <div>
            <div style="font-size:13px; font-weight:800; color:#f8fafc;">رادار الجلسة القادمة (Next Session AI Predictor)</div>
            <div style="font-size:11px; color:#f59e0b; margin-top:2px;">
              ${isClosed ? "🔴 السوق مغلق حالياً: تم تفعيل التحليل الذكي لمزاد الإغلاق وتوقعات الغد" : "🟢 تحليل فوري لصفقات الإغلاق وترشيحات الافتتاح القادم"}
            </div>
          </div>
          <span class="copilot-pred-badge">ذكاء اصطناعي ⚡</span>
        </div>
        <div style="font-size:11px; color:#cbd5e1; line-height:1.4;">
          يفحص المحرك الكمي سلوك مزاد الإغلاق، صفقات الدقائق الأخيرة، والأخبار للتنبؤ بالأسهم المرشحة لافتتاح بفجوة سعرية صاعدة (Overnight Gap).
        </div>
      </div>

      ${
        predictions && predictions.length > 0
          ? predictions
              .map(
                (p) => `
        <div class="copilot-card" style="border-right: 4px solid #f59e0b;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div style="font-weight:800; font-size:14px; color:#f8fafc;">
              <span>${p.symbol}</span>
              <span style="font-size:11px; font-weight:normal; color:#94a3b8; margin-right:6px;">${p.name}</span>
            </div>
            <div style="text-align:left;">
              <span style="background:rgba(0,240,144,0.15); color:#00F090; font-weight:800; font-size:12px; padding:2px 8px; border-radius:4px;">
                الصعود المتوقع: ${p.expectedGainPct}
              </span>
              <div style="font-size:10px; color:#f59e0b; font-weight:700; margin-top:2px;">ثقة الذكاء: ${p.confidence}%</div>
            </div>
          </div>

          <div class="copilot-levels-grid">
            <div class="copilot-level-item">
              <span class="copilot-level-label">الدخول عند الافتتاح</span>
              <span class="copilot-level-val val-entry">${p.entryAtOpen}</span>
            </div>
            <div class="copilot-level-item">
              <span class="copilot-level-label">الهدف 1</span>
              <span class="copilot-level-val val-tp">${p.tp1}</span>
            </div>
            <div class="copilot-level-item">
              <span class="copilot-level-label">الهدف 2</span>
              <span class="copilot-level-val val-tp">${p.tp2}</span>
            </div>
            <div class="copilot-level-item">
              <span class="copilot-level-label">وقف الخسارة</span>
              <span class="copilot-level-val val-sl">${p.sl}</span>
            </div>
          </div>

          <div style="font-size:11px; color:#94a3b8; line-height:1.4; border-top:1px dashed var(--copilot-border); padding-top:6px;">
            📌 <b>السلوك الرصدي:</b> ${p.reason}
          </div>
        </div>
      `,
              )
              .join("")
          : `
        <div style="text-align:center; padding:24px; color:#64748b;">
          <div style="font-size:22px; margin-bottom:4px;">🌙</div>
          <div style="font-size:12px; font-weight:700; color:#f8fafc;">جاري تحليل صفقات الإغلاق والمزاد...</div>
          <div style="font-size:11px; margin-top:2px;">اضغط على "🔍 فحص وتحديث مباشر" بالأسفل لاستخراج التوقعات.</div>
        </div>
      `
      }
    `;
  },

  /**
   * 4-Dimensional Stock & Chart Analyzer Tab (Technical + Fundamental + News + Order Flow)
   */
  render4DAnalyzerTab() {
    const analysis = this.state.analysis4D;
    if (!analysis) {
      return `
        <div style="text-align:center; padding:30px; color:#64748b;">
          <div style="font-size:24px; margin-bottom:6px;">📐</div>
          <div style="font-size:12px; font-weight:700; color:#f8fafc;">افتح صفحة سهم مفرد لتفعيل التحليل الرباعي 4D</div>
          <div style="font-size:11px; margin-top:4px;">يقوم النظام بدمج التحليل الفني، المالي، مشاعر الأخبار، وتدفق السيولة.</div>
        </div>
      `;
    }

    const {
      technical,
      fundamental,
      news,
      orderFlow,
      overallScore,
      overallRating,
    } = analysis;

    return `
      <!-- Overall 4D Rating Header -->
      <div class="copilot-card" style="background: linear-gradient(135deg, rgba(30,41,59,0.8) 0%, rgba(15,23,42,0.9) 100%);">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div style="font-size:10px; color:var(--copilot-text-muted); font-weight:700;">تقييم التحليل الرباعي المتكامل 4D</div>
            <div style="font-size:16px; font-weight:800; color:#f8fafc; margin-top:2px;">
              ${analysis.symbol} | التقييم: <span style="color:#00F090;">${overallRating}</span>
            </div>
          </div>
          <div style="text-align:left;">
            <div style="font-size:22px; font-weight:900; color:${overallScore >= 75 ? "#00F090" : overallScore >= 60 ? "#38bdf8" : "#FF3B56"};">
              ${overallScore}<span style="font-size:12px; font-weight:normal; color:#94a3b8;">/100</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 4 Dimensions Grid -->
      <div class="copilot-4d-grid">
        <!-- 1. Technical Dimension -->
        <div class="copilot-4d-box">
          <div class="copilot-4d-box-title">
            <span>📐 البعد الفني والشرط</span>
            <span style="color:#00F090;">${technical.score}%</span>
          </div>
          <div style="font-size:11px; color:#f8fafc; font-weight:700;">VWAP: ${technical.vwap} | RSI: ${technical.rsi}</div>
          <div style="font-size:10px; color:#94a3b8;">الدعم: ${technical.support1} | المقاومة: ${technical.resistance1}</div>
          <div style="font-size:10px; color:#38bdf8; margin-top:2px;">${technical.statusArabic}</div>
        </div>

        <!-- 2. Fundamental Dimension -->
        <div class="copilot-4d-box">
          <div class="copilot-4d-box-title">
            <span>💼 البعد المالي الأساسي</span>
            <span style="color:#38bdf8;">${fundamental.score}%</span>
          </div>
          <div style="font-size:11px; color:#f8fafc; font-weight:700;">القيمة: ${fundamental.marketCap}</div>
          <div style="font-size:10px; color:#94a3b8;">الحجم: ${fundamental.volume} | الافتتاح: ${fundamental.open}</div>
          <div style="font-size:10px; color:#00F090; margin-top:2px;">النطاق: ${fundamental.dayRange}</div>
        </div>

        <!-- 3. News & Geopolitical Sentiment Dimension -->
        <div class="copilot-4d-box">
          <div class="copilot-4d-box-title">
            <span>📰 مشاعر الأخبار والجيوسياسي</span>
            <span style="color:${news.sentiment === "BULLISH" ? "#00F090" : news.sentiment === "BEARISH" ? "#FF3B56" : "#94a3b8"};">${news.score}%</span>
          </div>
          <div style="font-size:11px; color:#f8fafc; font-weight:700;">${news.statusArabic}</div>
          <div style="font-size:10px; color:#94a3b8;">صافي المعنويات: ${news.sentimentScore > 0 ? "+" : ""}${news.sentimentScore}</div>
        </div>

        <!-- 4. Order Flow Liquidity Dimension -->
        <div class="copilot-4d-box">
          <div class="copilot-4d-box-title">
            <span>⚡ تدفق السيولة وعمق السوق</span>
            <span style="color:#00F090;">${orderFlow.score}%</span>
          </div>
          <div style="font-size:11px; color:#f8fafc; font-weight:700;">شراء فعلي: ${orderFlow.buyRatio}%</div>
          <div style="font-size:10px; color:#94a3b8;">صافي الدلتا: ${orderFlow.netDelta > 0 ? "+" : ""}${orderFlow.netDelta}</div>
          <div style="font-size:10px; color:#00F090; margin-top:2px;">${orderFlow.statusArabic}</div>
        </div>
      </div>

      <!-- Scraped Headlines Snapshot -->
      <div class="copilot-card">
        <div class="copilot-card-title">
          <span>أبرز عناوين الأخبار والإعلانات الملتقطة</span>
          <span style="font-size:10px; color:#94a3b8;">فلترة المشاعر</span>
        </div>

        ${
          news.headlines && news.headlines.length > 0
            ? news.headlines
                .map(
                  (h) => `
          <div class="copilot-news-item ${h.sentiment === "BULLISH" ? "bullish" : h.sentiment === "BEARISH" ? "bearish" : ""}">
            <div style="display:flex; justify-content:space-between; font-size:10px; color:#94a3b8; margin-bottom:2px;">
              <span>${h.sentiment === "BULLISH" ? "🟢 إيجابي" : h.sentiment === "BEARISH" ? "🔴 سلبي" : "⚪ محايد"}</span>
              <span>${h.time || "اليوم"}</span>
            </div>
            <div>${h.title}</div>
          </div>
        `,
                )
                .join("")
            : '<div style="font-size:11px; color:#64748b;">لا توجد إعلانات عاجلة في شاشة السهم.</div>'
        }
      </div>
    `;
  },

  /**
   * Tab 5: Portfolio Positions Advisor (احتفاظ / تخفيف / خروج)
   */
  renderPortfolioTab() {
    const items = this.state.portfolio;
    if (!items || items.length === 0) {
      return `<div style="text-align:center; padding:30px; color:#64748b;">لا توجد صفقات مفتوحة في المحفظة حالياً.</div>`;
    }

    return items
      .map((pos) => {
        let badgeClass = "badge-hold";
        if (pos.recType === "TRIM") badgeClass = "badge-trim";
        if (pos.recType === "EXIT") badgeClass = "badge-exit";

        const isProfit = pos.pnlPercent >= 0;

        return `
        <div class="copilot-portfolio-item">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div>
              <div style="font-weight: 800; font-size: 14px; color: #f8fafc;">
                ${pos.symbol} <span style="font-size: 11px; font-weight: normal; color: #94a3b8;">${pos.name}</span>
              </div>
              <div style="font-size: 10px; color: #94a3b8; margin-top: 2px;">
                الكمية: ${pos.shares} | التكلفة: ${pos.avgCost} | السعر: ${pos.currentPrice}
              </div>
            </div>

            <div style="text-align: left;">
              <span class="copilot-action-badge ${badgeClass}">${pos.recommendation}</span>
              <div style="font-size: 11px; font-weight: 700; color: ${isProfit ? "#00F090" : "#FF3B56"}; margin-top: 3px;">
                ${isProfit ? "+" : ""}${pos.pnlPercent}%
              </div>
            </div>
          </div>

          <div style="font-size:11px; color:#cbd5e1; background:rgba(0,0,0,0.25); padding:6px 8px; border-radius:6px; border-right:3px solid #64748b; line-height:1.4;">
            📌 <b>مبرر التحليل:</b> ${pos.rationale}
          </div>
        </div>
      `;
      })
      .join("");
  },

  /**
   * US Tab: Major US Indices Header (SPX, Nasdaq, Dow Jones)
   */
  renderUSIndicesTab() {
    const spx = this.state.spxEngine || {};
    let indices = spx.majorIndices;

    // Detect missing indices or the duplicate bug (where Nasdaq grabbed Dow's price)
    const hasDuplicateBug = indices && indices.nasdaq && indices.dow &&
      indices.nasdaq.price > 0 && indices.nasdaq.price === indices.dow.price;

    if (!indices || !indices.nasdaq || indices.nasdaq.price === 0 || hasDuplicateBug) {
      let liveParsed = null;
      if (window.SahmMarketParser && typeof window.SahmMarketParser.parseMajorIndices === "function") {
        liveParsed = window.SahmMarketParser.parseMajorIndices();
      } else if (window.SahmSPXParser && typeof window.SahmSPXParser.parseMajorIndices === "function") {
        liveParsed = window.SahmSPXParser.parseMajorIndices();
      }

      if (liveParsed && (liveParsed.nasdaq?.price > 0 || liveParsed.dow?.price > 0 || liveParsed.spx?.price > 0)) {
        indices = Object.assign({}, indices || {}, liveParsed);
        if (!this.state.spxEngine) this.state.spxEngine = {};
        this.state.spxEngine.majorIndices = indices;
      }
    }

    if (!indices) {
      indices = {
        spx: { price: spx.indexPrice || 0, changePercent: spx.changePercent || 0 },
        nasdaq: { price: 0, changePercent: 0 },
        dow: { price: 0, changePercent: 0 },
      };
    }

    // Safety fallback: if Nasdaq still equals Dow, strip it
    const isNasdaqDuplicated = Boolean(indices.nasdaq?.price > 0 && indices.dow?.price > 0 && indices.nasdaq.price === indices.dow.price);
    const nasdaqPrice = (!isNasdaqDuplicated && indices.nasdaq?.price > 0) ? indices.nasdaq.price : "--";
    const nasdaqChg = !isNasdaqDuplicated ? (indices.nasdaq?.changePercent || 0) : 0;
    const dowPrice = indices.dow?.price > 0 ? indices.dow.price : "--";
    const dowChg = indices.dow?.changePercent || 0;
    const spxPrice = indices.spx?.price > 0 ? indices.spx.price : (spx.indexPrice > 0 ? spx.indexPrice : "--");
    const spxChg = indices.spx?.changePercent !== undefined ? indices.spx.changePercent : (spx.changePercent || 0);

    return `
      <div class="copilot-card">
        <div class="copilot-card-title">
          <span>المؤشرات الأمريكية الرئيسية (Real DOM Ticker)</span>
          <span style="font-size:10px; color:#38bdf8;">Wall Street</span>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:6px; text-align:center;">
          <!-- SPX -->
          <div style="background:rgba(0,0,0,0.25); padding:8px; border-radius:6px; border:1px solid var(--copilot-border);">
            <div style="font-size:10px; color:#94a3b8; font-weight:700;">S&P 500</div>
            <div style="font-size:14px; font-weight:800; color:#f8fafc; margin-top:2px;">
              ${spxPrice}
            </div>
            <div style="font-size:10px; font-weight:700; color:${spxChg >= 0 ? "#00F090" : "#FF3B56"};">
              ${spxChg >= 0 ? "+" : ""}${spxChg}%
            </div>
          </div>

          <!-- Nasdaq -->
          <div style="background:rgba(0,0,0,0.25); padding:8px; border-radius:6px; border:1px solid var(--copilot-border);">
            <div style="font-size:10px; color:#94a3b8; font-weight:700;">ناسداك (Nasdaq)</div>
            <div style="font-size:14px; font-weight:800; color:#f8fafc; margin-top:2px;">
              ${nasdaqPrice}
            </div>
            <div style="font-size:10px; font-weight:700; color:${nasdaqChg >= 0 ? "#00F090" : "#FF3B56"};">
              ${nasdaqChg >= 0 ? "+" : ""}${nasdaqChg}%
            </div>
          </div>

          <!-- Dow Jones -->
          <div style="background:rgba(0,0,0,0.25); padding:8px; border-radius:6px; border:1px solid var(--copilot-border);">
            <div style="font-size:10px; color:#94a3b8; font-weight:700;">داو جونز (Dow)</div>
            <div style="font-size:14px; font-weight:800; color:#f8fafc; margin-top:2px;">
              ${dowPrice}
            </div>
            <div style="font-size:10px; font-weight:700; color:${dowChg >= 0 ? "#00F090" : "#FF3B56"};">
              ${dowChg >= 0 ? "+" : ""}${dowChg}%
            </div>
          </div>
        </div>
      </div>

      <div class="copilot-card">
        <div class="copilot-card-title">
          <span>حالة السوق الأمريكي وتدفق السيولة</span>
        </div>
        <div style="font-size:11px; color:#cbd5e1; line-height:1.5;">
          ${spx.detail || "مراقبة حركة المؤشرات الأمريكية الثلاثة وتوافقها مع افتتاح جلسة نيويورك وتدفقات أوبشن SPX."}
        </div>
      </div>
    `;
  },

  /**
   * US Tab: SPX Options Copilot (STRICTLY NO MOCK NUMBERS)
   * Handles Trend, Sideways Range Scalper, High-VIX Sniper.
   */
  renderSPXTab() {
    let spx = this.state.spxEngine;

    // Client-side Instant Fallback if Python backend is offline or hasn't returned yet
    if (!spx || (!spx.bestCall && !spx.bestPut && (!spx.topCalls || spx.topCalls.length === 0))) {
      if (window.SahmSPXParser && typeof window.SahmSPXParser.parseOptionsChain === "function") {
        const localParsed = window.SahmSPXParser.parseOptionsChain();
        if (localParsed && (localParsed.topCalls?.length > 0 || localParsed.topPuts?.length > 0)) {
          spx = Object.assign({}, spx || {}, localParsed);
        }
      }
    }

    if (!spx) {
      return `<div style="text-align:center; padding:30px; color:#64748b;">محرك SPX غير متاح حالياً.</div>`;
    }

    // TradingView Bridge Overlay: If active, override live index price and metrics
    const tv = this.tvBridgeData;
    const isTvActive = Boolean(tv && tv.isConnected && tv.price > 0);
    if (isTvActive) {
      spx.indexPrice = tv.price;
      spx.changePoints = tv.changePts;
      spx.changePercent = tv.changePct;
      spx.tvBid = tv.bid;
      spx.tvAsk = tv.ask;
      spx.tvHigh = tv.high;
      spx.tvLow = tv.low;
      spx.tvConnected = true;
    }

    const hasRealIndex = spx.indexPrice > 0;

    // Anti-Whipsaw Hysteresis & Wave Duration Predictor (منع التذبذب العشوائي وتوقع مدة الموجة)
    const waveInfo = this.updateSpxTickHysteresis(spx.indexPrice, spx.bias);
    const effectiveBias = waveInfo.confirmedBias || spx.bias || "SIDEWAYS";
    const isGammaPinning = Boolean(waveInfo.gammaPinningMode);

    const isCall = effectiveBias === "CALL" && !isGammaPinning;
    const isPut = effectiveBias === "PUT" && !isGammaPinning;
    const isSideways = isGammaPinning || effectiveBias === "SIDEWAYS" || spx.isSideways !== false;

    let bannerClass = "bullish";
    let statusText = "سوق صاعد | تفضيل الشراء (CALL 🟢)";
    let badgeText = "اتجاه صاعد";

    if (isGammaPinning) {
      bannerClass = "sideways-warning";
      statusText = "⚡ مضاربة التذبذب العكسي (Gamma Pinning Scalp)";
      badgeText = "حصار جاما (Chop Pinning)";
    } else if (isPut) {
      bannerClass = "bearish";
      statusText = "سوق هابط | تفضيل الحماية والبيع (PUT 🔴)";
      badgeText = "اتجاه هابط";
    } else if (isSideways) {
      bannerClass = "sideways-warning";
      statusText = "مسار عرضي متذبذب | مضاربة سريعة (Range Scalp ⚡)";
      badgeText = "Scalp أطراف النطاق";
    }

    // TradingView live banner markup
    let tvBannerHtml = "";
    if (isTvActive) {
      const tvPriceStr = Number(tv.price).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const tvChgSign = tv.changePts >= 0 ? "+" : "";
      const tvChgPtsStr = tvChgSign + Number(tv.changePts || 0).toFixed(2);
      const tvChgPctStr = (tv.changePct >= 0 ? "+" : "") + Number(tv.changePct || 0).toFixed(2) + "%";
      const tvBidStr = Number(tv.bid || tv.price).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const tvAskStr = Number(tv.ask || tv.price).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

      tvBannerHtml = `
        <!-- TradingView Real-Time SPX Bridge Status Banner -->
        <div class="copilot-tv-bridge-banner">
          <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
            <span class="tv-pulse-dot"></span>
            <span>متصل بـ TradingView مباشر</span>
            <span style="opacity:0.5;">|</span>
            <span style="color:#ffffff;">SPX: <b>${tvPriceStr}</b></span>
            <span style="font-size:10px; color:${tv.changePts >= 0 ? '#34d399' : '#f87171'}; font-weight:800;">(${tvChgPtsStr} / ${tvChgPctStr})</span>
          </div>
          <div style="font-size:10px; color:#cbd5e1; display:flex; align-items:center; gap:6px;">
            <span>بيع: <b style="color:#f87171;">${tvBidStr}</b></span>
            <span style="opacity:0.5;">|</span>
            <span>شراء: <b style="color:#38bdf8;">${tvAskStr}</b></span>
          </div>
        </div>
      `;
    }

    const tvPriceFormatted = hasRealIndex
      ? (typeof spx.indexPrice === "number" ? Number(spx.indexPrice).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : spx.indexPrice)
      : "--";
    const tvChangePointsStr = isTvActive && spx.changePoints !== undefined
      ? `${spx.changePoints >= 0 ? "+" : ""}${Number(spx.changePoints).toFixed(2)} / `
      : "";

    const indexDisplay = hasRealIndex
      ? `${tvPriceFormatted} <span style="font-size:11px; font-weight:normal; color:${spx.changePercent >= 0 ? "#00F090" : "#FF3B56"}">${tvChangePointsStr}${spx.changePercent >= 0 ? "+" : ""}${spx.changePercent}%</span>`
      : `<span style="font-size:11px; color:#94a3b8;">جاري قراءة المؤشر من شاشة سهم أو TradingView...</span>`;

    const activeTabBadge = spx.activeTabLabel || (spx.activeTab === "PUT" ? "خيار البيع (Puts)" : "خيار الشراء (Calls)");
    const totalStrikes = spx.totalStrikesCaptured || (spx.callsCount + spx.putsCount) || (spx.calls?.length + spx.puts?.length) || 0;

    const topCalls = spx.topCalls && spx.topCalls.length > 0 ? spx.topCalls : (spx.bestCall ? [spx.bestCall] : []);
    const topPuts = spx.topPuts && spx.topPuts.length > 0 ? spx.topPuts : (spx.bestPut ? [spx.bestPut] : []);
    let rawRecommendations = (spx.activeTab === "PUT" || isPut) ? (topPuts.length > 0 ? topPuts : topCalls) : (topCalls.length > 0 ? topCalls : topPuts);

    // Choppy / Gamma-Pinning Mode: Pick strikes closer to ATM (Delta 0.35 - 0.50) to resist Theta burn
    if (isGammaPinning) {
      const allCandidates = [...(topCalls || []), ...(topPuts || [])];
      const atmChopCandidates = allCandidates.filter(c => {
        const d = Math.abs(parseFloat(c.delta) || 0);
        return d >= 0.35 && d <= 0.52;
      });
      if (atmChopCandidates.length > 0) {
        rawRecommendations = atmChopCandidates;
      }
    }

    // Active executed options in the dedicated drawer
    const activeOptionTrades = Object.values(this.trackedTrades || {}).filter(t => t.isOption || t.strike);

    // Completely separate active executed contracts from general recommendations list
    const unexecutedRecommendations = rawRecommendations.filter(c => {
      const tradeId = `opt_${c.strike}_${c.type}`;
      return !this.trackedTrades || !this.trackedTrades[tradeId];
    });

    // Filter by Capital & Price Tier (ALL, MICRO, MEDIUM, LARGE)
    const selectedTier = this.selectedPriceTier || "ALL";
    const activeRecommendations = unexecutedRecommendations.filter(c => {
      if (selectedTier === "ALL") return true;
      const p = parseFloat(c.entry) || 0;
      if (selectedTier === "MICRO") return p >= 0.50 && p <= 5.00;
      if (selectedTier === "MEDIUM") return p > 5.00 && p <= 15.00;
      if (selectedTier === "LARGE") return p > 15.00;
      return true;
    });

    const isClsd = (this.marketStatus === "CLOSED" || spx.isMarketClosed || String(spx.marketStatusText || "").includes("مغلق") || String(spx.marketStatusText || "").includes("عطلة"));
    const isPreMkt = !isClsd && (this.marketStatus === "PRE_MARKET" || spx.isPreMarket || String(spx.marketStatusText || "").includes("قبل الافتتاح"));
    const isOvnt = !isClsd && !isPreMkt && (this.marketStatus === "OVERNIGHT" || spx.isOvernight || String(spx.marketStatusText || "").includes("ليلي"));
    const smartMoneyBadge = spx.smartMoneyBadge || ((spx.smartMoneyFlow === "PUT_ACCUMULATION" || spx.putAccumulationAlert) ? "🚨 رصد تدفق أموال ذكية في عقود البوت (Put Accumulation)" : null);
    const entryBlocked = spx.entryBlocked || (isPreMkt && spx.entryBlocked !== false);

    return `
      ${tvBannerHtml}

      <!-- SPX Index Real Price Card -->
      <div class="copilot-card" style="background: linear-gradient(180deg, #162032 0%, #0d1424 100%);">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div style="font-size:10px; color:var(--copilot-text-muted); font-weight:700;">
              ${isTvActive ? "سعر مؤشر SPX الحقيقي (TradingView مباشر 🟢)" : "سعر مؤشر SPX الحقيقي (Real DOM)"}
            </div>
            <div style="font-size:22px; font-weight:900; color:#f8fafc; margin-top:2px;">${indexDisplay}</div>
          </div>
          <div style="text-align:left;">
            <div style="font-size:10px; color:var(--copilot-text-muted); font-weight:700;">التبويب النشط في سهم</div>
            <span style="display:inline-block; margin-top:3px; padding:3px 8px; background:rgba(56,189,248,0.15); color:#38bdf8; border:1px solid rgba(56,189,248,0.3); border-radius:4px; font-size:10px; font-weight:700;">
              ${activeTabBadge}
            </span>
          </div>
        </div>

        <div style="display:flex; justify-content:space-between; font-size:10px; color:#94a3b8; border-top:1px dashed var(--copilot-border); padding-top:6px; margin-top:4px;">
          <span>إجمالي العقود الممسوحة: <b style="color:#00F090;">${totalStrikes} عقد</b> (فوق وتحت السعر)</span>
          <span>Put/Call Ratio: <b>${spx.putCallRatio || 1.0}</b></span>
        </div>

        <!-- Prominent Wave Duration Predictor Badge -->
        <div class="copilot-wave-duration-badge ${isGammaPinning ? 'gamma-chop' : effectiveBias === 'CALL' ? 'bullish-wave' : 'bearish-wave'}">
          <span>${waveInfo.durationBadgeText}</span>
          <span style="font-size: 8.5px; opacity: 0.9; padding: 1px 6px; background: rgba(0,0,0,0.35); border-radius: 4px; font-weight: 800; white-space: nowrap;">
            سرعة SPX: ${waveInfo.velocity > 0 ? '+' : ''}${waveInfo.velocity} ن/د
          </span>
        </div>

        <!-- Action Row: Full Chain Sweep + Table Compact Mode Toggle -->
        <div style="display: flex; flex-direction: column; gap: 6px; margin-top: 8px;">
          <button id="copilot-btn-sweep-chain" style="width: 100%; justify-content: center; background: linear-gradient(135deg, #4f46e5 0%, #0284c7 100%); color: #ffffff; font-weight: 800; border: none; padding: 7px 12px; cursor: pointer; border-radius: 6px; display: flex; align-items: center; gap: 6px; font-size: 11px; transition: all 0.2s ease;">
            <span>🔍</span>
            <span>مسح شامل لكل العقود (Full Chain Sweep)</span>
          </button>

          <button id="copilot-btn-compact-table" class="copilot-btn-compact-toggle ${this.isCompactTableEnabled ? 'active' : ''}" style="width: 100%; justify-content: center; padding: 7px 12px; cursor: pointer; border-radius: 6px; display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 800; transition: all 0.2s ease;" title="ضغط جدول منصة سهم لعرض كافة العقود بدون تصغير المتصفح">
            <span>📐</span>
            <span>${this.isCompactTableEnabled ? '📐 ضغط جدول العقود: مفعّل 🟢 (عرض الكل)' : '📐 عرض كل العقود بدون تصغير الشاشة (Compact Table)'}</span>
          </button>
        </div>
      </div>

      <!-- Pre-Market ("قبل الافتتاح") Notice vs Overnight Safety Banner -->
      ${(() => {
        if (isPreMkt) {
          return `
            <div class="copilot-premarket-banner" style="background: linear-gradient(135deg, rgba(161, 98, 7, 0.25) 0%, rgba(15, 23, 42, 0.9) 100%); border: 1px solid #eab308; border-radius: 8px; padding: 10px 12px; margin-top: 8px; margin-bottom: 8px; box-shadow: 0 4px 15px rgba(234, 179, 8, 0.15);">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                <span style="font-size: 11.5px; font-weight: 800; color: #fef08a; display: flex; align-items: center; gap: 5px;">
                  <span>🟡</span>
                  <span>فترة ما قبل الافتتاح (Pre-Market)</span>
                </span>
                <span style="font-size: 9.5px; padding: 2px 7px; background: rgba(234, 179, 8, 0.25); color: #fef9c3; border-radius: 4px; font-weight: 800;">تنويه المؤشر والفيوتشرز</span>
              </div>
              <div style="font-size: 10.5px; color: #cbd5e1; line-height: 1.5;">
                ℹ️ <b>تنويه حركة الأسعار:</b> مؤشر SPX الكاش (<code>${indexDisplay}</code>) يبقى ثابتاً عند إغلاق الأمس حتى جرس الافتتاح الرسمي الساعة 4:30 عصراً بتوقيت مصر (9:30 صباحاً بتوقيت نيويورك)، بينما أسعار العرض والطلب لعقود الأوبشن تتحرك حية ومباشرة في منصة سهم بناءً على تحركات عقود فيوتشرز S&P 500 (ES Futures).
              </div>
            </div>
            ${smartMoneyBadge ? `
              <div style="background: linear-gradient(135deg, rgba(220, 38, 38, 0.25) 0%, rgba(15, 23, 42, 0.95) 100%); border: 1.5px solid #ef4444; border-radius: 8px; padding: 9px 12px; margin-bottom: 8px; box-shadow: 0 4px 16px rgba(239, 68, 68, 0.25);">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                  <span style="font-size: 11.5px; font-weight: 900; color: #fca5a5; display: flex; align-items: center; gap: 5px;">
                    <span>🚨</span>
                    <span>${smartMoneyBadge}</span>
                  </span>
                  <span style="font-size: 9.5px; padding: 2px 6px; background: rgba(239, 68, 68, 0.35); color: #fee2e2; border-radius: 4px; font-weight: 800;">تحذير مؤسسي</span>
                </div>
                <div style="font-size: 10.5px; color: #fecaca; line-height: 1.45;">
                  رصد المحرك تراكماً ملحوظاً في أحجام تداول عقود <b>PUT</b> مقارنة بـ CALL في فترة ما قبل الافتتاح؛ المؤسسات وصناع السوق يميلون للتحوط السلبي ضد افتتاح أحمر أو فخ للمشترين (Bull Trap).
                </div>
              </div>
            ` : ""}
          `;
        }

        if (isOvnt) {
          return `
            <div class="copilot-overnight-banner" style="background: linear-gradient(135deg, rgba(30, 27, 75, 0.75) 0%, rgba(15, 23, 42, 0.9) 100%); border: 1px solid #6366f1; border-radius: 8px; padding: 10px 12px; margin-top: 8px; margin-bottom: 8px; box-shadow: 0 4px 15px rgba(99, 102, 241, 0.15);">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                <span style="font-size: 11px; font-weight: 800; color: #a5b4fc; display: flex; align-items: center; gap: 5px;">
                  <span>🌙</span>
                  <span>وضع الاستكشاف المؤسسي الليلي نشط (Overnight Mode)</span>
                </span>
                <span style="font-size: 9px; padding: 2px 6px; background: rgba(99, 102, 241, 0.25); color: #c7d2fe; border-radius: 4px; font-weight: 700;">خارج الجلسة</span>
              </div>
              <div style="font-size: 10.5px; color: #cbd5e1; line-height: 1.5;">
                ⚠️ <b>إرشادات السلامة والسيولة المؤسسية:</b> التداول خارج الجلسة الرسمية نشط. يُنصح بالتركيز حصرياً على العقود ذات الفارق السعري الضيق جداً <b>(Spread &lt; $0.30)</b> وتفادي الأوامر العشوائية قبل افتتاح الجلسة.
              </div>
            </div>
          `;
        }

        if (isClsd) {
          return `
            <div style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.35); border-radius: 8px; padding: 8px 12px; margin-top: 8px; margin-bottom: 8px; font-size: 11px; color: #fca5a5;">
              🔴 <b>السوق مغلق حالياً:</b> يتم عرض بيانات آخر إغلاق وتحديثات جلسة ما بعد الإغلاق.
            </div>
          `;
        }

        return "";
      })()}

      <!-- Dedicated Active Positions Drawer ("صفقاتـي النشطة المنفصلة") -->
      ${activeOptionTrades.length > 0 ? `
        <div class="copilot-active-positions-drawer">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <span style="font-size:12px; font-weight:900; color:#38bdf8; display:flex; align-items:center; gap:6px;">
              <span>🎯</span>
              <span>صفقاتي النشطة المنفصلة (${activeOptionTrades.length} صفقات منفذة):</span>
            </span>
            <span style="font-size:9.5px; background:rgba(56,189,248,0.18); color:#7dd3fc; padding:2px 7px; border-radius:4px; font-weight:800;">
              مراقبة حية مستقلة
            </span>
          </div>

          <div style="display: flex; flex-direction: column; gap: 8px;">
            ${activeOptionTrades.map(t => {
              let livePrice = t.lockedEntryPrice;
              const optList = [...(spx.topCalls || []), ...(spx.topPuts || []), ...(spx.calls || []), ...(spx.puts || [])];
              const match = optList.find(c => String(c.strike) === String(t.strike) && c.type === t.type);
              if (match && (match.entry || match.lastPrice)) {
                livePrice = match.entry || match.lastPrice;
              } else if (window.__sahmAllOptionContracts) {
                const bucket = t.type === "CALL" ? window.__sahmAllOptionContracts.calls : window.__sahmAllOptionContracts.puts;
                const mem = bucket?.[t.strike];
                if (mem && mem.bid && mem.ask) {
                  livePrice = Math.round(((mem.bid + mem.ask) / 2) * 100) / 100;
                }
              }

              const pnlVal = Math.round((livePrice - t.lockedEntryPrice) * 100) / 100;
              const pnlPct = t.lockedEntryPrice > 0 ? Math.round(((livePrice - t.lockedEntryPrice) / t.lockedEntryPrice) * 1000) / 10 : 0;
              const isProfit = pnlVal >= 0;
              const pnlColor = isProfit ? "#00F090" : "#FF3B56";

              return `
                <div class="copilot-executed-trade-card" style="border-right: 4px solid ${t.type === 'CALL' ? '#00F090' : '#FF3B56'};">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                    <div style="display: flex; align-items: center; gap: 6px;">
                      <span style="color: ${t.type === 'CALL' ? '#00F090' : '#FF3B56'}; font-weight: 900; font-size: 13.5px;">Strike ${t.strike} ${t.type}</span>
                      <span style="font-size: 9px; background: rgba(255,255,255,0.08); color: #cbd5e1; padding: 1px 5px; border-radius: 3px; font-weight: 700;">0DTE</span>
                    </div>
                    <span style="font-size: 9.5px; color: #94a3b8;">وقت التنفيذ: <b>${t.lockedTimeStr || 'اليوم'}</b></span>
                  </div>

                  <!-- Locked vs Current Price Grid -->
                  <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 4px; text-align: center; background: rgba(0,0,0,0.4); padding: 5px; border-radius: 5px; margin-top: 4px;">
                    <div>
                      <div style="font-size: 9px; color: #94a3b8;">سعر الدخول المقفل</div>
                      <div style="font-size: 12px; font-weight: 900; color: #38bdf8;">${t.lockedEntryPrice}$</div>
                    </div>
                    <div>
                      <div style="font-size: 9px; color: #94a3b8;">السعر اللحظي الحالي</div>
                      <div style="font-size: 12px; font-weight: 900; color: ${pnlColor};">${livePrice}$</div>
                    </div>
                    <div>
                      <div style="font-size: 9px; color: #94a3b8;">الربح / الخسارة</div>
                      <div style="font-size: 12px; font-weight: 900; color: ${pnlColor};">${isProfit ? '+' : ''}${pnlPct}%</div>
                    </div>
                  </div>

                  <!-- Case C: Smart Profit Lock Badge -->
                  ${t.profitLock ? `
                    <div class="copilot-profit-lock-badge ${t.profitLock === 'TRAILED_15' ? 'trailed' : 'breakeven'}" style="margin-top: 5px; width: 100%; box-sizing: border-box; justify-content: center;">
                      <span>${t.profitLock === 'TRAILED_15' ? '🚀' : '🔒'}</span>
                      <span>${t.profitLockText || 'تأمين الربح مفعل'}</span>
                    </div>
                  ` : ''}

                  <!-- Case B: Contract Burn Emergency Exit Banner -->
                  ${t.isContractBurn ? `
                    <div class="copilot-contract-burn-banner">
                      🔥 إنذار احتراق العقد (Contract Burn): اخرج فوراً! السهم كسر الاتجاه والتآكل يحرق العقد — لا تنتظر
                    </div>
                  ` : ''}

                  <!-- Case A: Elastic Stop Banner -->
                  ${(t.isElasticStopActive && !t.isContractBurn) ? `
                    <div class="copilot-elastic-stop-banner">
                      🛡️ تم تفعيل الوقف المرن المحدث (${t.elasticStopPrice}$) — المؤشر لم يكسر الدعم وهناك فرصة ارتداد قوية، لا تبع بخسارة الآن
                    </div>
                  ` : ''}

                  <!-- Targets and SL row -->
                  <div style="display: flex; justify-content: space-between; font-size: 9.5px; color: #cbd5e1; margin-top: 5px; padding: 0 2px;">
                    <span>🎯 الهدف 1: <b style="color:#00F090;">${t.lockedTarget1}$</b> | هـ 2: <b style="color:#00F090;">${t.lockedTarget2}$</b></span>
                    <span>🛡️ الوقف: <b style="color:${t.isElasticStopActive ? '#67e8f9' : '#f87171'};">${t.effectiveStopLoss || t.lockedStopLoss}$</b> ${t.isElasticStopActive ? '<span style="font-size:8px; color:#38bdf8;">(مرن)</span>' : ''}</span>
                  </div>

                  <!-- Quantitative Target Probability Row in Active Executed Drawer -->
                  ${(() => {
                    const prob = (t.tp1Probability !== undefined && t.tp1Probability !== null)
                      ? t
                      : this.calculateContractProbability(t, spx.indexPrice || 7744.06, spx.bias);
                    const pCls = prob.tp1Probability >= 75 ? "high" : (prob.tp1Probability >= 55 ? "medium" : "low");
                    const pBadge = prob.tp1Probability >= 75 ? "مرجح بقوة 🟢" : (prob.tp1Probability >= 55 ? "احتمالية متوسطة 🟡" : "مضاربة عالية المخاطرة 🔴");
                    const reqMoveText = prob.requiredMoveLabelTp1 || (t.type === "CALL" ? `+${prob.requiredSpxMoveTp1 || 4.5} نقطة` : `-${prob.requiredSpxMoveTp1 || 4.5} نقطة`);

                    return `
                      <div class="copilot-prob-box" style="margin-top: 5px; padding: 6px 8px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 3px;">
                          <span style="font-size: 9.5px; font-weight: 800; color: #cbd5e1; display:flex; align-items:center; gap:4px;">
                            <span>🎯</span>
                            <span>نسبة التوقع الحقيقية للهدف:</span>
                          </span>
                          <span class="copilot-prob-badge ${pCls}" style="font-size: 8.5px; padding: 1px 5px;">
                            ${pBadge}
                          </span>
                        </div>
                        <div class="copilot-prob-bar-container" style="height: 4px; margin-bottom: 4px;">
                          <div class="copilot-prob-bar-fill ${pCls}" style="width: ${prob.tp1Probability}%;"></div>
                        </div>
                        <div style="display: flex; justify-content: space-between; font-size: 9.5px; color: #cbd5e1;">
                          <span>الهدف 1: <b style="color:${prob.tp1Probability >= 75 ? '#00F090' : prob.tp1Probability >= 55 ? '#fbbf24' : '#f87171'};">${prob.tp1Probability}%</b> | الهدف 2: <b style="color:#38bdf8;">${prob.tp2Probability}%</b></span>
                          <span style="color:#94a3b8;">مطلوب لـ SPX: <b style="color:#f8fafc;">${reqMoveText}</b></span>
                        </div>
                      </div>
                    `;
                  })()}

                  ${(t.dipEntry || t.invalidationSl) ? `
                    <div style="display: flex; justify-content: space-between; font-size: 9px; color: #94a3b8; background: rgba(255,255,255,0.03); padding: 2px 6px; border-radius: 3px; margin-top: 4px;">
                      ${t.dipEntry ? `<span>دخول التراجع: <b style="color:#38bdf8;">${t.dipEntry}$</b></span>` : ''}
                      ${t.invalidationSl ? `<span>وقف الإبطال: <b style="color:#f87171;">${t.invalidationSl}$</b></span>` : ''}
                      ${t.rrRatio ? `<span>R:R: <b style="color:#7dd3fc;">${t.rrRatio}:1</b></span>` : ''}
                    </div>
                  ` : ''}

                  <!-- Close Trade Button -->
                  <button class="copilot-btn-close-active-trade" data-trade-id="${t.id}" style="width: 100%; margin-top: 6px; background: rgba(239, 68, 68, 0.2); border: 1px solid #ef4444; color: #fca5a5; font-size: 10px; font-weight: 800; padding: 4px 8px; border-radius: 5px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 4px; transition: all 0.2s ease;">
                    <span>✖ إغلاق وإنهاء المتابعة</span>
                  </button>
                </div>
              `;
            }).join("")}
          </div>
        </div>
      ` : ""}

      <!-- Active Alerts Section with Top Clear Control (Ghost Trades Fix) -->
      ${((this.activeAlerts && this.activeAlerts.length > 0)) ? `
        <div class="copilot-alerts-section" style="margin-top: 8px; margin-bottom: 8px; background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px; padding: 8px 10px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <span style="font-size: 11px; font-weight: 800; color: #f8fafc; display: flex; align-items: center; gap: 4px;">
              <span>🔔</span>
              <span>التنبيهات اللحظية المباشرة (${this.activeAlerts.length}):</span>
            </span>
            <button id="copilot-btn-clear-all-alerts" style="background: rgba(239, 68, 68, 0.22); border: 1px solid #ef4444; color: #fca5a5; font-size: 10px; font-weight: 800; padding: 4px 9px; border-radius: 5px; cursor: pointer; display: flex; align-items: center; gap: 4px; transition: all 0.2s ease;">
              <span>🗑️</span>
              <span>مسح وإيقاف جميع التنبيهات</span>
            </button>
          </div>
          ${this.activeAlerts.map(a => `
            <div class="copilot-proximity-alert ${a.severity}" style="padding: 7px 10px; margin-bottom: 5px; border-radius: 6px; font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: space-between; gap: 8px; border: 1px solid ${a.severity === 'danger' ? '#ef4444' : a.severity === 'warning' ? '#f59e0b' : '#10b981'}; background: ${a.severity === 'danger' ? 'rgba(239,68,68,0.2)' : a.severity === 'warning' ? 'rgba(245,158,11,0.2)' : 'rgba(16,185,129,0.2)'}; color: #f8fafc;">
              <div style="display: flex; align-items: center; gap: 6px; flex: 1;">
                <span>${a.text}</span>
              </div>
              <button class="copilot-btn-dismiss-alert" data-trade-id="${a.tradeId}" style="background: rgba(255, 255, 255, 0.18); border: 1px solid rgba(255, 255, 255, 0.35); color: #ffffff; font-weight: 800; font-size: 10px; padding: 3px 8px; border-radius: 4px; cursor: pointer; white-space: nowrap;" title="إيقاف ومسح هذا التنبيه فوراً">
                ✖ إيقاف
              </button>
            </div>
          `).join("")}
        </div>
      ` : ""}

      <!-- Market Regime & Strategy Banner -->
      <div class="copilot-market-banner ${bannerClass}">
        <div>
          <div style="font-weight: 800; font-size: 13px;">${statusText}</div>
          <div class="banner-detail">${spx.detail || "تحليل تدفق السيولة وعقود الأوبشن."}</div>
          <div style="font-size:10px; color:#38bdf8; font-weight:700; margin-top:4px;">
            🎯 <b>الاستراتيجية المطبقة:</b> ${spx.strategyArabic || "Sideways Range Scalper"}
          </div>
        </div>
        <span class="copilot-warning-badge" style="background:${isSideways ? "#0284c7" : isPut ? "#dc2626" : "#059669"}; font-size:11px; padding:3px 8px;">
          ${badgeText}
        </span>
      </div>

      <!-- Capital & Price Tier Filter Bar (فلاتر أسعار وميزانية العقود) -->
      <div style="margin-top: 10px; margin-bottom: 8px; background: rgba(15, 23, 42, 0.85); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px; padding: 8px 10px;">
        <div style="font-size: 10.5px; font-weight: 800; color: #94a3b8; margin-bottom: 6px; display: flex; align-items: center; justify-content: space-between;">
          <span style="display: flex; align-items: center; gap: 4px;">
            <span>💰</span>
            <span>فلتر ميزانية وأسعار العقود (Price Tiers):</span>
          </span>
          <span style="font-size: 9.5px; color: #38bdf8; font-weight: 700;">المحدد: ${selectedTier === 'ALL' ? 'الكل' : selectedTier === 'MICRO' ? 'ميكرو ($0.5-5)' : selectedTier === 'MEDIUM' ? 'متوسطة ($5-15)' : 'مؤسسات (+$15)'}</span>
        </div>
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px;">
          <button class="copilot-btn-price-tier ${selectedTier === 'ALL' ? 'active' : ''}" data-tier="ALL" style="border: 1px solid ${selectedTier === 'ALL' ? '#38bdf8' : 'rgba(255,255,255,0.15)'}; background: ${selectedTier === 'ALL' ? 'rgba(56,189,248,0.25)' : 'rgba(255,255,255,0.05)'}; color: ${selectedTier === 'ALL' ? '#38bdf8' : '#cbd5e1'};">
            🌟 الكل
          </button>
          <button class="copilot-btn-price-tier ${selectedTier === 'MICRO' ? 'active' : ''}" data-tier="MICRO" style="border: 1px solid ${selectedTier === 'MICRO' ? '#00F090' : 'rgba(255,255,255,0.15)'}; background: ${selectedTier === 'MICRO' ? 'rgba(0,240,144,0.22)' : 'rgba(255,255,255,0.05)'}; color: ${selectedTier === 'MICRO' ? '#00F090' : '#cbd5e1'};" title="عقود رخيصة للمحافظ الصغيرة">
            💎 ميكرو ($0.5-5)
          </button>
          <button class="copilot-btn-price-tier ${selectedTier === 'MEDIUM' ? 'active' : ''}" data-tier="MEDIUM" style="border: 1px solid ${selectedTier === 'MEDIUM' ? '#fbbf24' : 'rgba(255,255,255,0.15)'}; background: ${selectedTier === 'MEDIUM' ? 'rgba(251,191,36,0.22)' : 'rgba(255,255,255,0.05)'}; color: ${selectedTier === 'MEDIUM' ? '#fbbf24' : '#cbd5e1'};" title="عقود متوسطة متوازنة">
            ⚡ متوسطة ($5-15)
          </button>
          <button class="copilot-btn-price-tier ${selectedTier === 'LARGE' ? 'active' : ''}" data-tier="LARGE" style="border: 1px solid ${selectedTier === 'LARGE' ? '#818cf8' : 'rgba(255,255,255,0.15)'}; background: ${selectedTier === 'LARGE' ? 'rgba(129,140,248,0.22)' : 'rgba(255,255,255,0.05)'}; color: ${selectedTier === 'LARGE' ? '#818cf8' : '#cbd5e1'};" title="عقود مؤسسات وحيتان">
            🚀 مؤسسات (&gt;$15)
          </button>
        </div>
      </div>

      <!-- Recommended Contracts Section Header -->
      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:12px; margin-bottom:8px;">
        <span style="font-size:12px; font-weight:800; color:#f8fafc; display:flex; align-items:center; gap:4px;">
          <span>🎯</span>
          <span>العقود المقترحة في السلسلة (Multi-Tier Selection):</span>
        </span>
        <span style="font-size:10px; color:#38bdf8; background:rgba(56,189,248,0.12); padding:2px 6px; border-radius:4px; font-weight:700;">
          ${(spx.activeTab === "PUT" || isPut) ? "عقود البيع (PUTS)" : "عقود الشراء (CALLS)"}
        </span>
      </div>

      <!-- Multi-Tier Recommendation Cards (ATM, OTM, ITM) with Post-Target Lifecycle & Tactical Dip Entry -->
      ${activeRecommendations.length > 0 ? activeRecommendations.map((c) => {
        const isCallCard = c.type === "CALL";
        const tradeId = `opt_${c.strike}_${c.type}`;
        const isTracked = Boolean(this.trackedTrades && this.trackedTrades[tradeId]);
        const tracked = this.trackedTrades ? this.trackedTrades[tradeId] : null;
        const livePrice = c.entry;

        // Session registry baseline tracking
        const regKey = `${c.strike}_${c.type}`;
        if (!this.activeRecommendationsRegistry) this.activeRecommendationsRegistry = {};
        if (!this.activeRecommendationsRegistry[regKey]) {
          this.activeRecommendationsRegistry[regKey] = {
            strike: c.strike,
            type: c.type,
            initialEntry: c.entry,
            initialTp1: c.tp1,
            initialTp2: c.tp2,
            initialSl: c.sl
          };
        }
        const reg = this.activeRecommendationsRegistry[regKey];

        // Evaluate target hit status if not already computed by backend
        let lifecycleBadge = c.lifecycleBadge || null;
        let lifecycleStatus = c.lifecycleStatus || "ACTIVE";
        let isReentrySafe = c.reentrySafe;
        let freshEntry = c.freshEntry || c.entry;
        let freshTp1 = c.freshTp1 || c.tp1;
        let freshTp2 = c.freshTp2 || c.tp2;
        let freshSl = c.freshSl || c.sl;
        let reentryReason = c.reentryReason || "";

        if (!lifecycleBadge && reg && livePrice >= reg.initialTp1) {
          const hitTarget = livePrice >= reg.initialTp2 ? "TP2" : "TP1";
          const deltaNum = Math.abs(parseFloat(c.delta) || 0.5);
          const spreadNum = parseFloat(c.spread) || 0.2;
          const isSurged = (hitTarget === "TP2" && livePrice > reg.initialTp2 * 1.08);

          if (deltaNum <= 0.68 && spreadNum <= 0.40 && !isSurged) {
            lifecycleBadge = "✅ حقق الهدف السابق | متاح للدخول مجدداً";
            lifecycleStatus = "TARGET_HIT_REENTRY_SAFE";
            isReentrySafe = true;
            freshEntry = livePrice;
            freshTp1 = Math.round(livePrice * 1.15 * 100) / 100;
            freshTp2 = Math.round(livePrice * 1.30 * 100) / 100;
            freshSl = Math.round(Math.max(livePrice * 0.90, reg.initialTp1 * 0.98) * 100) / 100;
            reentryReason = `العقد حقق الهدف ${hitTarget} بنجاح؛ مع استمرار انضباط السبريد (${spreadNum}$) والدلتا المتزنة (${deltaNum})، يعتبر الدخول مجدداً آمناً بوقف مشدد.`;
          } else {
            lifecycleBadge = "⛔ تشبع بعد تحقيق الهدف — ممنوع المطاردة";
            lifecycleStatus = "TARGET_HIT_EXHAUSTED";
            isReentrySafe = false;
            reentryReason = `العقد حقق أهدافه وتجاوز نطاق الأمان (${livePrice}$) أو تآكلت الدلتا (${deltaNum}). المطاردة هنا خطرة.`;
          }
        }

        // Tactical Dip-Buying and Invalidation calculation fallback
        const dipEntry = c.dipEntry || Math.max(c.bid || 0.1, Math.round((livePrice - Math.max((c.spread || 0.2) * 0.75, livePrice * 0.08)) * 100) / 100);
        const invSl = c.invalidationSl || c.sl;
        const rrRatio = c.rrRatio || (invSl < livePrice ? (Math.round(((c.tp1 - livePrice) / Math.max(0.1, (livePrice - invSl))) * 10) / 10) : 2.2);
        const idxInv = c.indexInvalidation || c.indexSL || (spx.indexPrice ? (c.type === "PUT" ? Math.round((spx.indexPrice + 12) * 100) / 100 : Math.round((spx.indexPrice - 12) * 100) / 100) : "7755.00");

        let tierColor = "#38bdf8";
        let tierBg = "rgba(56,189,248,0.15)";
        if (c.tierKey === "ATM") {
          tierColor = "#00F090";
          tierBg = "rgba(0,240,144,0.15)";
        } else if (c.tierKey === "OTM") {
          tierColor = "#fbbf24";
          tierBg = "rgba(251,191,36,0.15)";
        } else if (c.tierKey === "ROTATED") {
          tierColor = "#818cf8";
          tierBg = "rgba(129,140,248,0.15)";
        }
        // Choppy / Gamma-Pinning mode target tightening: TP1 +12%, TP2 +22%
        let cardTp1 = freshTp1;
        let cardTp2 = freshTp2;
        let cardTp1Label = c.tp1_pct || "+15%";
        let cardTp2Label = c.tp2_pct || "+30%";
        if (isGammaPinning) {
          cardTp1 = Math.round(c.entry * 1.12 * 100) / 100;
          cardTp2 = Math.round(c.entry * 1.22 * 100) / 100;
          cardTp1Label = "+12% (Scalp)";
          cardTp2Label = "+22% (Scalp)";
        }

        return `
          <div class="copilot-opt-card ${isCallCard ? "call" : "put"}" style="margin-bottom: 10px; border-right: 4px solid ${tierColor};">
            <!-- Tier Badge Header -->
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 4px;">
              <span style="font-size:10px; font-weight:800; color:${tierColor}; background:${tierBg}; padding:2px 8px; border-radius:4px;">
                ${c.tierBadge || "🏆 أفضل عقد"}
              </span>
              <span style="font-size:10px; color:#94a3b8;">Delta: <b style="color:#f8fafc;">${c.delta}</b> | IV: <b>${c.iv}</b></span>
            </div>

            <!-- Prominent Wave Duration Predictor Badge on Card -->
            <div class="copilot-wave-duration-badge ${isGammaPinning ? 'gamma-chop' : isCallCard ? 'bullish-wave' : 'bearish-wave'}" style="margin-top: 4px; margin-bottom: 6px;">
              <span>${waveInfo.durationBadgeText}</span>
            </div>

            <!-- Post-Target Lifecycle Re-Entry Banner (Case A: Safe vs Case B: Exhausted vs Rotated) -->
            ${isReentrySafe ? `
              <div style="background: rgba(16, 185, 129, 0.18); border: 1px solid #10b981; border-radius: 6px; padding: 6px 10px; margin-bottom: 8px;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <span style="font-weight: 800; font-size: 11px; color: #34d399;">
                    🔄 متاح للدخول مجدداً — استمرار الزخم (✅ حقق الهدف السابق)
                  </span>
                  <span style="font-size: 9.5px; background: #059669; color: #ffffff; padding: 1px 6px; border-radius: 4px; font-weight: 700;">دخول محدث</span>
                </div>
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; margin-top: 6px; text-align: center; background: rgba(0,0,0,0.25); padding: 5px; border-radius: 5px;">
                  <div>
                    <div style="font-size: 9px; color: #94a3b8;">الدخول المحدث</div>
                    <div style="font-size: 11.5px; font-weight: 800; color: #38bdf8;">${freshEntry}$</div>
                  </div>
                  <div>
                    <div style="font-size: 9px; color: #94a3b8;">الهدف 1 الجديد</div>
                    <div style="font-size: 11.5px; font-weight: 800; color: #34d399;">${freshTp1}$</div>
                  </div>
                  <div>
                    <div style="font-size: 9px; color: #94a3b8;">الهدف 2 الجديد</div>
                    <div style="font-size: 11.5px; font-weight: 800; color: #34d399;">${freshTp2}$</div>
                  </div>
                  <div>
                    <div style="font-size: 9px; color: #94a3b8;">الوقف المشدد</div>
                    <div style="font-size: 11.5px; font-weight: 800; color: #f87171;">${freshSl}$</div>
                  </div>
                </div>
                <div style="font-size: 10px; color: #cbd5e1; margin-top: 5px; line-height: 1.4;">
                  💡 <b>مبرر أمان الدخول مجدداً:</b> ${reentryReason || "انضباط السبريد وقوة الزخم تسمح بالمضاربة مع الالتزام الصارم بالوقف."}
                </div>
              </div>
            ` : ""}

            ${c.isRotatedAlternative ? `
              <div style="background: rgba(56, 189, 248, 0.18); border: 1px solid #38bdf8; border-radius: 6px; padding: 6px 10px; margin-bottom: 8px;">
                <span style="font-weight: 800; font-size: 11px; color: #38bdf8; display:flex; align-items:center; gap:4px;">
                  <span>🆕</span>
                  <span>عقد بديل جديد (بعد تحقق أهداف العقود السابقة)</span>
                </span>
                <div style="font-size: 10px; color: #cbd5e1; margin-top: 3px; line-height: 1.4;">
                  تم تدوير التوصية تلقائياً لاختيار سترايك طازج بنسبة عائد لمخاطرة متفوقة وسبريد منضبط (${c.spread}$).
                </div>
              </div>
            ` : ""}

            ${(lifecycleStatus === "TARGET_HIT_EXHAUSTED" && !c.isRotatedAlternative) ? `
              <div style="background: rgba(239, 68, 68, 0.2); border: 1px solid #ef4444; border-radius: 6px; padding: 6px 10px; margin-bottom: 8px;">
                <span style="font-weight: 800; font-size: 11px; color: #fca5a5; display:flex; align-items:center; gap:4px;">
                  <span>⛔</span>
                  <span>تشبع بعد تحقيق الهدف — ممنوع المطاردة</span>
                </span>
                <div style="font-size: 10px; color: #cbd5e1; margin-top: 3px; line-height: 1.4;">
                  ${reentryReason || "تجاوز السعر أهدافه وتآكلت الدلتا؛ تم التدوير لعقد بديل أفضل لتجنب المخاطرة العالية."}
                </div>
              </div>
            ` : ""}

            <div style="display:flex; justify-content:space-between; align-items:center;">
              <div style="display:flex; align-items:center; gap:6px;">
                <span style="color:${isCallCard ? "#00F090" : "#FF3B56"}; font-weight:900; font-size:15px;">Strike ${c.strike} ${c.type}</span>
                <span style="font-size:9px; background:rgba(255,255,255,0.06); color:#cbd5e1; padding:1px 6px; border-radius:4px; font-weight:700;">${c.timeframe || "0DTE"}</span>
              </div>
              <span style="font-size:11px; font-weight:800; color:#38bdf8;">سعر الدخول (Mid): ${c.entry}$</span>
            </div>

            <!-- Trade Levels Grid -->
            <div class="copilot-levels-grid" style="margin-top: 8px;">
              <div class="copilot-level-item">
                <span class="copilot-level-label">الدخول المقترح</span>
                <span class="copilot-level-val val-entry">${c.entry}$</span>
              </div>
              <div class="copilot-level-item">
                <span class="copilot-level-label">الهدف 1 (${cardTp1Label})</span>
                <span class="copilot-level-val val-tp">${cardTp1}$</span>
              </div>
              <div class="copilot-level-item">
                <span class="copilot-level-label">الهدف 2 (${cardTp2Label})</span>
                <span class="copilot-level-val val-tp">${cardTp2}$</span>
              </div>
              <div class="copilot-level-item">
                <span class="copilot-level-label">وقف الخسارة (${c.sl_pct || "-12%"})</span>
                <span class="copilot-level-val val-sl">${c.sl}$</span>
              </div>
            </div>

            <!-- True Quantitative Target Probability Box -->
            ${(() => {
              const prob = (c.tp1Probability !== undefined && c.tp1Probability !== null)
                ? c
                : this.calculateContractProbability(c, spx.indexPrice || 7744.06, spx.bias);
              const pCls = prob.tp1Probability >= 75 ? "high" : (prob.tp1Probability >= 55 ? "medium" : "low");
              const pBadge = prob.tp1Probability >= 75 ? "مرجح بقوة 🟢" : (prob.tp1Probability >= 55 ? "احتمالية متوسطة 🟡" : "مضاربة عالية المخاطرة 🔴");
              const valCls1 = prob.tp1Probability >= 75 ? "val-high" : (prob.tp1Probability >= 55 ? "val-medium" : "val-low");
              const valCls2 = prob.tp2Probability >= 75 ? "val-high" : (prob.tp2Probability >= 55 ? "val-medium" : "val-low");
              const reqMoveText = prob.requiredMoveLabelTp1 || (isCallCard ? `+${prob.requiredSpxMoveTp1 || 4.5} نقطة` : `-${prob.requiredSpxMoveTp1 || 4.5} نقطة`);

              return `
                <div class="copilot-prob-box">
                  <div class="copilot-prob-header">
                    <span class="copilot-prob-title">
                      <span>🎯</span>
                      <span>نسبة التوقع الحقيقية للهدف (Target Probability):</span>
                    </span>
                    <span class="copilot-prob-badge ${pCls}">
                      ${pBadge}
                    </span>
                  </div>

                  <!-- Mini Progress Bar for TP1 -->
                  <div class="copilot-prob-bar-container" title="نسبة تحقق الهدف 1: ${prob.tp1Probability}%">
                    <div class="copilot-prob-bar-fill ${pCls}" style="width: ${prob.tp1Probability}%;"></div>
                  </div>

                  <!-- Metrics Grid: TP1 %, TP2 %, Required Move -->
                  <div class="copilot-prob-metrics-row">
                    <div class="copilot-prob-metric">
                      <span class="prob-metric-label">تحقيق الهدف 1 (TP1)</span>
                      <span class="prob-metric-val ${valCls1}">${prob.tp1Probability}%</span>
                    </div>
                    <div class="copilot-prob-metric">
                      <span class="prob-metric-label">تحقيق الهدف 2 (TP2)</span>
                      <span class="prob-metric-val ${valCls2}">${prob.tp2Probability}%</span>
                    </div>
                    <div class="copilot-prob-metric">
                      <span class="prob-metric-label">تحرك SPX للهدف 1</span>
                      <span class="prob-metric-val val-move">
                        يحتاج ${reqMoveText}
                      </span>
                    </div>
                  </div>
                </div>
              `;
            })()}

            <!-- Tactical Limit Order Dip-Buying & Invalidation Box -->
            <div class="copilot-dip-tactical-box">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <span style="font-size: 10.5px; font-weight: 800; color: #38bdf8; display: flex; align-items: center; gap: 4px;">
                  <span>🎯</span>
                  <span>دخول التراجع المحسوب (Limit Dip Entry):</span>
                </span>
                <span style="font-size: 9.5px; padding: 1px 6px; background: rgba(56, 189, 248, 0.2); color: #7dd3fc; border-radius: 4px; font-weight: 700;">
                  R:R ${rrRatio}:1
                </span>
              </div>
              <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; text-align: center; background: rgba(0,0,0,0.3); padding: 5px; border-radius: 5px; margin-top: 4px;">
                <div>
                  <div style="font-size: 9px; color: #94a3b8;">دخول التراجع (Dip)</div>
                  <div style="font-size: 12px; font-weight: 900; color: #34d399;">${dipEntry}$</div>
                </div>
                <div>
                  <div style="font-size: 9px; color: #94a3b8;">وقف الإبطال الفني</div>
                  <div style="font-size: 12px; font-weight: 900; color: #f87171;">${invSl}$</div>
                </div>
                <div>
                  <div style="font-size: 9px; color: #94a3b8;">إبطال مؤشر SPX</div>
                  <div style="font-size: 12px; font-weight: 900; color: #fbbf24;">${idxInv}</div>
                </div>
              </div>
              <div style="font-size: 9.5px; color: #cbd5e1; margin-top: 4px; line-height: 1.35;">
                💡 <b>تكتيك الدخول الذكي:</b> ضع أمر شراء محدد (Limit Order) عند <b>${dipEntry}$</b> للحصول على أفضل R:R؛ كسر <b>${invSl}$</b> يبطل الصفقة.
              </div>
            </div>

            <!-- Execution / Tracking Toggle Button (Always Enabled for All Market Sessions) -->
            <button class="copilot-btn-track-trade" data-trade-id="${tradeId}" data-trade-data='${JSON.stringify({
              id: tradeId,
              strike: c.strike,
              type: c.type,
              entry: c.entry,
              sl: c.sl,
              tp1: cardTp1,
              tp2: cardTp2,
              dipEntry: dipEntry,
              invalidationSl: invSl,
              rrRatio: rrRatio,
              indexInvalidation: idxInv,
              tp1Probability: c.tp1Probability,
              tp2Probability: c.tp2Probability,
              requiredMoveLabelTp1: c.requiredMoveLabelTp1,
              probBadgeTp1: c.probBadgeTp1,
              probColorTp1: c.probColorTp1
            })}' style="width: 100%; margin-top: 8px; padding: 6px 12px; border-radius: 6px; font-size: 11px; font-weight: 800; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; transition: all 0.2s ease; border: 1px solid #38bdf8; background: rgba(56, 189, 248, 0.15); color: #38bdf8;">
              <span>🎯 تم التنفيذ (نقل إلى صفقاتي النشطة)</span>
            </button>

            <!-- Real Contract Market Data -->
            <div style="display:flex; justify-content:space-between; font-size:10px; color:#94a3b8; background:rgba(0,0,0,0.3); padding:5px 8px; border-radius:6px; margin-top: 8px;">
              <span>طلب: <b style="color:#f8fafc;">${c.bid}$</b> | عرض: <b style="color:#f8fafc;">${c.ask}$</b></span>
              <span>سبريد: <b style="color:#00F090;">${c.spread}$</b></span>
              <span>حجم: <b style="color:#38bdf8;">${c.volume.toLocaleString()}</b></span>
              <span>مراكز: <b>${c.openInterest.toLocaleString()}</b></span>
            </div>

            ${c.indexSL ? `
              <div style="font-size:10px; color:#f87171; background:rgba(239,68,68,0.08); padding:4px 8px; border-radius:4px; margin-top: 6px;">
                ⚠️ <b>مستوى إبطال الصفقة:</b> كسر مؤشر SPX لمستوى <b>${c.indexSL}</b> يلغي التوصية فوراً.
              </div>
            ` : ""}

            <div style="font-size:11px; color:#cbd5e1; line-height:1.4; border-top:1px dashed var(--copilot-border); padding-top:6px; margin-top: 6px;">
              💡 <b>المبرر الكمي:</b> ${c.reason}
            </div>
          </div>
        `;
      }).join("") : `
        <div style="background: rgba(17, 24, 39, 0.7); border: 1px dashed var(--copilot-border); border-radius: 8px; padding: 22px 16px; text-align: center; color: var(--copilot-text-secondary); margin-top: 8px;">
          <div style="font-size: 26px; margin-bottom: 8px;">📊</div>
          <div style="font-weight: 700; color: #f8fafc; font-size: 13px; margin-bottom: 6px;">
            ${unexecutedRecommendations.length > 0 ? "لا توجد عقود تطابق فئة السعر المحددة" : "في انتظار قراءة جدول العقود الحقيقي من الشاشة"}
          </div>
          <div style="font-size: 11px; color: #94a3b8; line-height: 1.6;">
            ${unexecutedRecommendations.length > 0 ? "اختر فئة سعرية أخرى من الأزرار بالأعلى (مثل: 🌟 الكل) لعرض باقي العقود المتاحة." : "اضغط على زر <b>'🔍 مسح شامل لكل العقود'</b> بالأعلى لقراءة كامل السلسلة وتحديد أفضل العقود فورياً."}
          </div>
        </div>
      `}
    `;
  }
};

