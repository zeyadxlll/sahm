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

    this.attachEventListeners();
    this.renderStrategyPills();
    this.renderNavTabs();
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
   * Execution & Locked-In Entry Tracking Toggle
   * Takes a permanent immutable snapshot of entry, sl, tp1, tp2.
   * DO NOT update or overwrite this locked entry price even if live market prices fluctuate!
   */
  toggleTrackTrade(tradeData) {
    if (!tradeData) return;
    const id = tradeData.id || (tradeData.symbol ? `stock_${tradeData.symbol}` : `opt_${tradeData.strike}_${tradeData.type}`);

    if (this.trackedTrades && this.trackedTrades[id]) {
      delete this.trackedTrades[id];
      this.activeAlerts = (this.activeAlerts || []).filter(a => a.tradeId !== id);
    } else {
      if (!this.trackedTrades) this.trackedTrades = {};
      this.trackedTrades[id] = {
        id: id,
        symbol: tradeData.symbol || `SPX ${tradeData.strike} ${tradeData.type}`,
        strike: tradeData.strike,
        type: tradeData.type,
        isOption: Boolean(tradeData.strike),
        lockedEntryPrice: parseFloat(tradeData.entry) || 0,
        lockedStopLoss: parseFloat(tradeData.sl) || 0,
        lockedTarget1: parseFloat(tradeData.tp1) || 0,
        lockedTarget2: parseFloat(tradeData.tp2) || 0,
        lockedTimestamp: Date.now(),
        lockedTimeStr: new Date().toLocaleTimeString("ar-SA")
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
    }

    try {
      localStorage.setItem("sahm_tracked_trades", JSON.stringify(this.trackedTrades));
    } catch (e) {}

    this.checkProximityAlerts();
    this.render();
  },

  /**
   * Monitor live market prices against locked SL and targets ONLY for executed trades.
   */
  checkProximityAlerts() {
    if (!this.trackedTrades || Object.keys(this.trackedTrades).length === 0) {
      this.activeAlerts = [];
      return;
    }

    const newAlerts = [];
    const now = Date.now();
    const spx = this.state.spxEngine || {};

    for (const [id, trade] of Object.entries(this.trackedTrades)) {
      let currentPrice = null;

      if (trade.isOption) {
        const optList = [...(spx.topCalls || []), ...(spx.topPuts || []), ...(spx.calls || []), ...(spx.puts || [])];
        const match = optList.find(c => String(c.strike) === String(trade.strike) && c.type === trade.type);
        if (match) {
          currentPrice = match.entry || match.lastPrice || (match.bid && match.ask ? Math.round(((match.bid + match.ask) / 2) * 100) / 100 : null);
        } else if (window.__sahmAllOptionContracts) {
          const bucket = trade.type === "CALL" ? window.__sahmAllOptionContracts.calls : window.__sahmAllOptionContracts.puts;
          const mem = bucket?.[trade.strike];
          if (mem && mem.bid && mem.ask) {
            currentPrice = Math.round(((mem.bid + mem.ask) / 2) * 100) / 100;
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

      const sl = trade.lockedStopLoss;
      const tp1 = trade.lockedTarget1;
      const tp2 = trade.lockedTarget2;

      // 1. Stop Loss Breached
      if (sl > 0 && currentPrice <= sl) {
        newAlerts.push({
          tradeId: id,
          severity: "danger",
          type: "STOP_BREACH",
          text: `🚨 كسر وقف الخسارة المحمي: ${trade.symbol} وصل إلى ${currentPrice}$ (الوقف: ${sl}$)`,
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
                stopLoss: sl,
                pnlPct: pnlPct
              });
            }
          } catch (err) {}
        }
      }
      // 2. Stop Loss Critical Proximity (< 3%)
      else if (sl > 0 && currentPrice > sl && (currentPrice - sl) / sl <= 0.03) {
        newAlerts.push({
          tradeId: id,
          severity: "warning",
          type: "SL_PROXIMITY",
          text: `⚠️ اقتراب حرج من وقف الخسارة (< 3%): ${trade.symbol} بسعر ${currentPrice}$ (الوقف: ${sl}$)`,
          timestamp: now
        });
        if (!this.lastSoundTimes[id] || (now - this.lastSoundTimes[id] > 25000)) {
          this.lastSoundTimes[id] = now;
          this.playAlertSound("warning");
        }
      }

      // 3. Target 2 Reached
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
                stopLoss: sl,
                pnlPct: pnlPct
              });
            }
          } catch (err) {}
        }
      }
      // 4. Target 1 Reached
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
                stopLoss: sl,
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

    // Draggable logic
    dragHandle.addEventListener("mousedown", (e) => {
      this.dragState.isDragging = true;
      this.dragState.startX = e.clientX;
      this.dragState.startY = e.clientY;
      const rect = root.getBoundingClientRect();
      this.dragState.initialLeft = rect.left;
      this.dragState.initialTop = rect.top;
      e.preventDefault();
    });

    document.addEventListener("mousemove", (e) => {
      if (!this.dragState.isDragging) return;
      const deltaX = e.clientX - this.dragState.startX;
      const deltaY = e.clientY - this.dragState.startY;

      const newLeft = Math.max(
        10,
        Math.min(window.innerWidth - 460, this.dragState.initialLeft + deltaX),
      );
      const newTop = Math.max(
        10,
        Math.min(window.innerHeight - 200, this.dragState.initialTop + deltaY),
      );

      root.style.left = `${newLeft}px`;
      root.style.top = `${newTop}px`;
      root.style.right = "auto";
    });

    document.addEventListener("mouseup", () => {
      this.dragState.isDragging = false;
    });

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

    if (badge && textEl) {
      if (
        statusRaw === "CLOSED" ||
        statusRaw === false ||
        (typeof statusRaw === "string" && statusRaw.includes("مغلق"))
      ) {
        badge.className = "copilot-session-badge session-closed";
        const label =
          customText ||
          (this.activeMarket === "US"
            ? "سوق مغلق 🔴 (بيانات آخر إغلاق)"
            : "سوق مغلق 🔴");
        badge.innerHTML = `<span class="copilot-dot" style="background:#f59e0b;"></span><span>${label}</span>`;

        // If Saudi Market is closed, automatically switch to / highlight next session predictor tab!
        if (this.activeMarket === "SA" && this.activeTab !== "nextsession") {
          this.activeTab = "nextsession";
          this.renderNavTabs();
        }
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
   * Receive quant engine payload from Python backend
   */
  updateFromBackend(payload) {
    if (payload.marketState) this.state.marketState = payload.marketState;
    if (payload.orderFlow) this.state.orderFlow = payload.orderFlow;
    if (payload.opportunities) this.state.opportunities = payload.opportunities;
    if (payload.nextSession) this.state.nextSession = payload.nextSession;
    if (payload.analysis4D) this.state.analysis4D = payload.analysis4D;
    if (payload.portfolio) this.state.portfolio = payload.portfolio;
    if (payload.spxEngine) this.state.spxEngine = payload.spxEngine;

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
      timeEl.innerText = `تحديث: ${now.toLocaleTimeString("ar-SA")}`;
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
    const indices = spx.majorIndices || {
      spx: {
        price: spx.indexPrice || 0,
        changePercent: spx.changePercent || 0,
      },
      nasdaq: { price: 0, changePercent: 0 },
      dow: { price: 0, changePercent: 0 },
    };

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
              ${indices.spx?.price > 0 ? indices.spx.price : spx.indexPrice > 0 ? spx.indexPrice : "--"}
            </div>
            <div style="font-size:10px; font-weight:700; color:${indices.spx?.changePercent >= 0 ? "#00F090" : "#FF3B56"};">
              ${indices.spx?.changePercent >= 0 ? "+" : ""}${indices.spx?.changePercent || 0}%
            </div>
          </div>

          <!-- Nasdaq -->
          <div style="background:rgba(0,0,0,0.25); padding:8px; border-radius:6px; border:1px solid var(--copilot-border);">
            <div style="font-size:10px; color:#94a3b8; font-weight:700;">ناسداك (Nasdaq)</div>
            <div style="font-size:14px; font-weight:800; color:#f8fafc; margin-top:2px;">
              ${indices.nasdaq?.price > 0 ? indices.nasdaq.price : "--"}
            </div>
            <div style="font-size:10px; font-weight:700; color:${indices.nasdaq?.changePercent >= 0 ? "#00F090" : "#FF3B56"};">
              ${indices.nasdaq?.changePercent >= 0 ? "+" : ""}${indices.nasdaq?.changePercent || 0}%
            </div>
          </div>

          <!-- Dow Jones -->
          <div style="background:rgba(0,0,0,0.25); padding:8px; border-radius:6px; border:1px solid var(--copilot-border);">
            <div style="font-size:10px; color:#94a3b8; font-weight:700;">داو جونز (Dow)</div>
            <div style="font-size:14px; font-weight:800; color:#f8fafc; margin-top:2px;">
              ${indices.dow?.price > 0 ? indices.dow.price : "--"}
            </div>
            <div style="font-size:10px; font-weight:700; color:${indices.dow?.changePercent >= 0 ? "#00F090" : "#FF3B56"};">
              ${indices.dow?.changePercent >= 0 ? "+" : ""}${indices.dow?.changePercent || 0}%
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

    const hasRealIndex = spx.indexPrice > 0;
    const isCall = spx.bias === "CALL";
    const isPut = spx.bias === "PUT";
    const isSideways = spx.isSideways !== false;

    let bannerClass = "bullish";
    let statusText = "سوق صاعد | تفضيل الشراء (CALL 🟢)";
    let badgeText = "اتجاه صاعد";

    if (isPut) {
      bannerClass = "bearish";
      statusText = "سوق هابط | تفضيل الحماية والبيع (PUT 🔴)";
      badgeText = "اتجاه هابط";
    } else if (isSideways) {
      bannerClass = "sideways-warning";
      statusText = "مسار عرضي متذبذب | مضاربة سريعة (Range Scalp ⚡)";
      badgeText = "Scalp أطراف النطاق";
    }

    const indexDisplay = hasRealIndex
      ? `${spx.indexPrice} <span style="font-size:11px; font-weight:normal; color:${spx.changePercent >= 0 ? "#00F090" : "#FF3B56"}">${spx.changePercent >= 0 ? "+" : ""}${spx.changePercent}%</span>`
      : `<span style="font-size:11px; color:#94a3b8;">جاري قراءة المؤشر من شاشة سهم...</span>`;

    const activeTabBadge = spx.activeTabLabel || (spx.activeTab === "PUT" ? "خيار البيع (Puts)" : "خيار الشراء (Calls)");
    const totalStrikes = spx.totalStrikesCaptured || (spx.callsCount + spx.putsCount) || (spx.calls?.length + spx.puts?.length) || 0;

    const topCalls = spx.topCalls && spx.topCalls.length > 0 ? spx.topCalls : (spx.bestCall ? [spx.bestCall] : []);
    const topPuts = spx.topPuts && spx.topPuts.length > 0 ? spx.topPuts : (spx.bestPut ? [spx.bestPut] : []);
    const activeRecommendations = (spx.activeTab === "PUT" || isPut) ? (topPuts.length > 0 ? topPuts : topCalls) : (topCalls.length > 0 ? topCalls : topPuts);

    return `
      <!-- SPX Index Real Price Card -->
      <div class="copilot-card" style="background: linear-gradient(180deg, #162032 0%, #0d1424 100%);">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div style="font-size:10px; color:var(--copilot-text-muted); font-weight:700;">سعر مؤشر SPX الحقيقي (Real DOM)</div>
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

        <!-- Full Chain Sweep Trigger Button -->
        <button id="copilot-btn-sweep-chain" style="width: 100%; justify-content: center; margin-top: 8px; background: linear-gradient(135deg, #4f46e5 0%, #0284c7 100%); color: #ffffff; font-weight: 800; border: none; padding: 7px 12px; cursor: pointer; border-radius: 6px; display: flex; align-items: center; gap: 6px; font-size: 11px; transition: all 0.2s ease;">
          <span>🔍</span>
          <span>مسح شامل لكل العقود (Full Chain Sweep)</span>
        </button>
      </div>

      <!-- Overnight Safety / Extended Hours Scouting Mode Banner -->
      ${(spx.isMarketClosed || this.marketStatus === "CLOSED" || String(spx.marketStatusText || "").includes("ليلي") || String(spx.marketStatusText || "").includes("مغلق") || (typeof document !== "undefined" && document.body?.textContent?.includes("التداول الليلي"))) ? `
        <div class="copilot-overnight-banner" style="background: linear-gradient(135deg, rgba(30, 27, 75, 0.75) 0%, rgba(15, 23, 42, 0.9) 100%); border: 1px solid #6366f1; border-radius: 8px; padding: 10px 12px; margin-top: 8px; margin-bottom: 8px; box-shadow: 0 4px 15px rgba(99, 102, 241, 0.15);">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
            <span style="font-size: 11px; font-weight: 800; color: #a5b4fc; display: flex; align-items: center; gap: 5px;">
              <span>🌙</span>
              <span>وضع الاستكشاف المؤسسي الليلي نشط (Overnight Scouting Mode)</span>
            </span>
            <span style="font-size: 9px; padding: 2px 6px; background: rgba(99, 102, 241, 0.25); color: #c7d2fe; border-radius: 4px; font-weight: 700;">خارج الجلسة</span>
          </div>
          <div style="font-size: 10.5px; color: #cbd5e1; line-height: 1.5;">
            ⚠️ <b>إرشادات السلامة والسيولة المؤسسية:</b>
            التداول خارج الجلسة الرسمية نشط. يُنصح بالتركيز حصرياً على العقود ذات الفارق السعري الضيق جداً <b>(Spread &lt; $0.30)</b> وتفادي الأوامر العشوائية قبل افتتاح الجلسة وتحديد مناطق الفجوات السعرية (Gap Risk) ومستويات الارتكاز لليوم السابق.
          </div>
        </div>
      ` : ""}

      <!-- Active Proximity Alerts Banners (Stop Loss Proximity / Target 1) -->
      ${this.activeAlerts && this.activeAlerts.length > 0 ? `
        <div class="copilot-alerts-container" style="margin-top: 8px; margin-bottom: 8px;">
          ${this.activeAlerts.map(a => `
            <div class="copilot-proximity-alert ${a.severity}" style="padding: 8px 10px; margin-bottom: 6px; border-radius: 6px; font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: space-between; border: 1px solid ${a.severity === 'danger' ? '#ef4444' : a.severity === 'warning' ? '#f59e0b' : '#10b981'}; background: ${a.severity === 'danger' ? 'rgba(239,68,68,0.2)' : a.severity === 'warning' ? 'rgba(245,158,11,0.2)' : 'rgba(16,185,129,0.2)'}; color: #f8fafc;">
              <span>${a.text}</span>
              <span style="font-size: 9px; opacity: 0.85;">تنبيه نشط</span>
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

      <!-- Top 3 Multi-Tier Recommended Contracts Section Header -->
      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:12px; margin-bottom:8px;">
        <span style="font-size:12px; font-weight:800; color:#f8fafc; display:flex; align-items:center; gap:4px;">
          <span>🎯</span>
          <span>أفضل 3 عقود مقترحة في السلسلة (Multi-Tier Selection):</span>
        </span>
        <span style="font-size:10px; color:#38bdf8; background:rgba(56,189,248,0.12); padding:2px 6px; border-radius:4px; font-weight:700;">
          ${(spx.activeTab === "PUT" || isPut) ? "عقود البيع (PUTS)" : "عقود الشراء (CALLS)"}
        </span>
      </div>

      <!-- Multi-Tier Recommendation Cards (ATM, OTM, ITM) -->
      ${activeRecommendations.length > 0 ? activeRecommendations.map((c) => {
        const isCallCard = c.type === "CALL";
        const tradeId = `opt_${c.strike}_${c.type}`;
        const isTracked = Boolean(this.trackedTrades && this.trackedTrades[tradeId]);
        const tracked = this.trackedTrades ? this.trackedTrades[tradeId] : null;
        const livePrice = c.entry;

        let tierColor = "#38bdf8";
        let tierBg = "rgba(56,189,248,0.15)";
        if (c.tierKey === "ATM") {
          tierColor = "#00F090";
          tierBg = "rgba(0,240,144,0.15)";
        } else if (c.tierKey === "OTM") {
          tierColor = "#fbbf24";
          tierBg = "rgba(251,191,36,0.15)";
        }

        return `
          <div class="copilot-opt-card ${isCallCard ? "call" : "put"}" style="margin-bottom: 10px; border-right: 4px solid ${tierColor};">
            <!-- Tier Badge Header -->
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 6px;">
              <span style="font-size:10px; font-weight:800; color:${tierColor}; background:${tierBg}; padding:2px 8px; border-radius:4px;">
                ${c.tierBadge || "🏆 أفضل عقد"}
              </span>
              <span style="font-size:10px; color:#94a3b8;">Delta: <b style="color:#f8fafc;">${c.delta}</b> | IV: <b>${c.iv}</b></span>
            </div>

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
                <span class="copilot-level-label">الهدف 1 (${c.tp1_pct || "+12%"})</span>
                <span class="copilot-level-val val-tp">${c.tp1}$</span>
              </div>
              <div class="copilot-level-item">
                <span class="copilot-level-label">الهدف 2 (${c.tp2_pct || "+22%"})</span>
                <span class="copilot-level-val val-tp">${c.tp2}$</span>
              </div>
              <div class="copilot-level-item">
                <span class="copilot-level-label">وقف الخسارة (${c.sl_pct || "-12%"})</span>
                <span class="copilot-level-val val-sl">${c.sl}$</span>
              </div>
            </div>

            <!-- Locked-In Entry vs Live Current Price Side-by-Side (When Trade is Executed/Tracked) -->
            ${isTracked && tracked ? `
              <div class="copilot-locked-comparison" style="background: rgba(15, 23, 42, 0.65); border: 1px solid rgba(56, 189, 248, 0.35); border-radius: 6px; padding: 7px 10px; margin-top: 8px; display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
                <div>
                  <div style="font-size: 9.5px; color: #94a3b8; font-weight: 700;">🔒 سعر الدخول المقفل (ثابت)</div>
                  <div style="font-size: 13px; font-weight: 900; color: #38bdf8; margin-top: 1px;">${tracked.lockedEntryPrice}$</div>
                </div>
                <div style="text-align: left;">
                  <div style="font-size: 9.5px; color: #94a3b8; font-weight: 700;">📊 السعر المباشر اللحظي</div>
                  <div style="font-size: 13px; font-weight: 900; color: ${livePrice >= tracked.lockedEntryPrice ? '#00F090' : '#FF3B56'}; margin-top: 1px;">
                    ${livePrice}$ <span style="font-size: 10px; font-weight: 700;">(${livePrice >= tracked.lockedEntryPrice ? '+' : ''}${Math.round(((livePrice - tracked.lockedEntryPrice) / tracked.lockedEntryPrice) * 1000) / 10}%)</span>
                  </div>
                </div>
                <div style="grid-column: span 2; display: flex; justify-content: space-between; font-size: 9.5px; color: #cbd5e1; border-top: 1px dashed rgba(255,255,255,0.08); padding-top: 4px; margin-top: 2px;">
                  <span>🛡️ الوقف المقفل: <b style="color:#f87171;">${tracked.lockedStopLoss}$</b></span>
                  <span>🎯 الهدف 1 المقفل: <b style="color:#00F090;">${tracked.lockedTarget1}$</b></span>
                </div>
              </div>
            ` : ""}

            <!-- Execution / Tracking Toggle Button -->
            <button class="copilot-btn-track-trade ${isTracked ? 'tracked' : ''}" data-trade-id="${tradeId}" data-trade-data='${JSON.stringify({
              id: tradeId,
              strike: c.strike,
              type: c.type,
              entry: c.entry,
              sl: c.sl,
              tp1: c.tp1,
              tp2: c.tp2
            })}' style="width: 100%; margin-top: 8px; padding: 6px 12px; border-radius: 6px; font-size: 11px; font-weight: 800; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; transition: all 0.2s ease; border: 1px solid ${isTracked ? '#10b981' : '#38bdf8'}; background: ${isTracked ? 'rgba(16, 185, 129, 0.2)' : 'rgba(56, 189, 248, 0.15)'}; color: ${isTracked ? '#34d399' : '#38bdf8'};">
              <span>${isTracked ? '✓ تم التنفيذ (المراقبة نشطة 🎯)' : '🎯 تم التنفيذ (تفعيل التنبيه)'}</span>
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
        <div style="background: rgba(17, 24, 39, 0.7); border: 1px dashed var(--copilot-border); border-radius: 8px; padding: 22px 16px; text-align: center; color: var(--copilot-text-secondary);">
          <div style="font-size: 26px; margin-bottom: 8px;">📊</div>
          <div style="font-weight: 700; color: #f8fafc; font-size: 13px; margin-bottom: 6px;">في انتظار قراءة جدول العقود الحقيقي من الشاشة</div>
          <div style="font-size: 11px; color: #94a3b8; line-height: 1.6;">
            اضغط على زر <b>"🔍 مسح شامل لكل العقود"</b> بالأعلى لقراءة كامل السلسلة وتحديد أفضل 3 عقود فورياً.
          </div>
        </div>
      `}
    `;
  }
};

