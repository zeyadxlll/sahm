/**
 * Sahm Trading Copilot - Smart Heuristic Market Table & Summary Parser
 * Auto-detects tables on real https://app.sahmcapital.com/market regardless of framework.
 * Detects Market Switcher (`SA` Saudi vs `US` US Market) and Market Status (Open vs Closed).
 */

window.SahmMarketParser = {
  /**
   * Helper: Parse numbers with support for Arabic digits, K/M/B suffixes, commas, and currencies.
   */
  cleanNumber(val) {
    if (val === null || val === undefined) return 0;
    let str = String(val).trim();
    if (!str || str === "--" || str === "-") return 0;

    // Normalize Arabic-Indic digits to ASCII digits (٠١٢٣٤٥٦٧٨٩ -> 0123456789)
    str = str.replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d));

    // Multiplier detection for K (ألف), M (مليون), B (مليار)
    let multiplier = 1;
    const upper = str.toUpperCase();
    if (upper.includes("B") || str.includes("مليار")) {
      multiplier = 1_000_000_000;
    } else if (upper.includes("M") || str.includes("مليون")) {
      multiplier = 1_000_000;
    } else if (upper.includes("K") || str.includes("ألف") || str.includes("الف")) {
      multiplier = 1_000;
    }

    const cleaned = str.replace(/[^\d.-]/g, "");
    const num = parseFloat(cleaned);
    if (isNaN(num)) return 0;
    return parseFloat((num * multiplier).toFixed(4));
  },

  /**
   * Detect Active Market from the top-right header / navigation of the Sahm platform:
   * Returns: "SA" (Saudi Market) or "US" (US Market)
   */
  detectActiveMarket() {
    // 1. Primary: Direct Sahm market-bar badge
    const badgeEl = document.querySelector('.market-bar-market-info .market-name, .market-bar-market-info, .market-name');
    if (badgeEl) {
      const badgeText = badgeEl.textContent.trim().toUpperCase();
      if (badgeText.includes("US") || badgeText.includes("أمريكي")) return "US";
      if (badgeText.includes("SA") || badgeText.includes("سعودي")) return "SA";
    }

    // 2. Check URL heuristics
    const url = window.location.href.toLowerCase();
    if (url.includes("code=spx") || url.includes("tab=options") || url.includes("code=aapl") || url.includes("code=nvda") || url.includes("/us/")) {
      return "US";
    }
    if (url.includes("/sa/") || url.includes("market=sa") || url.includes("code=1120") || url.includes("code=2222")) {
      return "SA";
    }

    // 3. Scan top-right header elements (Market selector buttons / dropdowns)
    const marketSelectors = document.querySelectorAll(
      ".market-switch, .country-switch, .header-market, .market-tabs, [class*='market-tab'], [class*='region'], .nav-tabs, header div, nav div"
    );

    for (const el of marketSelectors) {
      const activeEl = el.querySelector(".active, .is-active, .selected") || el;
      const text = activeEl.innerText ? activeEl.innerText.trim() : "";
      if (!text) continue;

      if (text.includes("السوق الأمريكي") || text.includes("أمريكي") || text === "US" || text.includes("United States")) {
        return "US";
      }
      if (text.includes("السوق السعودي") || text.includes("سعودي") || text === "SA" || text.includes("Saudi")) {
        return "SA";
      }
    }

    // 4. Fallback: inspect document text for presence of TASI vs US indices
    const bodyText = document.body ? document.body.innerText : "";
    if (bodyText.includes("تاسي") || bodyText.includes("TASI") || bodyText.includes("سوق الأسهم السعودية")) {
      return "SA";
    }
    if (bodyText.includes("SPX") || bodyText.includes("S&P 500") || bodyText.includes("ناسداك") || bodyText.includes("Dow Jones")) {
      return "US";
    }

    return "SA"; // default to Saudi market
  },

  /**
   * Helper: Get current time and calendar day in Cairo Egypt Time (Africa/Cairo)
   */
  getEgyptTimeInfo() {
    try {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: "Africa/Cairo",
        hour12: false,
        weekday: "short", // 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'
        hour: "numeric",
        minute: "numeric"
      });
      const parts = formatter.formatToParts(now);
      const map = {};
      for (const p of parts) map[p.type] = p.value;
      const day = map.weekday;
      const hour = parseInt(map.hour, 10);
      const minute = parseInt(map.minute, 10);
      const mins = hour * 60 + minute;
      return { day, hour, minute, mins, now };
    } catch (e) {
      const now = new Date();
      return { day: "Mon", hour: now.getUTCHours() + 3, minute: now.getUTCMinutes(), mins: (now.getUTCHours() + 3) * 60 + now.getUTCMinutes(), now };
    }
  },

  /**
   * Helper: Extract session status text ONLY from Sahm header and stock subtitle,
   * strictly ignoring #sahm-copilot-root and #sahm-copilot-sidebar to eliminate self-reading loop.
   */
  getSahmSessionBadgeText() {
    const isCopilot = (el) => {
      if (!el) return false;
      if (el.id === "sahm-copilot-root" || el.id === "sahm-copilot-sidebar") return true;
      return !!(el.closest && (el.closest("#sahm-copilot-root") || el.closest("#sahm-copilot-sidebar")));
    };

    const textPieces = [];

    // 1. Sahm's top-right header container (.market-bar-market-info)
    const headerContainers = document.querySelectorAll(".market-bar-market-info");
    for (const hc of headerContainers) {
      if (!isCopilot(hc)) {
        textPieces.push(hc.textContent || "");
      }
    }

    // 2. Subtitle right under the SPX/Stock price
    const subtitleSelectors = [
      ".market-bar-market-info .market-status",
      ".market-bar-market-info .status",
      ".stock-header-card .market-status",
      ".stock-header-card .status",
      ".stock-header-card .sub-title",
      ".stock-header-card [class*='status']",
      ".stock-brief .market-status",
      ".stock-brief .sub-title",
      ".quote-header .market-status",
      ".m-market-status",
      ".trading-status",
      ".market-status",
      ".status-badge",
      ".status-text",
      "[class*='trading-status']",
      "[class*='market-status']",
      ".sub-title",
      ".subtitle"
    ];

    const subBadges = document.querySelectorAll(subtitleSelectors.join(", "));
    for (const sb of subBadges) {
      if (!isCopilot(sb)) {
        textPieces.push(sb.textContent || "");
      }
    }

    // Direct inspect under stock price / underlying price header
    const priceNodes = document.querySelectorAll(
      ".stock-price, .underlying-price, #spx-underlying-price, .stock-price-huge, [class*='price-val'], .stock-main-price"
    );
    for (const pn of priceNodes) {
      if (isCopilot(pn)) continue;
      const parent = pn.parentElement;
      if (parent && !isCopilot(parent)) {
        const sub = parent.querySelector(".status, .sub-title, .market-status, [class*='status'], span, div");
        if (sub && !isCopilot(sub)) {
          textPieces.push(sub.textContent || "");
        }
      }
    }

    return textPieces.join(" ").trim();
  },

  /**
   * Institutional Market Trading Status Detector:
   * Uses Egypt Cairo Time (Africa/Cairo) and strictly reads Sahm header (.market-bar-market-info)
   * and subtitle under the SPX/Stock price, preventing any self-reading DOM loops.
   */
  detectMarketStatus(overrideMarket = null) {
    const activeMarket = overrideMarket || this.detectActiveMarket() || "SA";
    const cairo = this.getEgyptTimeInfo();
    const badgeText = this.getSahmSessionBadgeText();

    // 1. Weekend in Egypt Time
    if (activeMarket === "US" && (cairo.day === "Sat" || cairo.day === "Sun")) {
      return {
        isOpen: false,
        isPreMarket: false,
        isOvernight: false,
        statusText: "سوق مغلق 🔴 (عطلة نهاية الأسبوع)",
        raw: "CLOSED"
      };
    }
    if (activeMarket === "SA" && (cairo.day === "Fri" || cairo.day === "Sat")) {
      return {
        isOpen: false,
        isPreMarket: false,
        isOvernight: false,
        statusText: "سوق مغلق 🔴 (عطلة نهاية الأسبوع)",
        raw: "CLOSED"
      };
    }

    // 2. Immediate CLOSED check: if Sahm badge explicitly says "مغلق" / "Closed"
    if (
      badgeText.includes("مغلق") ||
      badgeText.includes("Closed") ||
      badgeText.includes("فترة الإغلاق") ||
      badgeText.includes("مزاد الإغلاق")
    ) {
      return {
        isOpen: false,
        isPreMarket: false,
        isOvernight: false,
        statusText: "سوق مغلق 🔴",
        raw: "CLOSED"
      };
    }

    // 3. US Market Schedule Checks (Egypt Time: Africa/Cairo)
    if (activeMarket === "US") {
      const isPreMarketHours = cairo.mins >= 660 && cairo.mins < 990; // 11:00 AM to 4:30 PM Cairo Time
      const isOpenHours = cairo.mins >= 990 && cairo.mins < 1380; // 4:30 PM to 11:00 PM Cairo Time
      const isOvernightHours = cairo.mins >= 1380 || cairo.mins < 660; // After 11:00 PM to 11:00 AM Cairo Time

      // Pre-Market: 11:00 ص to 4:30 م Egypt Time (ONLY when Sahm badge confirms "قبل الافتتاح")
      if (
        isPreMarketHours &&
        (badgeText.includes("قبل الافتتاح") || badgeText.includes("Pre-Market") || badgeText.includes("قبل التداول"))
      ) {
        return {
          isOpen: true,
          isPreMarket: true,
          isOvernight: false,
          statusText: "فترة ما قبل الافتتاح (Pre-Market) 🟡",
          raw: "PRE_MARKET"
        };
      }

      // Regular Market Open: 4:30 م to 11:00 م Egypt Time (when Sahm badge says "مفتوح")
      if (isOpenHours) {
        if (badgeText.includes("مفتوح") || badgeText.includes("Open") || !badgeText) {
          return {
            isOpen: true,
            isPreMarket: false,
            isOvernight: false,
            statusText: "سوق مفتوح 🟢",
            raw: "OPEN"
          };
        }
      }

      // Overnight Trading Check
      if (badgeText.includes("التداول الليلي") || badgeText.includes("Overnight")) {
        return {
          isOpen: false,
          isPreMarket: false,
          isOvernight: true,
          statusText: "التداول الليلي / خارج الجلسة 🌙",
          raw: "OVERNIGHT"
        };
      }

      // If outside open hours (after 11:00 PM or before 11:00 AM)
      if (isOvernightHours) {
        return {
          isOpen: false,
          isPreMarket: false,
          isOvernight: true,
          statusText: "التداول الليلي / خارج الجلسة 🌙",
          raw: "OVERNIGHT"
        };
      }

      return {
        isOpen: false,
        isPreMarket: false,
        isOvernight: false,
        statusText: "سوق مغلق 🔴",
        raw: "CLOSED"
      };
    }

    // 4. Saudi Market Schedule Checks (Sunday to Thursday: 10:00 ص to 3:00 م Egypt Time)
    const isSaudiOpenHours = cairo.mins >= 600 && cairo.mins < 900; // 10:00 AM to 3:00 PM Egypt Time
    if (isSaudiOpenHours && !badgeText.includes("مغلق")) {
      return {
        isOpen: true,
        isPreMarket: false,
        isOvernight: false,
        statusText: "سوق مفتوح 🟢",
        raw: "OPEN"
      };
    }

    return {
      isOpen: false,
      isPreMarket: false,
      isOvernight: false,
      statusText: "سوق مغلق 🔴",
      raw: "CLOSED"
    };
  },

  /**
   * Check if current page is Market Overview or Watchlist
   */
  isMarketPage() {
    const url = window.location.href.toLowerCase();
    if (url.includes("/market") || url.includes("/watchlist") || url.includes("/quote/list")) {
      return true;
    }

    const bodyText = document.body ? document.body.innerText : "";
    const hasMarketKeywords =
      (bodyText.includes("تاسي") || bodyText.includes("TASI") || bodyText.includes("SPX") || bodyText.includes("ناسداك")) &&
      (bodyText.includes("الرمز") || bodyText.includes("آخر سعر") || bodyText.includes("الصفقات"));

    return hasMarketKeywords;
  },

  /**
   * Institutional Extraction of Major US Indices (SPX, Nasdaq, Dow Jones)
   * Strictly isolates Nasdaq (e.g. 26713.03, +0.08%) from Dow Jones (52177.69, -0.24%).
   * Prevents matching duplicate or mismatched index values across the top ticker bar.
   */
  parseMajorIndices() {
    const indices = {
      spx: { name: "S&P 500", price: 0, changePercent: 0, change: 0 },
      nasdaq: { name: "ناسداك (Nasdaq)", price: 0, changePercent: 0, change: 0 },
      dow: { name: "داو جونز (Dow Jones)", price: 0, changePercent: 0, change: 0 }
    };

    const cleanNum = (val) => {
      if (val === null || val === undefined) return 0;
      let s = String(val).trim().replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
      const cleaned = s.replace(/[^\d.-]/g, "");
      const n = parseFloat(cleaned);
      return isNaN(n) ? 0 : n;
    };

    const extractMetricsFromText = (rawText, targetKey) => {
      if (!rawText) return null;
      let text = String(rawText).replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d));

      let pct = 0;
      const pctMatch = text.match(/([+-]?\d+(?:\.\d+)?)\s*[%٪]/);
      if (pctMatch) {
        pct = parseFloat(pctMatch[1]);
      }

      const numMatches = text.match(/\b\d{1,3}(?:,\d{3})*(?:\.\d+)?\b|\b\d+(?:\.\d+)?\b/g) || [];
      const cleanNums = numMatches.map(n => cleanNum(n)).filter(n => n > 0);
      const candidatePrices = cleanNums.filter(n => Math.abs(n - Math.abs(pct)) > 0.001);

      let price = 0;
      if (targetKey === "dow") {
        const matchDow = candidatePrices.find(n => n >= 25000 && n <= 75000);
        price = matchDow || candidatePrices.find(n => n >= 1000) || 0;
      } else if (targetKey === "nasdaq") {
        // Strict guard: Nasdaq index is ~26,713.03. Exclude Dow values (> 40000) completely!
        const matchNas = candidatePrices.find(n => n >= 10000 && n <= 38000);
        price = matchNas || candidatePrices.find(n => n >= 1000 && n < 40000) || 0;
      } else if (targetKey === "spx") {
        const matchSpx = candidatePrices.find(n => n >= 3000 && n <= 12000);
        price = matchSpx || candidatePrices.find(n => n >= 1000 && n < 15000) || 0;
      }

      let change = 0;
      const changeMatch = text.match(/([+-]\d+(?:\.\d+)?)(?!\s*[%٪])/);
      if (changeMatch) {
        const val = parseFloat(changeMatch[1]);
        if (Math.abs(val) !== price && Math.abs(val) !== Math.abs(pct)) {
          change = val;
        }
      }

      return price > 0 ? { price, changePercent: pct, change } : null;
    };

    try {
      // Phase 1: Isolated individual ticker cards (Highest priority)
      const candidateCards = Array.from(document.querySelectorAll(
        ".market-bar-index-item, [class*='index-item'], [class*='ticker-item'], [class*='index_item'], [class*='indices'] > div, .top-indices > div, .market-ticker > div, .ticker-bar > div, [class*='IndexItem']"
      ));

      for (const card of candidateCards) {
        if (!card.innerText || card.innerText.length > 200) continue;
        const txt = card.innerText.trim();

        // Nasdaq Card: Must contain Nasdaq and NOT Dow or SPX
        const isNas = (txt.includes("ناسداك") || /nasdaq|\bixic\b|\bndx\b/i.test(txt)) &&
                      !txt.includes("داو") && !/dow|\bdji\b/i.test(txt) && !txt.includes("S&P") && !txt.includes("SPX");
        if (isNas && indices.nasdaq.price === 0) {
          const res = extractMetricsFromText(txt, "nasdaq");
          if (res) {
            indices.nasdaq.price = res.price;
            indices.nasdaq.changePercent = res.changePercent;
            indices.nasdaq.change = res.change;
          }
        }

        // Dow Jones Card: Must contain Dow and NOT Nasdaq or SPX
        const isDow = (txt.includes("داو") || /dow|\bdji\b/i.test(txt)) &&
                      !txt.includes("ناسداك") && !/nasdaq|\bixic\b/i.test(txt) && !txt.includes("S&P") && !txt.includes("SPX");
        if (isDow && indices.dow.price === 0) {
          const res = extractMetricsFromText(txt, "dow");
          if (res) {
            indices.dow.price = res.price;
            indices.dow.changePercent = res.changePercent;
            indices.dow.change = res.change;
          }
        }

        // S&P 500 Card: Must contain S&P/SPX and NOT Nasdaq or Dow
        const isSpx = (txt.includes("S&P") || txt.includes("SPX") || txt.includes("ستاندرد") || txt.includes("إس آند بي")) &&
                      !txt.includes("ناسداك") && !txt.includes("داو") && !/nasdaq|dow/i.test(txt);
        if (isSpx && indices.spx.price === 0) {
          const res = extractMetricsFromText(txt, "spx");
          if (res) {
            indices.spx.price = res.price;
            indices.spx.changePercent = res.changePercent;
            indices.spx.change = res.change;
          }
        }
      }

      // Phase 2: Segmented Text Fallback (When all indices reside in a single shared parent container)
      if (indices.nasdaq.price === 0 || indices.dow.price === 0 || indices.spx.price === 0) {
        const tickerContainers = Array.from(document.querySelectorAll(
          ".ticker-bar, .top-indices, .market-ticker, .indices-bar, .market-bar-market-info, header, .stock-header-card, div"
        )).filter(el => {
          if (!el.innerText || el.innerText.length > 500) return false;
          const t = el.innerText;
          return (t.includes("ناسداك") || /nasdaq/i.test(t)) ||
                 (t.includes("داو") || /dow/i.test(t)) ||
                 (t.includes("S&P") || t.includes("SPX"));
        });

        for (const container of tickerContainers) {
          const fullText = container.innerText.trim();

          // 1. Nasdaq Segment
          if (indices.nasdaq.price === 0) {
            const nasSegment = fullText.match(/(?:ناسداك|nasdaq|\bixic\b|\bndx\b)([\s\S]*?)(?:داو|dow|\bdji\b|s&p|spx|إس آند بي|ستاندرد|$)/i);
            if (nasSegment && nasSegment[1]) {
              const res = extractMetricsFromText(nasSegment[1], "nasdaq");
              if (res && res.price > 0 && res.price < 40000) {
                indices.nasdaq.price = res.price;
                indices.nasdaq.changePercent = res.changePercent;
                indices.nasdaq.change = res.change;
              }
            }
          }

          // 2. Dow Jones Segment
          if (indices.dow.price === 0) {
            const dowSegment = fullText.match(/(?:داو جونز|داو|dow jones|dow|\bdji\b)([\s\S]*?)(?:ناسداك|nasdaq|\bixic\b|\bndx\b|s&p|spx|إس آند بي|ستاندرد|$)/i);
            if (dowSegment && dowSegment[1]) {
              const res = extractMetricsFromText(dowSegment[1], "dow");
              if (res && res.price > 0 && res.price >= 25000) {
                indices.dow.price = res.price;
                indices.dow.changePercent = res.changePercent;
                indices.dow.change = res.change;
              }
            }
          }

          // 3. S&P 500 Segment
          if (indices.spx.price === 0) {
            const spxSegment = fullText.match(/(?:s&p\s*500|spx|إس آند بي 500|ستاندرد آند بورز|\.inx)([\s\S]*?)(?:ناسداك|nasdaq|\bixic\b|داو|dow|\bdji\b|$)/i);
            if (spxSegment && spxSegment[1]) {
              const res = extractMetricsFromText(spxSegment[1], "spx");
              if (res && res.price > 0 && res.price <= 12000) {
                indices.spx.price = res.price;
                indices.spx.changePercent = res.changePercent;
                indices.spx.change = res.change;
              }
            }
          }
        }
      }

      // Phase 3: Fallback SPX spot price
      if (indices.spx.price === 0 && window.__sahmSPXSpotPrice && window.__sahmSPXSpotPrice > 1000) {
        indices.spx.price = window.__sahmSPXSpotPrice;
      }
    } catch (e) {
      console.debug("[Sahm Parser] Error parsing US major indices:", e);
    }

    return indices;
  },

  /**
   * Extract top market summary bar (TASI, Nomu, Turnover, Volume, Advancing/Declining breadth)
   */
  parseMarketSummary() {
    const activeMarket = this.detectActiveMarket();
    const summary = {
      market: activeMarket,
      status: this.detectMarketStatus(),
      tasi: { price: 0, change: 0, changePercent: 0 },
      nomu: { price: 0, change: 0, changePercent: 0 },
      majorIndices: {
        spx: { name: "S&P 500", price: 0, changePercent: 0, change: 0 },
        nasdaq: { name: "ناسداك (Nasdaq)", price: 0, changePercent: 0, change: 0 },
        dow: { name: "داو جونز (Dow Jones)", price: 0, changePercent: 0, change: 0 }
      },
      turnover: 0,
      volume: 0,
      trades: 0,
      advancing: 0,
      declining: 0,
      unchanged: 0
    };

    if (activeMarket === "US") {
      summary.majorIndices = this.parseMajorIndices();
    }

    try {
      const textNodes = Array.from(document.querySelectorAll("div, span, p, section"));

      for (const el of textNodes) {
        if (!el.innerText || el.children.length > 5) continue;
        const txt = el.innerText.trim();

        // 1. TASI
        if ((txt.includes("تاسي") || txt.includes("TASI") || txt.includes("المؤشر العام")) && summary.tasi.price === 0) {
          const numbers = txt.match(/\d+([.,]\d+)?/g);
          if (numbers && numbers.length >= 1) {
            summary.tasi.price = this.cleanNumber(numbers[0]);
            if (numbers.length >= 2) summary.tasi.change = this.cleanNumber(numbers[1]);
          }
        }

        // 2. Nomu
        if ((txt.includes("نمو") || txt.includes("NOMU")) && summary.nomu.price === 0) {
          const numbers = txt.match(/\d+([.,]\d+)?/g);
          if (numbers && numbers.length >= 1) {
            summary.nomu.price = this.cleanNumber(numbers[0]);
            if (numbers.length >= 2) summary.nomu.change = this.cleanNumber(numbers[1]);
          }
        }

        // 3. Turnover (القيمة)
        if (txt.startsWith("القيمة") || txt.includes("قيمة التداول")) {
          const valMatch = txt.match(/[\d.,]+(\s*[KMBمليارمليونألف]+)?/i);
          if (valMatch && summary.turnover === 0) summary.turnover = this.cleanNumber(valMatch[0]);
        }

        // 4. Volume (الحجم)
        if (txt.startsWith("الحجم") || txt.includes("حجم التداول")) {
          const valMatch = txt.match(/[\d.,]+(\s*[KMBمليارمليونألف]+)?/i);
          if (valMatch && summary.volume === 0) summary.volume = this.cleanNumber(valMatch[0]);
        }

        // 5. Trades (الصفقات)
        if (txt.startsWith("الصفقات") || txt.includes("عدد الصفقات")) {
          const valMatch = txt.match(/[\d.,]+/);
          if (valMatch && summary.trades === 0) summary.trades = this.cleanNumber(valMatch[0]);
        }

        // 6. Breadth (ارتفاع / انخفاض)
        if (txt.includes("ارتفاع") || txt.includes("الشركات المرتفعة")) {
          const num = txt.match(/\d+/);
          if (num && summary.advancing === 0) summary.advancing = parseInt(num[0], 10);
        }
        if (txt.includes("انخفاض") || txt.includes("الشركات المنخفضة")) {
          const num = txt.match(/\d+/);
          if (num && summary.declining === 0) summary.declining = parseInt(num[0], 10);
        }
        if (txt.includes("بدون تغيير") || txt.includes("مستقرة")) {
          const num = txt.match(/\d+/);
          if (num && summary.unchanged === 0) summary.unchanged = parseInt(num[0], 10);
        }
      }
    } catch (e) {
      console.debug("[Sahm Parser] Error parsing market summary:", e);
    }

    return summary;
  },

  /**
   * Universal Heuristic Column Mapper
   */
  detectColumnMapping(headerRow) {
    const mapping = {};
    if (!headerRow) return mapping;

    const cells = headerRow.querySelectorAll("th, td, [role='columnheader'], .cell, .header-cell, div");
    cells.forEach((cell, idx) => {
      const text = cell.innerText ? cell.innerText.trim() : "";
      if (!text) return;

      const norm = text.replace(/\s+/g, " ");

      if (/الرمز\s*[\/\\]\s*الاسم|رمز\s*[\/\\]\s*اسم/i.test(norm)) {
        mapping.symbol_name = idx;
      } else if (/^الرمز$|^كود$|^رمز السهم$|^symbol$/i.test(norm)) {
        mapping.symbol = idx;
      } else if (/^الاسم$|^اسم الشركة$|^الشركة$|^name$/i.test(norm)) {
        mapping.name = idx;
      } else if (/^السعر$|^آخر سعر$|^اخر سعر$|^سعر الإغلاق$|^price$|^last$/i.test(norm)) {
        mapping.price = idx;
      } else if (/التغير\s*[%٪]|^[%٪]$|نسبة التغير/i.test(norm)) {
        mapping.changePercent = idx;
      } else if (/^التغير$|^قيمة التغير$|^change$/i.test(norm)) {
        mapping.changeAmount = idx;
      } else if (/^الصفقات$|^عدد الصفقات$|^صفقات$|^trades$/i.test(norm)) {
        mapping.trades = idx;
      } else if (/^الحجم$|^حجم التداول$|^الكمية$|^volume$/i.test(norm)) {
        mapping.volume = idx;
      } else if (/^القيمة$|^قيمة التداول$|^turnover$|^value$/i.test(norm)) {
        mapping.turnover = idx;
      } else if (/سعر الطلب|^الطلب$|^طلب$|^bid$/i.test(norm)) {
        mapping.bidPrice = idx;
      } else if (/سعر العرض|^العرض$|^عرض$|^ask$/i.test(norm)) {
        mapping.askPrice = idx;
      } else if (/^مفتوح$|^افتتاح$|^سعر الافتتاح$|^open$/i.test(norm)) {
        mapping.open = idx;
      } else if (/^الأعلى$|^أعلى$|^high$/i.test(norm)) {
        mapping.high = idx;
      } else if (/^الأدنى$|^أدنى$|^low$/i.test(norm)) {
        mapping.low = idx;
      }
    });

    return mapping;
  },

  /**
   * Main Market Table Extractor
   */
  parseMarketTable() {
    const stocks = [];
    const marketSummary = this.parseMarketSummary();
    const activeMarket = marketSummary.market;

    const candidates = document.querySelectorAll(
      "table, [role='table'], [role='grid'], .el-table, .ant-table, .market-table, .stock-table, #market-overview-table"
    );

    let bestContainer = null;
    let bestMapping = null;
    let bestScore = 0;
    let bestHeaderRow = null;

    candidates.forEach((cand) => {
      const headerRow = cand.querySelector("thead tr, tr:first-child, [role='row']:first-child, .el-table__header-wrapper tr");
      if (!headerRow) return;

      const mapping = this.detectColumnMapping(headerRow);
      const score = Object.keys(mapping).length;

      if (score >= 3 && score > bestScore) {
        bestScore = score;
        bestContainer = cand;
        bestMapping = mapping;
        bestHeaderRow = headerRow;
      }
    });

    let rows = [];
    if (bestContainer) {
      rows = Array.from(bestContainer.querySelectorAll("tbody tr, [role='row'], .el-table__row"));
      if (bestHeaderRow) {
        rows = rows.filter((r) => r !== bestHeaderRow && !r.querySelector("th"));
      }
    } else {
      rows = Array.from(document.querySelectorAll("table tbody tr, tr[data-symbol]"));
    }

    rows.forEach((row, index) => {
      const cells = row.querySelectorAll("td, [role='cell'], [role='gridcell']");
      if (cells.length < 3) return;

      try {
        let symbol = "";
        let name = "";
        let price = 0;
        let changePercent = 0;
        let changeAmount = 0;
        let volume = 0;
        let turnover = 0;
        let trades = 0;
        let bid = 0;
        let ask = 0;
        let high = 0;
        let low = 0;
        let open = 0;

        // 1. Direct Extraction via Sahm exact data-col-key attributes
        const colSymbol = row.querySelector('td[data-col-key="symbol"], [data-col-key="symbol"]');
        const colPrice = row.querySelector('td[data-col-key="lastPrice"], [data-col-key="lastPrice"]');
        const colChg = row.querySelector('td[data-col-key="chg"], [data-col-key="chg"]');
        const colBid = row.querySelector('td[data-col-key="bid"], [data-col-key="bid"]');
        const colAsk = row.querySelector('td[data-col-key="ask"], [data-col-key="ask"]');
        const colCap = row.querySelector('td[data-col-key="totalMarketCap"], [data-col-key="totalMarketCap"]');
        const colRange = row.querySelector('td[data-col-key="highAndLowLimited"], [data-col-key="highAndLowLimited"]');
        const colVol = row.querySelector('td[data-col-key="volume"], [data-col-key="volume"]');

        if (colSymbol || colPrice) {
          if (colSymbol) {
            const sText = colSymbol.innerText.trim();
            const sParts = sText.split("\n").map((p) => p.trim()).filter(Boolean);
            symbol = sParts[0] || sText;
            name = sParts[1] || symbol;
          }
          if (colPrice) price = this.cleanNumber(colPrice.innerText);
          if (colChg) changePercent = this.cleanNumber(colChg.innerText);
          if (colBid) bid = this.cleanNumber(colBid.innerText);
          if (colAsk) ask = this.cleanNumber(colAsk.innerText);
          if (colCap) turnover = this.cleanNumber(colCap.innerText);
          if (colVol) volume = this.cleanNumber(colVol.innerText);
          if (colRange) {
            const rNums = colRange.innerText.match(/\d+([.,]\d+)?/g);
            if (rNums && rNums.length >= 2) {
              high = this.cleanNumber(rNums[0]);
              low = this.cleanNumber(rNums[1]);
            }
          }
        } else if (bestMapping && Object.keys(bestMapping).length >= 3) {
          if (bestMapping.symbol_name !== undefined && cells[bestMapping.symbol_name]) {
            const rawText = cells[bestMapping.symbol_name].innerText.trim();
            const parts = rawText.split("\n").map((p) => p.trim()).filter(Boolean);
            symbol = parts[0] || "";
            name = parts[1] || symbol;
          } else {
            if (bestMapping.symbol !== undefined && cells[bestMapping.symbol]) {
              symbol = cells[bestMapping.symbol].innerText.trim();
            }
            if (bestMapping.name !== undefined && cells[bestMapping.name]) {
              name = cells[bestMapping.name].innerText.trim();
            }
          }

          if (bestMapping.price !== undefined && cells[bestMapping.price]) {
            price = this.cleanNumber(cells[bestMapping.price].innerText);
          }
          if (bestMapping.changePercent !== undefined && cells[bestMapping.changePercent]) {
            changePercent = this.cleanNumber(cells[bestMapping.changePercent].innerText);
          }
          if (bestMapping.changeAmount !== undefined && cells[bestMapping.changeAmount]) {
            changeAmount = this.cleanNumber(cells[bestMapping.changeAmount].innerText);
          }
          if (bestMapping.volume !== undefined && cells[bestMapping.volume]) {
            volume = this.cleanNumber(cells[bestMapping.volume].innerText);
          }
          if (bestMapping.turnover !== undefined && cells[bestMapping.turnover]) {
            turnover = this.cleanNumber(cells[bestMapping.turnover].innerText);
          }
          if (bestMapping.trades !== undefined && cells[bestMapping.trades]) {
            trades = this.cleanNumber(cells[bestMapping.trades].innerText);
          }
          if (bestMapping.bidPrice !== undefined && cells[bestMapping.bidPrice]) {
            bid = this.cleanNumber(cells[bestMapping.bidPrice].innerText);
          }
          if (bestMapping.askPrice !== undefined && cells[bestMapping.askPrice]) {
            ask = this.cleanNumber(cells[bestMapping.askPrice].innerText);
          }
          if (bestMapping.high !== undefined && cells[bestMapping.high]) {
            high = this.cleanNumber(cells[bestMapping.high].innerText);
          }
          if (bestMapping.low !== undefined && cells[bestMapping.low]) {
            low = this.cleanNumber(cells[bestMapping.low].innerText);
          }
          if (bestMapping.open !== undefined && cells[bestMapping.open]) {
            open = this.cleanNumber(cells[bestMapping.open].innerText);
          }
        } else {
          const rawCell0 = cells[0].innerText.trim().split("\n");
          symbol = row.getAttribute("data-symbol") || rawCell0[0] || "";
          name = rawCell0[1] || (cells[1] ? cells[1].innerText.trim() : symbol);
          price = this.cleanNumber(cells[2]?.innerText || "0");
          changePercent = this.cleanNumber(cells[3]?.innerText || "0");
          volume = this.cleanNumber(cells[4]?.innerText || "0");
          turnover = this.cleanNumber(cells[5]?.innerText || "0");
          bid = this.cleanNumber(cells[6]?.innerText || "0");
          ask = this.cleanNumber(cells[7]?.innerText || "0");
        }

        if (!symbol || symbol.length > 8) {
          const rowText = row.innerText;
          const matchCode = rowText.match(/\b([1-9]\d{3}|[A-Z]{1,5})\b/);
          if (matchCode) {
            symbol = matchCode[1];
          }
        }

        let isUp = changePercent > 0;
        let isDown = changePercent < 0;

        if (symbol && (price > 0 || volume > 0)) {
          // Identify market for the stock
          const isSaudiStock = /^\d{4}$/.test(symbol);
          stocks.push({
            id: `stock_${index}_${symbol}`,
            symbol: symbol.toUpperCase(),
            name: name || symbol,
            market: isSaudiStock ? "SA" : "US",
            price: price,
            changePercent: changePercent,
            changeAmount: changeAmount,
            trend: isUp ? "UP" : isDown ? "DOWN" : "FLAT",
            volume: volume,
            turnover: turnover,
            trades: trades,
            bid: bid,
            ask: ask,
            high: high,
            low: low,
            open: open,
            timestamp: Date.now()
          });
        }
      } catch (err) {
        console.debug("[Sahm Parser] Skipping row parse error:", err);
      }
    });

    const majorIndices = marketSummary.majorIndices || (activeMarket === "US" ? this.parseMajorIndices() : null);

    return {
      stocks: stocks,
      activeMarket: activeMarket,
      summary: marketSummary,
      majorIndices: majorIndices,
      matchedColumns: bestMapping ? Object.keys(bestMapping) : [],
      count: stocks.length
    };
  }
};
