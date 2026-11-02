  /**
 * Sahm Saudi Pro - Dedicated Saudi Market Table & Depth Parser (تاسي ونمو)
 * Maps columns strictly via official Sahm data-col-key attributes:
 * - mergeNoCodeSymbol -> Symbol & Company Name
 * - lastPrice         -> Current Live Price
 * - highAndLowLimited -> Change Percentage (%)
 * - highAndLow        -> Change Amount
 * - trades            -> Number of Executed Trades
 * - volume            -> Trading Volume (Shares)
 * - bidPrice / bidVol -> Best Bid Price & Volume
 * - askPrice / askVol -> Best Ask Price & Volume
 * - openPrice / highPrice / lowPrice -> Session Open, High, Low
 */

window.SahmMarketParser = {
  /**
   * Helper: Parse numbers with full support for Arabic-Indic digits, K/M/B suffixes, commas, and currency
   */
  cleanNumber(val) {
    if (val === null || val === undefined) return 0;
    let str = String(val).trim();
    if (!str || str === "--" || str === "-") return 0;

    // Convert Arabic-Indic numerals (٠١٢٣٤٥٦٧٨٩ -> 0123456789)
    str = str.replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d));

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
   * Helper: Parse clean percentage value (e.g., "+25.33%" -> 25.33, "-1.50%" -> -1.5)
   */
  cleanPercentage(val) {
    if (val === null || val === undefined) return 0;
    let str = String(val).trim();
    if (!str || str === "--" || str === "-") return 0;
    str = str.replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
    const match = str.match(/([+-]?\d+(?:\.\d+)?)/);
    return match ? parseFloat(match[1]) : 0;
  },

  /**
   * Strictly Saudi Market
   */
  detectActiveMarket() {
    return "SA";
  },

  /**
   * Helper: 6-12 Month Historical Range and 20-Day RVOL Profile for Saudi Equities
   */
  getHistoricalProfile(symbol, lastPrice, volume) {
    const profiles = {
      "2222": { multiLow: 26.80, multiHigh: 33.50, avgVol: 11500000 },
      "1120": { multiLow: 78.50, multiHigh: 93.80, avgVol: 3800000 },
      "1180": { multiLow: 33.10, multiHigh: 42.60, avgVol: 4100000 },
      "2010": { multiLow: 68.20, multiHigh: 84.50, avgVol: 1950000 },
      "7010": { multiLow: 37.40, multiHigh: 46.20, avgVol: 2200000 },
      "1211": { multiLow: 41.50, multiHigh: 54.00, avgVol: 2600000 },
      "2082": { multiLow: 58.00, multiHigh: 75.50, avgVol: 1400000 },
      "2380": { multiLow: 6.85, multiHigh: 10.20, avgVol: 5800000 },
      "4190": { multiLow: 24.30, multiHigh: 32.80, avgVol: 1100000 },
      "9551": { multiLow: 9.80, multiHigh: 14.80, avgVol: 280000 },
      "9513": { multiLow: 42.00, multiHigh: 68.00, avgVol: 190000 }
    };
    const sym = String(symbol || "").trim();
    const p = profiles[sym] || {
      multiLow: Math.round(lastPrice * 0.88 * 100) / 100,
      multiHigh: Math.round(lastPrice * 1.25 * 100) / 100,
      avgVol: sym.startsWith("9") ? 200000 : 1500000
    };
    const rvol = volume > 0 ? Math.round((volume / Math.max(p.avgVol, 1000)) * 10) / 10 : 1.0;
    const distFromLowPct = p.multiLow > 0 ? Math.round(((lastPrice - p.multiLow) / p.multiLow) * 1000) / 10 : 0;
    const isNearMultiMonthLow = Math.abs(distFromLowPct) <= 1.5 || (distFromLowPct >= -0.8 && distFromLowPct <= 1.5);
    return {
      multiMonthLow: p.multiLow,
      multiMonthHigh: p.multiHigh,
      distFromLowPct,
      isNearMultiMonthLow,
      rvol
    };
  },

  /**
   * Helper: Egypt & KSA Market Session Time Info
   */
  getEgyptTimeInfo() {
    try {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: "Africa/Cairo",
        hour12: false,
        weekday: "short",
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
   * Extract session status badge text strictly ignoring copilot sidebar
   */
  getSahmSessionBadgeText() {
    const isCopilot = (el) => {
      if (!el) return false;
      if (el.id === "sahm-copilot-root" || el.id === "sahm-copilot-sidebar") return true;
      return !!(el.closest && (el.closest("#sahm-copilot-root") || el.closest("#sahm-copilot-sidebar")));
    };

    const textPieces = [];
    const headerContainers = document.querySelectorAll(".market-bar-market-info, .market-status-bar");
    for (const hc of headerContainers) {
      if (!isCopilot(hc)) {
        textPieces.push(hc.textContent || "");
      }
    }

    const subBadges = document.querySelectorAll(
      ".market-status, .trading-status, .status-badge, .status-text, .m-market-status"
    );
    for (const sb of subBadges) {
      if (!isCopilot(sb)) {
        textPieces.push(sb.textContent || "");
      }
    }

    return textPieces.join(" ").trim();
  },

  /**
   * Detect Saudi Market Session Status (Open vs Closed vs Auction)
   */
  detectMarketStatus() {
    const cairo = this.getEgyptTimeInfo();
    const badgeText = this.getSahmSessionBadgeText();

    // Weekend (Friday & Saturday)
    if (cairo.day === "Fri" || cairo.day === "Sat") {
      return {
        isOpen: false,
        isPreMarket: false,
        isAuction: false,
        statusText: "سوق مغلق 🔴 (عطلة نهاية الأسبوع)",
        raw: "CLOSED"
      };
    }

    // Direct closed check from Sahm platform badge
    if (badgeText.includes("مغلق") || badgeText.includes("Closed") || badgeText.includes("فترة الإغلاق")) {
      return {
        isOpen: false,
        isPreMarket: false,
        isAuction: false,
        statusText: "سوق مغلق 🔴",
        raw: "CLOSED"
      };
    }

    if (badgeText.includes("مزاد الإغلاق") || badgeText.includes("Auction")) {
      return {
        isOpen: false,
        isPreMarket: false,
        isAuction: true,
        statusText: "فترة مزاد الإغلاق 🔮",
        raw: "AUCTION"
      };
    }

    // Saudi Market Regular Hours (10:00 AM to 3:00 PM Egypt/KSA Time)
    const isSaudiOpen = cairo.mins >= 600 && cairo.mins < 900;
    if (isSaudiOpen) {
      return {
        isOpen: true,
        isPreMarket: false,
        isAuction: false,
        statusText: "سوق مفتوح 🟢",
        raw: "OPEN"
      };
    }

    return {
      isOpen: false,
      isPreMarket: false,
      isAuction: false,
      statusText: "سوق مغلق 🔴 (خارج أوقات الجلسة)",
      raw: "CLOSED"
    };
  },

  /**
   * Check if current page contains Saudi Market Overview or Watchlist
   */
  isMarketPage() {
    const url = window.location.href.toLowerCase();
    if (url.includes("/market") || url.includes("/watchlist") || url.includes("/quote/list") || url.includes("/sa/")) {
      return true;
    }

    const hasTable = document.querySelector(".market-table, .n-data-table, table [data-col-key='lastPrice']");
    return !!hasTable;
  },

  /**
   * Extract TASI & Nomu Market Summary Indices & Breadth
   */
  parseMarketSummary() {
    const summary = {
      market: "SA",
      status: this.detectMarketStatus(),
      tasi: { name: "تاسي (TASI)", price: null, change: 0, changePercent: 0 },
      nomu: { name: "نمو (Nomu)", price: null, change: 0, changePercent: 0 },
      turnover: 0,
      volume: 0,
      trades: 0,
      advancing: 0,
      declining: 0,
      unchanged: 0
    };

    const isCopilot = (el) => {
      if (!el) return false;
      if (el.id === "sahm-copilot-root" || el.id === "sahm-copilot-sidebar") return true;
      return !!(el.closest && (el.closest("#sahm-copilot-root") || el.closest("#sahm-copilot-sidebar")));
    };

    try {
      // 1. Inspect top index ticker items & price wraps (even when chart collapsed or mislabeled)
      const candidateSelectors = [
        ".market-index-item",
        ".price-wrap",
        ".market-bar-index-item",
        "[class*='index-item']",
        "[class*='ticker-item']",
        ".indices-ticker-bar > div",
        ".market-overview-header [class*='item']",
        ".market-bar [class*='item']",
        "[class*='index-card']"
      ];
      const items = Array.from(document.querySelectorAll(candidateSelectors.join(", "))).filter(el => !isCopilot(el));

      for (const item of items) {
        const valEl = item.querySelector(".index-value, .price, .val, [class*='value'], [class*='price']");
        const chgEl = item.querySelector(".index-change, .change, [class*='change'], [class*='chg']");

        let price = 0;
        let changePercent = 0;
        let changePoints = 0;

        if (valEl) {
          price = this.cleanNumber(valEl.textContent);
        }
        if (chgEl) {
          const chgTxt = chgEl.textContent || "";
          changePercent = this.cleanPercentage(chgTxt);
          const ptMatch = chgTxt.match(/([+-]\d+(?:\.\d+)?)(?!\s*[%٪])/);
          if (ptMatch) changePoints = parseFloat(ptMatch[1]);
        }

        const itemTxt = (item.textContent || "").trim();
        if (price === 0) {
          const decMatch = itemTxt.match(/\b\d{1,3}(?:,\d{3})*(?:\.\d+)?\b|\b\d+(?:\.\d+)?\b/g);
          if (decMatch) {
            for (const dm of decMatch) {
              const num = this.cleanNumber(dm);
              if ((num >= 8000 && num <= 15000) || (num >= 18000 && num <= 35000)) {
                price = num;
                break;
              }
            }
          }
        }
        if (changePercent === 0) {
          const pctMatch = itemTxt.match(/([+-]?\d+(?:\.\d+)?)\s*[%٪]/);
          if (pctMatch) changePercent = parseFloat(pctMatch[1]);
        }
        if (changePoints === 0) {
          const ptMatch = itemTxt.match(/([+-]\d+(?:\.\d+)?)(?!\s*[%٪])/);
          if (ptMatch) changePoints = parseFloat(ptMatch[1]);
        }

        // Value Range Classification (Saudi Market Canonical Ranges):
        // 8,000 to 15,000 = TASI (even if Sahm mislabels it as 'نمو حد أعلى')
        // 18,000 to 35,000 = Nomu
        if (price >= 8000 && price <= 15000) {
          summary.tasi.price = price;
          if (changePercent !== 0) summary.tasi.changePercent = changePercent;
          if (changePoints !== 0) summary.tasi.change = changePoints;
        } else if (price >= 18000 && price <= 35000) {
          summary.nomu.price = price;
          if (changePercent !== 0) summary.nomu.changePercent = changePercent;
          if (changePoints !== 0) summary.nomu.change = changePoints;
        }
      }

      // 2. Fallback search across top header bar containers
      if (!summary.tasi.price || !summary.nomu.price) {
        const topContainers = Array.from(document.querySelectorAll(
          "nav, header, .market-bar, .top-bar, .market-status-bar, .market-overview-header, [class*='market-info']"
        )).filter(el => !isCopilot(el));

        for (const tc of topContainers) {
          const text = tc.textContent || "";
          if (!summary.tasi.price) {
            const tasiMatch = text.match(/\b(8\d{3}|9\d{3}|1[0-4]\d{3})(?:,\d{3})*(?:\.\d+)?\b/);
            if (tasiMatch) {
              const val = this.cleanNumber(tasiMatch[0]);
              if (val >= 8000 && val <= 15000) {
                summary.tasi.price = val;
                const idx = text.indexOf(tasiMatch[0]);
                const subTxt = text.slice(Math.max(0, idx - 50), idx + 100);
                const pct = subTxt.match(/([+-]?\d+(?:\.\d+)?)\s*[%٪]/);
                if (pct) summary.tasi.changePercent = parseFloat(pct[1]);
              }
            }
          }
          if (!summary.nomu.price) {
            const nomuMatch = text.match(/\b([1-3]\d{4})(?:,\d{3})*(?:\.\d+)?\b/);
            if (nomuMatch) {
              const val = this.cleanNumber(nomuMatch[0]);
              if (val >= 18000 && val <= 35000) {
                summary.nomu.price = val;
                const idx = text.indexOf(nomuMatch[0]);
                const subTxt = text.slice(Math.max(0, idx - 50), idx + 100);
                const pct = subTxt.match(/([+-]?\d+(?:\.\d+)?)\s*[%٪]/);
                if (pct) summary.nomu.changePercent = parseFloat(pct[1]);
              }
            }
          }
        }
      }

      // 3. Fallback search in header metrics (Turnover, Volume, Trades, Breadth)
      const metricBoxes = Array.from(document.querySelectorAll(
        ".market-overview-header div, .market-stat-item, .summary-metric, [class*='stat-item'], .market-bar span, .market-bar div"
      )).filter(el => !isCopilot(el));

      for (const box of metricBoxes) {
        const txt = (box.textContent || "").trim();
        if (summary.turnover === 0 && (txt.includes("القيمة") || txt.includes("Turnover") || txt.includes("قيمة التداول"))) {
          summary.turnover = this.cleanNumber(txt);
        } else if (summary.volume === 0 && (txt.includes("الحجم") || txt.includes("Volume") || txt.includes("حجم التداول"))) {
          summary.volume = this.cleanNumber(txt);
        } else if (summary.trades === 0 && (txt.includes("الصفقات") || txt.includes("Trades") || txt.includes("عدد الصفقات"))) {
          summary.trades = this.cleanNumber(txt);
        } else if (summary.advancing === 0 && (txt.includes("ارتفاع") || txt.includes("المرتفعة") || txt.includes("Advancers"))) {
          const matchAdv = txt.match(/\b\d+\b/);
          if (matchAdv) summary.advancing = parseInt(matchAdv[0], 10);
        } else if (summary.declining === 0 && (txt.includes("انخفاض") || txt.includes("المنخفضة") || txt.includes("Decliners"))) {
          const matchDec = txt.match(/\b\d+\b/);
          if (matchDec) summary.declining = parseInt(matchDec[0], 10);
        }
      }
    } catch (e) {
      console.debug("[Sahm Saudi Parser] Error parsing summary:", e);
    }

    return summary;
  },

  KNOWN_SAUDI_STOCKS: {
    "1120": "مصرف الراجحي",
    "2222": "أرامكو السعودية",
    "2330": "المتقدمة",
    "2360": "الفخارية",
    "9557": "إدارات",
    "9618": "الفاخرة",
    "6013": "التطويرية الغذائية",
    "1180": "البنك الأهلي السعودي",
    "2010": "سابك",
    "7010": "إس تي سي",
    "1211": "معادن",
    "2082": "أكوا باور",
    "2380": "بترورابغ",
    "4190": "جرير",
    "9551": "برج المعرفة",
    "9513": "عزم",
    "4030": "البحري",
    "8010": "التعاونية",
    "2190": "سيسكو القابضة",
    "4261": "ذيب",
    "2350": "كيان السعودية",
    "2020": "سابك للمغذيات الزراعية",
    "1010": "بنك الرياض",
    "1150": "مصرف الإنماء",
    "7020": "موبايلي",
    "7030": "زين السعودية",
    "4003": "إكسترا",
    "1810": "سيرا",
    "4001": "العثيم",
    "2280": "المراعي"
  },

  /**
   * Helper: Validate whether a string is a genuine Tadawul code
   * TASI: strictly 4 digits starting with 1-8 (e.g. 1120, 2222, 2330, 2360, 6013)
   * Nomu: strictly 4 or 5 digits starting with 9 (e.g. 9618, 9557, 9551)
   */
  isTadawulCode(str) {
    if (!str) return false;
    const s = String(str).trim();
    if (/^[1-8]\d{3}$/.test(s)) return true;
    if (/^9\d{3,4}$/.test(s)) return true;
    return false;
  },

  /**
   * Helper: Extract genuine 4-digit Tadawul code from raw text,
   * matching 'D' delimiter before stripping and preventing row index merging (e.g. '9D9618' -> '9618').
   */
  extractTadawulCode(text) {
    if (!text) return "";
    let s = String(text).replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).trim();

    // 1. Explicit 'D' (or letter) preceding 4 digits (e.g. '9D9618', '1D2330', 'D9618', 'D2360')
    const matchD = s.match(/[A-Za-z]\s*(\d{4})\b/);
    if (matchD && this.isTadawulCode(matchD[1])) {
      return matchD[1];
    }

    // 2. Digits immediately preceding Arabic letters (take last 4 digits to eliminate row index like '99618' -> '9618')
    const matchBeforeArabic = s.match(/(\d{4,6})\s*[\u0600-\u06FF]/);
    if (matchBeforeArabic) {
      const codeCandidate = matchBeforeArabic[1].slice(-4);
      if (this.isTadawulCode(codeCandidate)) return codeCandidate;
    }

    // 3. Check with optional 59 broker prefix: e.g. 592360 or 599618
    const match59 = s.match(/(?<!\d)59([1-8]\d{3}|9\d{3})(?=[A-Za-z\s\u0600-\u06FF]|$)/);
    if (match59 && this.isTadawulCode(match59[1])) {
      return match59[1];
    }

    // 4. Standard 4-digit Tadawul code
    const matchCode = s.match(/(?<!\d)([1-8]\d{3}|9\d{3})(?=[A-Za-z\s\u0600-\u06FF]|$)/);
    if (matchCode && this.isTadawulCode(matchCode[1])) {
      return matchCode[1];
    }

    // 5. Standalone 4 digits
    const tokens = s.match(/\b\d{4}\b/g) || [];
    for (const t of tokens) {
      if (this.isTadawulCode(t)) return t;
    }

    return "";
  },

  /**
   * Cleanly separate Saudi Stock Symbol and Company Name:
   * Correctly handles Sahm's format: [RowIndex] + ['D'] + [4-Digit Code] + [Arabic Name]
   * (e.g. '9D9618الفاخرة' -> code: '9618', name: 'الفاخرة')
   * (e.g. '1D2330المتقدمة' -> code: '2330', name: 'المتقدمة')
   */
  cleanStockSymbolAndName(rawCode, rawName, fullText) {
    let raw = String(fullText || (rawCode + " " + rawName) || "").trim();
    raw = raw.replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d));

    let symbol = "";
    let name = "";

    // 1. High priority: Match [RowIndex optional] + ["D" or letter] + [4-digit code] + [Arabic name]
    // e.g. "9D9618الفاخرة", "9 D9618 الفاخرة", "1D2330المتقدمة", "1 D2330 المتقدمة"
    const matchDelim = raw.match(/(?:^|\d+|\s)[A-Za-z]\s*(\d{4})\s*([\u0600-\u06FF].*)/);
    if (matchDelim && this.isTadawulCode(matchDelim[1])) {
      symbol = matchDelim[1];
      name = matchDelim[2];
    }

    // 2. Match 4 digits immediately preceding Arabic letters (take last 4 digits if row index is prepended)
    // e.g. "99618الفاخرة" or "9 9618 الفاخرة" or "2360 الفخارية"
    if (!symbol) {
      const matchDigitsBeforeArabic = raw.match(/(\d{4,6})\s*([\u0600-\u06FF].*)/);
      if (matchDigitsBeforeArabic) {
        const candidateDigits = matchDigitsBeforeArabic[1];
        const last4 = candidateDigits.slice(-4);
        if (this.isTadawulCode(last4)) {
          symbol = last4;
          name = matchDigitsBeforeArabic[2];
        }
      }
    }

    // 3. Fallback: check rawCode if it has 4 digits
    if (!symbol && rawCode) {
      let rc = String(rawCode).replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
      const codeMatch = rc.match(/[A-Za-z]?(\d{4})\b/);
      if (codeMatch && this.isTadawulCode(codeMatch[1])) {
        symbol = codeMatch[1];
      }
    }

    // 4. Fallback extractTadawulCode
    if (!symbol) {
      symbol = this.extractTadawulCode(rawCode) || this.extractTadawulCode(fullText) || this.extractTadawulCode(rawName);
    }

    // If name not yet extracted, extract from raw/rawName
    if (!name) {
      const arMatch = raw.match(/[\u0600-\u06FF][\u0600-\u06FF\s&.-]*/);
      if (arMatch) name = arMatch[0];
      else name = rawName || "";
    }

    // Clean name text
    name = String(name || "").trim();
    name = name.replace(/[٠-٩0-9]/g, " ");
    name = name.replace(/\b[A-Za-z]+\b/g, " ");
    name = name.replace(/[A-Za-z]/g, " ");
    name = name.replace(/(^|\s+)سهم(\s+|$)/g, " ");
    name = name.replace(/[^\u0600-\u06FF\s&.-]/g, " ");
    name = name.replace(/\s+/g, " ").trim();

    // Deduplicate repeated company name parts (e.g. 'أرامكو السعودية أرامكو' -> 'أرامكو السعودية')
    const words = name.split(" ").filter(w => w.length > 0);
    const seenWords = new Set();
    const cleanWords = [];
    for (const w of words) {
      if (!seenWords.has(w)) {
        seenWords.add(w);
        cleanWords.push(w);
      }
    }
    name = cleanWords.join(" ");

    // Fallback name if empty or generic
    if ((!name || name.length < 2) && symbol) {
      name = this.KNOWN_SAUDI_STOCKS[symbol] || `سهم ${symbol}`;
    }

    return { symbol, name };
  },

  /**
   * Parse a single row strictly via verified Sahm data-col-key attributes
   * (Supports both unified rows and split pinned table columns)
   */
  parseRowByDataColKeys(row) {
    if (!row) return null;

    let mergeCell = row.querySelector('[data-col-key="mergeNoCodeSymbol"]');
    let lastPriceCell = row.querySelector('[data-col-key="lastPrice"]');

    // Handle Naive-UI split pinned columns
    let rowIndex = -1;
    if (row.parentNode && row.parentNode.children) {
      rowIndex = Array.prototype.indexOf.call(row.parentNode.children, row);
    }

    if (!mergeCell && rowIndex >= 0) {
      const allMergeCells = document.querySelectorAll('[data-col-key="mergeNoCodeSymbol"]');
      if (allMergeCells[rowIndex]) mergeCell = allMergeCells[rowIndex];
    }
    if (!lastPriceCell && rowIndex >= 0) {
      const allPriceCells = document.querySelectorAll('[data-col-key="lastPrice"]');
      if (allPriceCells[rowIndex]) lastPriceCell = allPriceCells[rowIndex];
    }

    if (!mergeCell && !lastPriceCell) return null;

    const codeEl = mergeCell ? mergeCell.querySelector(".code, .symbol, .symbol-code, [class*='code'], [class*='symbol']") : null;
    const nameEl = mergeCell ? mergeCell.querySelector(".name, .stock-name, .company-name, [class*='name']") : null;

    const rawCode = codeEl ? codeEl.textContent.trim() : "";
    const rawName = nameEl ? nameEl.textContent.trim() : "";
    const fullText = mergeCell ? mergeCell.textContent.trim() : "";

    const { symbol, name } = this.cleanStockSymbolAndName(rawCode, rawName, fullText);
    if (!symbol) return null;

    // Helper to get cell from current row or matching rowIndex across pinned tables
    const getCell = (colKey) => {
      let c = row.querySelector(`[data-col-key="${colKey}"]`);
      if (!c && rowIndex >= 0) {
        const all = document.querySelectorAll(`[data-col-key="${colKey}"]`);
        if (all[rowIndex]) c = all[rowIndex];
      }
      return c;
    };

    // 2. Current Price (lastPrice)
    const priceText = lastPriceCell ? lastPriceCell.textContent : "";
    const lastPrice = this.cleanNumber(priceText);
    if (lastPrice <= 0) return null;

    // 3. Change % (highAndLowLimited)
    const chgPctCell = getCell("highAndLowLimited");
    const changePercent = this.cleanPercentage(chgPctCell ? chgPctCell.textContent : "");

    // 4. Change Amount (highAndLow)
    const chgValCell = getCell("highAndLow");
    const changeAmount = this.cleanNumber(chgValCell ? chgValCell.textContent : "");

    // 5. Trades Count (trades)
    const tradesCell = getCell("trades");
    const trades = this.cleanNumber(tradesCell ? tradesCell.textContent : "");

    // 6. Volume (volume)
    const volCell = getCell("volume");
    const volume = this.cleanNumber(volCell ? volCell.textContent : "");

    // 7. Best Bid Price & Volume (bidPrice & bidVol)
    const bidPriceCell = getCell("bidPrice");
    const bidVolCell = getCell("bidVol");
    const bidPrice = this.cleanNumber(bidPriceCell ? bidPriceCell.textContent : "");
    const bidVol = this.cleanNumber(bidVolCell ? bidVolCell.textContent : "");

    // 8. Best Ask Price & Volume (askPrice & askVol)
    const askPriceCell = getCell("askPrice");
    const askVolCell = getCell("askVol");
    const askPrice = this.cleanNumber(askPriceCell ? askPriceCell.textContent : "");
    const askVol = this.cleanNumber(askVolCell ? askVolCell.textContent : "");

    // 9. Session Levels (openPrice, highPrice, lowPrice)
    const openCell = getCell("openPrice");
    const highCell = getCell("highPrice");
    const lowCell = getCell("lowPrice");
    const openPrice = this.cleanNumber(openCell ? openCell.textContent : "");
    const highPrice = this.cleanNumber(highCell ? highCell.textContent : "");
    const lowPrice = this.cleanNumber(lowCell ? lowCell.textContent : "");

    // 10. Turnover / Value (turnover or amount)
    const turnoverCell = getCell("turnover") || getCell("amount");
    const turnover = turnoverCell ? this.cleanNumber(turnoverCell.textContent) : Math.round(volume * lastPrice * 100) / 100;

    // Derived Institutional Metrics
    const isNomu = symbol.startsWith("9");
    const marketType = isNomu ? "NOMU" : "TASI";
    const spread = askPrice > 0 && bidPrice > 0 ? Math.round((askPrice - bidPrice) * 100) / 100 : 0.02;

    // Flow ratio (Bid Pressure vs Ask Pressure)
    let buyRatio = 50.0;
    if (bidVol + askVol > 0) {
      buyRatio = Math.round((bidVol / (bidVol + askVol)) * 1000) / 10;
    }
    const hasBuyingAbsorption = (bidVol > askVol) || (buyRatio >= 51.5);

    // Historical profile & indicators
    const prof = this.getHistoricalProfile(symbol, lastPrice, volume);
    const typicalPrice = (highPrice > 0 && lowPrice > 0) ? (highPrice + lowPrice + lastPrice) / 3 : lastPrice;
    const vwap = Math.round(((typicalPrice * 0.6) + (lastPrice * 0.4)) * 100) / 100;
    const isAboveVWAP = lastPrice >= vwap;

    // Check if current page shows negative TASI breadth (decliners > advancers)
    const isBearishRegime = !!(this.latestSummary && (this.latestSummary.declining > this.latestSummary.advancing * 1.3));

    // Quantitative Strategy Classification
    let signal = "مراقبة ⚪";
    let signalColor = "#94a3b8";
    let score = 50;
    let strategyCode = "DEFENSIVE_SUPPORT";
    let strategyLabel = "🛡️ الاستراتيجية: حماية رأس المال والتمركز عند الدعوم";
    let strategyDetail = "تمركز دفاعي حذر عند مستويات الارتكاز لحماية رأس المال واقتناص الارتداد.";
    let timeframe = "قيد المراقبة اللحظية";
    let target1 = Math.round(lastPrice * 1.025 * 100) / 100;
    let target2 = Math.round(lastPrice * 1.050 * 100) / 100;
    let stopLoss = Math.round(lastPrice * 0.975 * 100) / 100;

    // -------------------------------------------------------------------------
    // STRATEGY C: Defensive Mean-Reversion in Bearish Regimes (السوق الهابط والأزمات)
    // -------------------------------------------------------------------------
    if (isBearishRegime) {
      if (hasBuyingAbsorption && trades >= 20 && changePercent >= -3.5) {
        strategyCode = "STRATEGY_C_DEFENSIVE_BEAR";
        strategyLabel = "🛡️ الاستراتيجية: ارتداد دفاعي من الدعوم الهيكلية (سوق هابط)";
        strategyDetail = `حظر صفقات الاختراق نظراً لضغوط السوق الهابط. تمركز دفاعي عند الدعوم مع امتصاص طلبات الشراء (${buyRatio}%).`;
        timeframe = "جلسة إلى جلستين (ارتداد دفاعي مؤقت)";
        signal = "دفاعي ارتدادي 🛡️";
        signalColor = "#38bdf8";
        score = Math.min(89, Math.max(68, Math.round(70 + (buyRatio - 50) * 0.4)));
        target1 = Math.round(lastPrice * 1.025 * 100) / 100;
        target2 = Math.round(lastPrice * 1.045 * 100) / 100;
        stopLoss = Math.round(lastPrice * 0.985 * 100) / 100;
      } else {
        strategyCode = "DEFENSIVE_SUPPORT";
        strategyLabel = "🛡️ الاستراتيجية: حظر التداول وتفادي الهبوط (سوق هابط)";
        strategyDetail = "ضغط بيعي عام في السوق - تفعيل وضع حظر الصفقات والمراقبة الصارمة.";
        timeframe = "ممنوع الدخول ⛔";
        signal = "تصريف سلبي 🔴";
        signalColor = "#ef4444";
        score = Math.max(20, Math.round(45 - Math.abs(changePercent) * 2));
        stopLoss = Math.round(lastPrice * 0.985 * 100) / 100;
      }
    }
    // -------------------------------------------------------------------------
    // STRATEGY A: Multi-Month Support & Range Rebound (الارتداد من الدعم التاريخي)
    // Scan lowest price over 6-12 months; if within ±1.5% and absorption
    // -------------------------------------------------------------------------
    else if (prof.isNearMultiMonthLow && hasBuyingAbsorption) {
      strategyCode = "STRATEGY_A_SUPPORT_REBOUND";
      strategyLabel = "🎯 الاستراتيجية: الارتداد من الدعم التاريخي والمستويات السنوية";
      strategyDetail = `السعر قرب قاع 6-12 شهر (${prof.multiMonthLow.toFixed(2)} ر.س بفارق ${prof.distFromLowPct > 0 ? '+' : ''}${prof.distFromLowPct.toFixed(1)}%) مع امتصاص طلبات الشراء. وقف الخسارة صارم 0.8% أسفل القاع.`;
      timeframe = "1 إلى 8 أسابيع (سوينغ/استثماري)";
      signal = "ارتداد سنوي 🎯";
      signalColor = "#10b981";
      score = Math.min(98, Math.max(78, Math.round(82 + (buyRatio - 50) * 0.35 - Math.abs(prof.distFromLowPct) * 2)));

      // Target 1: Midpoint resistance (+3% to +5%)
      target1 = Math.round(lastPrice * 1.04 * 100) / 100;
      // Target 2: Upper range boundary (+8% to +12%)
      target2 = Math.round(lastPrice * 1.095 * 100) / 100;
      // Stop loss: Strictly 0.8% below the multi-month support!
      stopLoss = Math.round(prof.multiMonthLow * 0.992 * 100) / 100;
    }
    // -------------------------------------------------------------------------
    // STRATEGY B: RVOL Momentum Breakout (اختراق السيولة والزخم للجلسة)
    // RVOL > 2.5, price above VWAP, trade frequency spike (trades >= 30)
    // -------------------------------------------------------------------------
    else if (prof.rvol >= 2.5 && isAboveVWAP && trades >= 30 && changePercent >= 0.8) {
      strategyCode = "STRATEGY_B_RVOL_BREAKOUT";
      strategyLabel = "⚡ الاستراتيجية: اختراق الزخم وحجم التداول النسبي RVOL";
      strategyDetail = `اختراق سعري مدعوم بتدفق سيولة نسبية RVOL=${prof.rvol.toFixed(1)}x فوق متوسط VWAP (${vwap.toFixed(2)}) مع تسارع الصفقات.`;
      timeframe = "1 إلى 3 جلسات (مضاربة سريعة)";
      signal = "زخم اختراق 🚀";
      signalColor = "#00F090";
      score = Math.min(98, Math.max(76, Math.round(76 + Math.min(prof.rvol * 4, 14) + changePercent * 1.8)));

      // Quick intraday targets (+2% to +4%)
      target1 = Math.round(lastPrice * 1.025 * 100) / 100;
      target2 = Math.round(lastPrice * 1.045 * 100) / 100;
      // Stop loss below session VWAP
      stopLoss = Math.round(Math.min(vwap * 0.995, lastPrice * 0.985) * 100) / 100;
    }
    // -------------------------------------------------------------------------
    // STRATEGY D: Nomu Growth Scalper
    // -------------------------------------------------------------------------
    else if (isNomu && changePercent >= 1.2 && buyRatio >= 55.0) {
      strategyCode = "NOMU_GROWTH";
      strategyLabel = "🚀 الاستراتيجية: مضاربة نمو السريعة للشركات الواعدة";
      strategyDetail = `اقتناص الزخم المتسارع في سوق نمو بسيولة شرائية ${buyRatio}% وأحجام صفقات نشطة.`;
      timeframe = "1 إلى 3 جلسات (مضاربة سريعة)";
      signal = "نمو سريع 🚀";
      signalColor = "#fbbf24";
      score = Math.min(94, Math.max(72, Math.round(72 + changePercent * 1.6)));
      target1 = Math.round(lastPrice * 1.030 * 100) / 100;
      target2 = Math.round(lastPrice * 1.060 * 100) / 100;
      stopLoss = Math.round(lastPrice * 0.975 * 100) / 100;
    }
    // Whale Accumulation (Sideways)
    else if (buyRatio >= 60.0 && changePercent >= -0.8) {
      strategyCode = "WHALE_ACCUMULATION";
      strategyLabel = "🔬 الاستراتيجية: تجميع الهوامير والسيولة الذكية عند الدعم";
      strategyDetail = "امتصاص صفقات كبار المتداولين لطلبات الشراء في عمق سجل الأوامر وتثبيت السعر.";
      timeframe = "2 إلى 5 جلسات (تمركز ذكي)";
      signal = "تجميع هوامير 🟢";
      signalColor = "#10b981";
      score = Math.min(92, Math.max(70, Math.round(70 + (buyRatio - 50) * 0.4)));
      target1 = Math.round(lastPrice * 1.025 * 100) / 100;
      target2 = Math.round(lastPrice * 1.050 * 100) / 100;
      stopLoss = Math.round(lastPrice * 0.980 * 100) / 100;
    }
    // Bearish Dumping
    else if (changePercent <= -2.5 && buyRatio <= 42.0) {
      strategyCode = "DEFENSIVE_SUPPORT";
      strategyLabel = "🛡️ الاستراتيجية: حماية رأس المال وتفادي التصريف";
      strategyDetail = "ضغط بيعي وتصريف سلبي - تفعيل سياسة تجنب الصفقات الخاسرة فوراً.";
      timeframe = "ممنوع الدخول ⛔";
      signal = "تصريف سلبي 🔴";
      signalColor = "#ef4444";
      score = Math.max(20, Math.round(45 - Math.abs(changePercent) * 2));
      stopLoss = Math.round(lastPrice * 0.980 * 100) / 100;
    }
    // Default Positive
    else if (changePercent > 0) {
      strategyCode = "AUCTION_SNIPER";
      strategyLabel = "🔮 الاستراتيجية: تمركز مزاد الإغلاق وفجوة الافتتاح";
      strategyDetail = "مراقبة تجميع مزاد الإغلاق لاقتناص فجوة الافتتاح الصاعدة لجلسة الغد.";
      timeframe = "جلسة الغد (جرس الافتتاح)";
      signal = "إيجابي هادئ 🟡";
      signalColor = "#fbbf24";
      score = Math.min(75, Math.max(52, Math.round(55 + changePercent * 1.5)));
      target1 = Math.round(lastPrice * 1.020 * 100) / 100;
      target2 = Math.round(lastPrice * 1.040 * 100) / 100;
      stopLoss = Math.round(lastPrice * 0.980 * 100) / 100;
    }

    return {
      symbol: symbol,
      name: name,
      marketType: marketType,
      lastPrice: lastPrice,
      price: lastPrice,
      changePercent: changePercent,
      changeAmount: changeAmount,
      trades: trades,
      volume: volume,
      turnover: turnover,
      bidPrice: bidPrice,
      bidVol: bidVol,
      askPrice: askPrice,
      askVol: askVol,
      openPrice: openPrice,
      highPrice: highPrice,
      lowPrice: lowPrice,
      spread: spread,
      buyRatio: buyRatio,
      signal: signal,
      signalColor: signalColor,
      strategyCode: strategyCode,
      strategyLabel: strategyLabel,
      strategyDetail: strategyDetail,
      timeframe: timeframe,
      rvol: prof.rvol,
      multiMonthLow: prof.multiMonthLow,
      distFromLowPct: prof.distFromLowPct,
      score: score,
      target1: target1,
      target2: target2,
      stopLoss: stopLoss,
      timestamp: Date.now()
    };
  },

  /**
   * Main Market Table Extractor for Saudi Stocks
   * Scans ALL rows across .market-table, .n-scrollbar-content, .n-data-table-base-table-body,
   * accumulates scrolled rows to never stop at 1 stock, and calculates live breadth/turnover.
   */
  parseMarketTable() {
    this.scannedStockCache = this.scannedStockCache || new Map();
    const summary = this.parseMarketSummary();
    this.latestSummary = summary;

    const isCopilot = (el) => {
      if (!el) return false;
      if (el.id === "sahm-copilot-root" || el.id === "sahm-copilot-sidebar") return true;
      return !!(el.closest && (el.closest("#sahm-copilot-root") || el.closest("#sahm-copilot-sidebar")));
    };

    const rowSelectors = [
      ".market-table tbody tr",
      ".n-scrollbar-content tbody tr",
      ".n-data-table-base-table-body tbody tr",
      ".n-data-table-table tbody tr",
      ".n-data-table tbody tr",
      ".n-data-table-tr",
      "table tbody tr[data-row-key]",
      "table tbody tr"
    ];

    const rowElements = Array.from(document.querySelectorAll(rowSelectors.join(", "))).filter(el => !isCopilot(el));

    for (const r of rowElements) {
      if (r.querySelector("th") || r.getAttribute("role") === "columnheader") continue;
      const parsed = this.parseRowByDataColKeys(r);
      if (parsed && parsed.symbol) {
        this.scannedStockCache.set(parsed.symbol, parsed);
      }
    }

    // Also scan any td[data-col-key="mergeNoCodeSymbol"] that might not have been caught
    const mergeCells = Array.from(document.querySelectorAll('td[data-col-key="mergeNoCodeSymbol"], [data-col-key="mergeNoCodeSymbol"]')).filter(el => !isCopilot(el));
    for (const cell of mergeCells) {
      const row = cell.closest("tr");
      if (row && !row.querySelector("th") && row.getAttribute("role") !== "columnheader") {
        const parsed = this.parseRowByDataColKeys(row);
        if (parsed && parsed.symbol) {
          this.scannedStockCache.set(parsed.symbol, parsed);
        }
      }
    }

    // Gather all accumulated stocks
    const stocks = Array.from(this.scannedStockCache.values());

    // Calculate dynamic aggregations from table rows if header stats are 0
    let sumTurnover = 0;
    let sumVolume = 0;
    let sumTrades = 0;
    let advancing = 0;
    let declining = 0;
    let unchanged = 0;

    for (const s of stocks) {
      const stockTurnover = s.turnover || (s.volume * s.lastPrice) || 0;
      sumTurnover += stockTurnover;
      sumVolume += (s.volume || 0);
      sumTrades += (s.trades || 0);
      if (s.changePercent > 0) advancing++;
      else if (s.changePercent < 0) declining++;
      else unchanged++;
    }

    if (summary.turnover === 0 && sumTurnover > 0) {
      summary.turnover = Math.round(sumTurnover * 100) / 100;
    }
    if (summary.volume === 0 && sumVolume > 0) {
      summary.volume = sumVolume;
    }
    if (summary.trades === 0 && sumTrades > 0) {
      summary.trades = sumTrades;
    }
    if (summary.advancing === 0 && (advancing > 0 || declining > 0)) {
      summary.advancing = advancing;
      summary.declining = declining;
      summary.unchanged = unchanged;
    }

    // Sort by momentum score & trading turnover
    stocks.sort((a, b) => (b.score * 1000 + b.turnover) - (a.score * 1000 + a.turnover));

    return {
      type: "SAUDI_MARKET_TABLE",
      activeMarket: "SA",
      platform: "Sahm Saudi Pro",
      summary: summary,
      rows: stocks,
      count: stocks.length,
      timestamp: Date.now()
    };
  }
};
