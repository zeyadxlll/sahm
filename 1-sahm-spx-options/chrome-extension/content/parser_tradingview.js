/**
 * Sahm Trading Copilot - TradingView Real-Time SPX Bridge Parser
 * Runs autonomously on TradingView (*://*.tradingview.com/*).
 * Scrapes live SPX 500 data every 700ms and broadcasts via chrome.storage.local
 * to Sahm Copilot running on app.sahmcapital.com.
 */

(function () {
  "use strict";

  // Prevent multiple injections
  if (window.__sahmTvBridgeLoaded) return;
  window.__sahmTvBridgeLoaded = true;

  console.log("[Sahm TV Bridge] Initializing TradingView-to-Sahm SPX Bridge...");

  const CONFIG = {
    pollIntervalMs: 700,
    storageKey: "tv_spx_bridge",
    pillId: "sahm-tv-bridge-pill",
  };

  let lastBroadcastData = null;
  let pillElement = null;

  /**
   * Helper: Parse formatted number strings (e.g. "7,672.88" -> 7672.88)
   */
  function cleanFloat(str) {
    if (!str) return 0;
    const clean = String(str)
      .replace(/[^\d.-]/g, "")
      .replace(/−/g, "-");
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
  }

  /**
   * Extract Live Price from TradingView
   * 1. Prioritize right-side symbol details widget (large price next to USD)
   * 2. Fallback to top-left chart legend or title
   */
  function extractLivePrice() {
    // Strategy 1: Search right details panel for elements near "USD"
    const usdElements = Array.from(
      document.querySelectorAll("span, div, b, p")
    ).filter((el) => {
      const txt = el.textContent.trim();
      return txt === "USD" || txt === "USDT" || txt.startsWith("USD ");
    });

    for (const usdEl of usdElements) {
      // Check parent and siblings
      const container = usdEl.parentElement;
      if (!container) continue;

      // Search container or parent's parent for a large price number
      const parentContainer = container.parentElement || container;
      const candidates = parentContainer.querySelectorAll(
        "span, div, b, [class*='price'], [class*='highlight'], [class*='last-']"
      );

      for (const cand of candidates) {
        if (cand === usdEl) continue;
        const text = cand.textContent.trim();
        // Match numbers like 7,672.88 or 5890.50
        const m = text.match(/\b([1-9]\d{0,1},?\d{3}\.\d{2})\b/);
        if (m) {
          const val = cleanFloat(m[1]);
          if (val >= 2000 && val <= 20000) {
            return val;
          }
        }
      }

      // Check text content of container directly
      const mDirect = container.textContent.match(
        /\b([1-9]\d{0,1},?\d{3}\.\d{2})\b/
      );
      if (mDirect) {
        const val = cleanFloat(mDirect[1]);
        if (val >= 2000 && val <= 20000) {
          return val;
        }
      }
    }

    // Strategy 2: Details panel standard classes
    const detailPriceEl = document.querySelector(
      "[class*='symbolDetails'] [class*='last-'], " +
      "[class*='symbolDetails'] [class*='price-'], " +
      "[class*='priceWrapper'] [class*='highlight'], " +
      "[class*='tickerPrice-'], " +
      "[data-name='legend-last-value']"
    );
    if (detailPriceEl) {
      const m = detailPriceEl.textContent.match(/\b([1-9]\d{0,1},?\d{3}\.\d{2})\b/);
      if (m) {
        const val = cleanFloat(m[1]);
        if (val >= 2000 && val <= 20000) return val;
      }
    }

    // Strategy 3: Top-left Chart Legend
    const legendValues = document.querySelectorAll(
      "[class*='valuesWrapper'] span, [data-name='legend-series-item'] span"
    );
    for (const el of legendValues) {
      const text = el.textContent.trim();
      const m = text.match(/\b([1-9]\d{0,1},?\d{3}\.\d{2})\b/);
      if (m) {
        const val = cleanFloat(m[1]);
        if (val >= 2000 && val <= 20000) return val;
      }
    }

    // Strategy 4: Document title fallback (e.g. "S&P 500 Index 7672.88 ...")
    const titleMatch = document.title.match(/\b([1-9]\d{0,1},?\d{3}\.\d{2})\b/);
    if (titleMatch) {
      const val = cleanFloat(titleMatch[1]);
      if (val >= 2000 && val <= 20000) return val;
    }

    return 0;
  }

  /**
   * Extract Points Change and Percentage Change
   */
  function extractChange() {
    let changePts = 0;
    let changePct = 0;

    // Search in right details widget first
    const changeContainers = document.querySelectorAll(
      "[class*='symbolDetails'] [class*='change'], " +
      "[class*='priceWrapper'] ~ div, " +
      "[class*='symbolDetails'] span[class*='positive'], " +
      "[class*='symbolDetails'] span[class*='negative'], " +
      "[data-name='legend-series-item'] [class*='change']"
    );

    for (const c of changeContainers) {
      const text = c.textContent.trim();
      // Match formats like "-4.50 (-0.06%)" or "+12.30 (+0.16%)"
      const mBoth = text.match(/([+-−]?\d+\.?\d*)\s*\(([+-−]?\d+\.?\d*)%?\)/);
      if (mBoth) {
        changePts = cleanFloat(mBoth[1]);
        changePct = cleanFloat(mBoth[2]);
        return { changePts, changePct };
      }

      // Check percentage alone
      const mPct = text.match(/([+-−]?\d+\.?\d*)%/);
      if (mPct) {
        changePct = cleanFloat(mPct[1]);
      }
      // Check points alone
      const mPts = text.match(/^([+-−]\d+\.?\d*)$/);
      if (mPts) {
        changePts = cleanFloat(mPts[1]);
      }
    }

    // Broader scan around details panel
    const allDetailSpans = document.querySelectorAll("[class*='symbolDetails'] span");
    for (const span of allDetailSpans) {
      const t = span.textContent.trim();
      if (t.includes("%") && !changePct) {
        const m = t.match(/([+-−]?\d+\.?\d*)%/);
        if (m) changePct = cleanFloat(m[1]);
      } else if ((t.startsWith("+") || t.startsWith("-") || t.startsWith("−")) && !changePts) {
        const m = t.match(/^[+-−]\d+\.?\d*$/);
        if (m) changePts = cleanFloat(m[0]);
      }
    }

    return { changePts, changePct };
  }

  /**
   * Extract Bid / Ask from Top-Left Sell & Buy Buttons
   */
  function extractBidAsk(livePrice) {
    let bid = 0;
    let ask = 0;

    // Search top-left buttons (Order Placement / Buy & Sell)
    const buttons = document.querySelectorAll(
      "[data-name='order-panel-sell-button'], [data-name='order-panel-buy-button'], " +
      "[class*='bidButton'], [class*='askButton'], " +
      "[class*='sellButton'], [class*='buyButton'], " +
      "button[class*='bid'], button[class*='ask'], " +
      "div[class*='orderPanel'] button, div[class*='buySell'] button"
    );

    for (const btn of buttons) {
      const text = btn.textContent.trim();
      const m = text.match(/\b([1-9]\d{0,1},?\d{3}\.\d{2})\b/);
      if (!m) continue;

      const val = cleanFloat(m[1]);
      if (val < 2000 || val > 20000) continue;

      const lower = (text + " " + (btn.getAttribute("data-name") || "") + " " + (btn.className || "")).toLowerCase();
      if (lower.includes("sell") || lower.includes("bid") || lower.includes("بيع")) {
        bid = val;
      } else if (lower.includes("buy") || lower.includes("ask") || lower.includes("شراء")) {
        ask = val;
      }
    }

    // If buttons not found explicitly, search any buttons with price numbers near the top of the chart
    if (!bid || !ask) {
      const topButtons = Array.from(document.querySelectorAll("button, div[role='button']")).slice(0, 40);
      const foundPrices = [];
      for (const btn of topButtons) {
        const text = btn.textContent.trim();
        const m = text.match(/\b([1-9]\d{0,1},?\d{3}\.\d{2})\b/);
        if (m) {
          const val = cleanFloat(m[1]);
          if (val >= 2000 && val <= 20000 && !foundPrices.includes(val)) {
            foundPrices.push(val);
          }
        }
      }
      if (foundPrices.length >= 2) {
        foundPrices.sort((a, b) => a - b);
        bid = foundPrices[0];
        ask = foundPrices[1];
      }
    }

    // Graceful fallback to real-time tight spread proxy from live price
    if (!bid && livePrice > 0) {
      bid = Math.round((livePrice - 0.30) * 100) / 100;
    }
    if (!ask && livePrice > 0) {
      ask = Math.round((livePrice + 0.30) * 100) / 100;
    }

    return { bid, ask };
  }

  /**
   * Extract Session Range (High / Low) from Range Bar or Chart Legend
   */
  function extractSessionRange(livePrice) {
    let high = 0;
    let low = 0;

    // Strategy 1: Look for "Day's Range" in right details widget
    const rangeLabels = Array.from(document.querySelectorAll("span, div, p, dt, td")).filter((el) => {
      const t = el.textContent.trim().toLowerCase();
      return t === "day's range" || t === "days range" || t === "نطاق اليوم" || t === "range" || t === "نطاق";
    });

    for (const label of rangeLabels) {
      const container = label.closest("[class*='row'], [class*='item'], div") || label.parentElement;
      if (!container) continue;

      const numbers = [];
      const matches = container.textContent.match(/\b([1-9]\d{0,1},?\d{3}\.\d{2})\b/g);
      if (matches) {
        for (const m of matches) {
          const val = cleanFloat(m);
          if (val >= 2000 && val <= 20000) {
            numbers.push(val);
          }
        }
      }

      if (numbers.length >= 2) {
        low = Math.min(...numbers);
        high = Math.max(...numbers);
        return { high, low };
      }
    }

    // Strategy 2: Look for H / L in top-left chart legend
    const legendTexts = Array.from(document.querySelectorAll("[class*='valuesWrapper'] span, [data-name='legend-series-item'] span"));
    for (let i = 0; i < legendTexts.length; i++) {
      const t = legendTexts[i].textContent.trim();
      if ((t === "H" || t === "High") && i + 1 < legendTexts.length) {
        const nextVal = cleanFloat(legendTexts[i + 1].textContent);
        if (nextVal >= 2000 && nextVal <= 20000) high = nextVal;
      }
      if ((t === "L" || t === "Low") && i + 1 < legendTexts.length) {
        const nextVal = cleanFloat(legendTexts[i + 1].textContent);
        if (nextVal >= 2000 && nextVal <= 20000) low = nextVal;
      }
    }

    // Fallback: Default session bounds relative to live price
    if (!high && livePrice > 0) high = Math.round((livePrice + 15.0) * 100) / 100;
    if (!low && livePrice > 0) low = Math.round((livePrice - 15.0) * 100) / 100;

    return { high, low };
  }

  /**
   * Render Floating Pill Widget on TradingView DOM
   */
  function ensureFloatingPill(data) {
    if (!pillElement) {
      pillElement = document.getElementById(CONFIG.pillId);
    }

    if (!pillElement) {
      pillElement = document.createElement("div");
      pillElement.id = CONFIG.pillId;
      pillElement.style.cssText = `
        position: fixed;
        bottom: 22px;
        left: 22px;
        z-index: 9999999;
        background: linear-gradient(135deg, rgba(15, 23, 42, 0.94) 0%, rgba(6, 78, 59, 0.94) 100%);
        border: 1px solid #10b981;
        border-radius: 24px;
        padding: 6px 14px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5), 0 0 12px rgba(16, 185, 129, 0.35);
        color: #f8fafc;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Cairo", sans-serif;
        font-size: 11.5px;
        font-weight: 800;
        display: flex;
        align-items: center;
        gap: 8px;
        direction: rtl;
        cursor: pointer;
        user-select: none;
        backdrop-filter: blur(10px);
        transition: transform 0.2s ease, box-shadow 0.2s ease;
      `;

      pillElement.addEventListener("mouseenter", () => {
        pillElement.style.transform = "scale(1.04)";
        pillElement.style.boxShadow = "0 6px 24px rgba(0, 0, 0, 0.6), 0 0 16px rgba(16, 185, 129, 0.5)";
      });
      pillElement.addEventListener("mouseleave", () => {
        pillElement.style.transform = "scale(1.0)";
        pillElement.style.boxShadow = "0 4px 20px rgba(0, 0, 0, 0.5), 0 0 12px rgba(16, 185, 129, 0.35)";
      });

      document.body.appendChild(pillElement);
    }

    const priceFmt = data.price > 0 ? Number(data.price).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "--";
    const chgSign = data.changePts >= 0 ? "+" : "";
    const chgColor = data.changePts >= 0 ? "#34d399" : "#f87171";

    pillElement.innerHTML = `
      <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#10b981; box-shadow:0 0 8px #10b981; animation: sahmtvpulse 1.6s infinite;"></span>
      <span style="color:#f8fafc;">Sahm Bridge متصل</span>
      <span style="color:#64748b;">|</span>
      <span style="color:#38bdf8;">SPX: <b style="color:#ffffff;">${priceFmt}</b></span>
      <span style="font-size:10px; color:${chgColor}; font-weight:700;">(${chgSign}${data.changePts.toFixed(2)} / ${chgSign}${data.changePct.toFixed(2)}%)</span>
    `;

    // Ensure CSS animation injected once
    if (!document.getElementById("sahm-tv-bridge-style")) {
      const style = document.createElement("style");
      style.id = "sahm-tv-bridge-style";
      style.textContent = `
        @keyframes sahmtvpulse {
          0% { opacity: 0.6; transform: scale(0.9); }
          50% { opacity: 1.0; transform: scale(1.2); }
          100% { opacity: 0.6; transform: scale(0.9); }
        }
      `;
      document.head.appendChild(style);
    }
  }

  // ============================================================================
  // Anti-Throttling Engine: Persistent Port Connection & Background Web Worker
  // Keeps TradingView scraping active and continuous even when tab is in background
  // ============================================================================
  let bridgePort = null;
  let portReconnectTimer = null;
  let lastScrapeTime = 0;

  function connectBackgroundPort() {
    if (portReconnectTimer) {
      clearTimeout(portReconnectTimer);
      portReconnectTimer = null;
    }

    try {
      if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.connect) {
        bridgePort = chrome.runtime.connect({ name: "tv_spx_bridge_port" });

        bridgePort.onMessage.addListener((msg) => {
          if (msg && msg.type === "SCRAPE_TICK") {
            // Immediate scrape triggered by background service worker tick
            scrapeAndBroadcast();
          }
        });

        bridgePort.onDisconnect.addListener(() => {
          bridgePort = null;
          // Reconnect with brief pause
          portReconnectTimer = setTimeout(connectBackgroundPort, 1500);
        });

        console.log("[Sahm TV Bridge] Persistent background port established");
      }
    } catch (e) {
      console.warn("[Sahm TV Bridge] Port connection error:", e);
      portReconnectTimer = setTimeout(connectBackgroundPort, 2000);
    }
  }

  // Secondary Anti-Throttling: Inline Blob Web Worker (Exempt from Chrome timer clamping)
  let workerTimer = null;
  try {
    const workerBlob = new Blob(
      [
        `setInterval(function() { postMessage("tick"); }, ${CONFIG.pollIntervalMs});`
      ],
      { type: "application/javascript" }
    );
    const workerUrl = URL.createObjectURL(workerBlob);
    workerTimer = new Worker(workerUrl);
    workerTimer.onmessage = function () {
      scrapeAndBroadcast();
    };
    console.log("[Sahm TV Bridge] Anti-throttling Web Worker timer activated");
  } catch (err) {
    console.log("[Sahm TV Bridge] Worker fallback notice (using background port):", err);
  }

  /**
   * Main Scraping and Broadcasting Loop
   */
  function scrapeAndBroadcast() {
    const now = Date.now();
    // Throttle guard: avoid overlapping runs within 300ms
    if (now - lastScrapeTime < 300) return;
    lastScrapeTime = now;

    try {
      const price = extractLivePrice();
      if (!price || price <= 0) {
        return;
      }

      const { changePts, changePct } = extractChange();
      const { bid, ask } = extractBidAsk(price);
      const { high, low } = extractSessionRange(price);

      const payload = {
        price: Number(price.toFixed(2)),
        changePts: Number(changePts.toFixed(2)),
        changePct: Number(changePct.toFixed(2)),
        bid: Number(bid.toFixed(2)),
        ask: Number(ask.toFixed(2)),
        high: Number(high.toFixed(2)),
        low: Number(low.toFixed(2)),
        timestamp: now,
      };

      // Check if data changed or time for heartbeat (every 1800ms)
      const shouldSave =
        !lastBroadcastData ||
        lastBroadcastData.price !== payload.price ||
        lastBroadcastData.bid !== payload.bid ||
        lastBroadcastData.ask !== payload.ask ||
        now - lastBroadcastData.timestamp > 1800;

      if (shouldSave) {
        lastBroadcastData = payload;

        // 1. Direct transmission across persistent background port (instant 0ms)
        if (bridgePort) {
          try {
            bridgePort.postMessage({ type: "TV_BRIDGE_DATA", payload: payload });
          } catch (e) {
            connectBackgroundPort();
          }
        }

        // 2. Direct local storage update
        if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
          chrome.storage.local.set({ [CONFIG.storageKey]: payload }, () => {
            if (chrome.runtime.lastError) {
              console.warn("[Sahm TV Bridge] Storage set warning:", chrome.runtime.lastError);
            }
          });
        }
      }

      // Update UI Pill on TradingView
      ensureFloatingPill(payload);
    } catch (err) {
      console.warn("[Sahm TV Bridge] Scraper cycle error:", err);
    }
  }

  // 1. Establish persistent port with background service worker
  connectBackgroundPort();

  // 2. Initial execution and local interval
  scrapeAndBroadcast();
  setInterval(scrapeAndBroadcast, CONFIG.pollIntervalMs);

  console.log("[Sahm TV Bridge] Anti-throttling bridge fully active and streaming SPX every", CONFIG.pollIntervalMs, "ms");
})();

