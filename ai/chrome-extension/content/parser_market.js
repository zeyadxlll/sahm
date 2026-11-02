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
   * Detect Market Trading Status: "OPEN" (مفتوح) vs "CLOSED" (مغلق)
   */
  detectMarketStatus() {
    const bodyText = document.body ? document.body.innerText : "";

    // Check header text directly for closed or after-hours / night trading
    const headerEl = document.querySelector("header, .market-header, .stock-header-card, .indices-ticker-bar");
    const headerText = headerEl ? headerEl.textContent : "";

    if (
      headerText.includes("مغلق") || headerText.includes("التداول الليلي") || headerText.includes("Closed") ||
      bodyText.includes("سوق مغلق") || bodyText.includes("التداول الليلي") || bodyText.includes("فترة الإغلاق") || bodyText.includes("مزاد الإغلاق")
    ) {
      return { isOpen: false, statusText: "سوق مغلق 🔴 (بيانات آخر إغلاق)", raw: "CLOSED" };
    }

    const statusBadges = document.querySelectorAll(
      ".market-status, .trading-status, .status-badge, [class*='market-status'], [class*='state']"
    );

    for (const el of statusBadges) {
      const txt = el.innerText || "";
      if (txt.includes("مغلق") || txt.includes("Closed") || txt.includes("فترة الإغلاق") || txt.includes("مزاد الإغلاق")) {
        return { isOpen: false, statusText: "سوق مغلق 🔴", raw: "CLOSED" };
      }
      if (txt.includes("مفتوح") || txt.includes("Open") || txt.includes("جلسة التداول")) {
        return { isOpen: true, statusText: "سوق مفتوح 🟢", raw: "OPEN" };
      }
    }

    return { isOpen: true, statusText: "سوق مفتوح 🟢", raw: "OPEN" };
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
   * Extract top market summary bar (TASI, Nomu, Turnover, Volume, Advancing/Declining breadth)
   */
  parseMarketSummary() {
    const summary = {
      market: this.detectActiveMarket(),
      status: this.detectMarketStatus(),
      tasi: { price: 0, change: 0, changePercent: 0 },
      nomu: { price: 0, change: 0, changePercent: 0 },
      turnover: 0,
      volume: 0,
      trades: 0,
      advancing: 0,
      declining: 0,
      unchanged: 0
    };

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

    return {
      stocks: stocks,
      activeMarket: activeMarket,
      summary: marketSummary,
      matchedColumns: bestMapping ? Object.keys(bestMapping) : [],
      count: stocks.length
    };
  }
};
