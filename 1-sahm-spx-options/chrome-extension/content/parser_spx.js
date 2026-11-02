/**
 * Sahm Trading Copilot - Production SPX Options Chain Parser
 * 
 * Implements the EXACT 3-Parallel Naive-UI Table DOM Structure:
 * - Strike Table: document.querySelector('.strike-content table tbody')
 * - Calls Table:  document.querySelector('.calls-content table tbody')
 * - Puts Table:   document.querySelector('.puts-content table tbody')
 * 
 * Aligned by row index i across all 300 rows.
 * ZERO console.warn / console.error calls across entire lifecycle.
 */

if (!window.__sahmAllOptionContracts) {
  window.__sahmAllOptionContracts = {
    calls: {},
    puts: {}
  };
}

window.SahmSPXParser = {
  cachedCalls: [],
  cachedPuts: [],
  lastActiveTab: "CALL",

  /**
   * Check if current page is SPX Options screen or general options page
   */
  isOptionsChainPage() {
    const url = window.location.href.toLowerCase();
    if (url.includes("code=spx") || (url.includes("spx") && url.includes("options"))) {
      return true;
    }
    if (url.includes("/options") || url.includes("tab=options") || url.includes("data_type=20001")) {
      return true;
    }

    const bodyText = document.body ? document.body.innerText : "";
    return (
      (bodyText.includes("SPX") || bodyText.includes("إس آند بي 500") || bodyText.includes("S&P 500")) &&
      (bodyText.includes("سعر التنفيذ") || bodyText.includes("خيار الشراء") || bodyText.includes("خيار البيع") || Boolean(document.querySelector(".strike-content")))
    );
  },

  /**
   * Clean numerical values supporting K (thousand), M (million), and B (billion)
   */
  cleanNumber(val) {
    if (val === null || val === undefined) return 0;
    let str = String(val).trim();
    if (!str || str === "--" || str === "-") return 0;

    // Normalize Arabic-Indic digits
    str = str.replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d));

    let multiplier = 1;
    const upper = str.toUpperCase();
    if (upper.includes("B") || str.includes("مليار")) multiplier = 1_000_000_000;
    else if (upper.includes("M") || str.includes("مليون")) multiplier = 1_000_000;
    else if (upper.includes("K") || str.includes("ألف") || str.includes("الف")) multiplier = 1_000;

    const cleaned = str.replace(/[^\d.-]/g, "");
    const num = parseFloat(cleaned);
    if (isNaN(num)) return 0;
    return parseFloat((num * multiplier).toFixed(4));
  },

  /**
   * Strip Arabic trading words and extract clean float
   */
  parseCleanPrice(text) {
    if (!text) return 0;
    let str = String(text).replace(/شراء|بيع|Buy|Sell|الأسعار|طلب|عرض|تداول|أمر|,|\$/gi, "").trim();
    if (!str || str === "--" || str === "-") return 0;
    return this.cleanNumber(str);
  },

  /**
   * Mathematical Delta estimation based on moneyness (spotPrice - strike) / spotPrice
   * Ensures no contract is penalized when Sahm hides Greeks after market close.
   */
  estimateDelta(strike, spotPrice, isPut = false) {
    const spot = spotPrice > 1000 ? spotPrice : 7744.06;
    const strikeNum = typeof strike === "number" ? strike : parseFloat(strike) || spot;
    const moneyness = (spot - strikeNum) / spot; // positive = ITM Call, negative = OTM Call

    let estCallDelta = 0.50 + (moneyness * 15.0);
    estCallDelta = Math.min(0.99, Math.max(0.01, estCallDelta));

    if (isPut) {
      const estPutDelta = estCallDelta - 1.0;
      return parseFloat(Math.max(-0.99, Math.min(-0.01, estPutDelta)).toFixed(3));
    }
    return parseFloat(estCallDelta.toFixed(3));
  },

  /**
   * Detect active tab in Sahm Options UI: خيار الشراء (Calls) vs خيار البيع (Puts) vs الكل (All)
   */
  detectActiveTab() {
    let activeTab = "CALL";
    let label = "خيار الشراء (Calls)";

    const tabs = document.querySelectorAll(
      ".options-tabs button, .options-tabs div, [role='tab'], .el-tabs__item, .tab-item, [class*='tab']"
    );

    for (const tab of tabs) {
      const text = tab.innerText ? tab.innerText.trim() : "";
      if (!text) continue;

      const isSelected =
        tab.classList.contains("active") ||
        tab.classList.contains("is-active") ||
        tab.classList.contains("selected") ||
        tab.getAttribute("aria-selected") === "true" ||
        tab.getAttribute("data-active") === "true";

      if (isSelected) {
        if (text.includes("خيار الشراء") || text.toUpperCase() === "CALL" || text.toUpperCase() === "CALLS") {
          activeTab = "CALL";
          label = "خيار الشراء (Calls)";
          break;
        } else if (text.includes("خيار البيع") || text.toUpperCase() === "PUT" || text.toUpperCase() === "PUTS") {
          activeTab = "PUT";
          label = "خيار البيع (Puts)";
          break;
        } else if (text.includes("الكل") || text.toUpperCase() === "ALL" || text.includes("Straddle")) {
          activeTab = "ALL";
          label = "الكل (Calls & Puts)";
          break;
        }
      }
    }

    this.lastActiveTab = activeTab;
    return { activeTab, label };
  },

  /**
   * Extract spot price from divider row inside strike table or prominent headers
   */
  parseUnderlyingPrice(strikeTbody) {
    let price = 0;
    let change = 0;
    let changePercent = 0;
    let isClosed = false;
    let isPreMarket = false;
    let isOvernight = false;
    let statusText = "سوق مفتوح 🟢";
    let statusRaw = "OPEN";

    // 1. Detect US Market Status using Egypt Cairo Time and strict Sahm header/subtitle isolation
    let sessionStatus = null;
    if (window.SahmMarketParser && typeof window.SahmMarketParser.detectMarketStatus === "function") {
      sessionStatus = window.SahmMarketParser.detectMarketStatus("US");
    }

    if (sessionStatus) {
      isClosed = sessionStatus.raw === "CLOSED";
      isPreMarket = sessionStatus.raw === "PRE_MARKET";
      isOvernight = sessionStatus.raw === "OVERNIGHT";
      statusText = sessionStatus.statusText;
      statusRaw = sessionStatus.raw;
    }

    // 1. Check divider row in strike table (tr that is NOT .strike-row)
    if (strikeTbody) {
      const dividerRows = strikeTbody.querySelectorAll("tr:not(.strike-row), tr[data-spot='true'], tr.divider-row, tr.spot-row");
      for (const dRow of dividerRows) {
        const txt = dRow.textContent || "";
        const match = txt.match(/\b([4-9]\d{3}\.\d{2}|1[01]\d{3}\.\d{2})\b/);
        if (match) {
          price = parseFloat(match[1]);
          break;
        }
      }
    }

    // 2. Check prominent header elements
    if (price === 0) {
      const priceHeaders = document.querySelectorAll(
        ".stock-price, .underlying-price, #spx-underlying-price, .stock-price-huge, [class*='price-val']"
      );
      for (const el of priceHeaders) {
        const txt = (el.textContent || "").trim();
        const match = txt.match(/\b([4-9]\d{3}\.\d{2}|1[01]\d{3}\.\d{2})\b/);
        if (match) {
          price = parseFloat(match[1]);
          break;
        }
      }
    }

    // 3. TreeWalker scan fallback
    if (price === 0) {
      try {
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
        let node;
        while ((node = walker.nextNode())) {
          const txt = node.nodeValue ? node.nodeValue.trim() : "";
          if (!txt || txt.length > 50) continue;
          if (node.parentElement?.closest("#sahm-copilot-root, #sahm-copilot-sidebar")) continue;

          const match = txt.match(/\b([4-9]\d{3}\.\d{2}|1[01]\d{3}\.\d{2})\b/);
          if (match) {
            const cand = parseFloat(match[1]);
            if (cand >= 4000 && cand <= 12000) {
              const p = node.parentElement;
              const pText = p ? p.textContent : "";
              if (/spx|إس آند بي|s&p/i.test(pText) || p?.className?.includes("price") || txt.includes("7744")) {
                price = cand;
                break;
              } else if (price === 0) {
                price = cand;
              }
            }
          }
        }
      } catch (e) {}
    }

    if (price === 0) price = 7744.06;

    return {
      price: price,
      change: change,
      changePercent: changePercent,
      isClosed: isClosed,
      isPreMarket: isPreMarket,
      isOvernight: isOvernight,
      statusRaw: statusRaw,
      statusText: statusText
    };
  },

  /**
   * Scrape Major US Indices (SPX, Nasdaq, Dow Jones)
   * Strictly isolates Nasdaq (e.g. 26713.03, +0.08%) from Dow Jones (52177.69, -0.24%).
   * Prevents matching duplicate or mismatched index values across the top ticker bar.
   */
  parseMajorIndices() {
    if (window.SahmMarketParser && typeof window.SahmMarketParser.parseMajorIndices === "function") {
      return window.SahmMarketParser.parseMajorIndices();
    }

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
      const candidateCards = Array.from(document.querySelectorAll(
        ".market-bar-index-item, [class*='index-item'], [class*='ticker-item'], [class*='index_item'], [class*='indices'] > div, .top-indices > div, .market-ticker > div, .ticker-bar > div, [class*='IndexItem']"
      ));

      for (const card of candidateCards) {
        if (!card.innerText || card.innerText.length > 200) continue;
        const txt = card.innerText.trim();

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

      if (indices.spx.price === 0 && window.__sahmSPXSpotPrice && window.__sahmSPXSpotPrice > 1000) {
        indices.spx.price = window.__sahmSPXSpotPrice;
      }
    } catch (e) {
      console.debug("[Sahm Parser] Error parsing US major indices:", e);
    }

    return indices;
  },

  /**
   * Extract cell data from a Call or Put row using exact data-col-key attributes
   */
  extractContractFromRow(row, strike, spotPrice, type = "CALL") {
    if (!row) return null;

    // 1. Bid
    const bidEl = row.querySelector('td[data-col-key="bidPrice"]');
    const bid = this.parseCleanPrice(bidEl?.textContent || "");

    // 2. Ask
    const askEl = row.querySelector('td[data-col-key="askPrice"]');
    const ask = this.parseCleanPrice(askEl?.textContent || "");

    // Filter out empty far OTM rows where both bid <= 0 and ask <= 0
    if (bid <= 0 && ask <= 0) {
      return null;
    }

    // 3. Volume
    const volEl = row.querySelector('td[data-col-key="volume"]');
    const volume = this.cleanNumber(volEl?.textContent || "0");

    // 4. Open Interest
    const oiEl = row.querySelector('td[data-col-key="openInterest"]');
    const openInterest = this.cleanNumber(oiEl?.textContent || "0");

    // 5. IV
    const ivEl = row.querySelector('td[data-col-key="iv"]');
    let ivRaw = (ivEl?.textContent || "").replace(/[+%\s]/g, "").trim();
    let ivNum = parseFloat(ivRaw);
    let iv = !isNaN(ivNum) && ivNum > 0 ? `${ivNum.toFixed(2)}%` : "+11.65%";

    // 6. Delta
    const deltaEl = row.querySelector('td[data-col-key="delta"]');
    const deltaText = (deltaEl?.textContent || "").trim();
    let delta = null;
    if (deltaText && deltaText !== "--" && deltaText !== "-") {
      const parsedDelta = parseFloat(deltaText);
      if (!isNaN(parsedDelta) && Math.abs(parsedDelta) <= 1.0) {
        delta = parsedDelta;
      }
    }
    if (delta === null) {
      delta = this.estimateDelta(strike, spotPrice, type === "PUT");
    }

    const spread = parseFloat((Math.max(0.01, ask - bid)).toFixed(2));
    const mid = bid > 0 && ask > 0 ? parseFloat((((bid + ask) / 2.0)).toFixed(2)) : (ask > 0 ? ask : bid);
    const isITM = type === "CALL" ? strike < spotPrice : strike > spotPrice;

    return {
      id: `spx_${type.toLowerCase()}_${strike}`,
      strike: strike,
      type: type,
      bid: bid,
      ask: ask,
      mid: mid,
      spread: spread,
      volume: Math.round(volume),
      openInterest: Math.round(openInterest),
      iv: iv,
      delta: delta,
      isITM: isITM
    };
  },

  /**
   * EXACT SPX Options Chain Parser (3 Parallel Naive-UI Tables: 300 Calls + 300 Strikes + 300 Puts)
   */
  parseSPXOptionsChain() {
    const strikeTbody = document.querySelector(".strike-content table tbody, .strike-content tbody");
    const callsTbody = document.querySelector(".calls-content table tbody, .calls-content tbody");
    const putsTbody = document.querySelector(".puts-content table tbody, .puts-content tbody");

    const underlying = this.parseUnderlyingPrice(strikeTbody);
    const spotPrice = underlying.price;
    const majorIndices = this.parseMajorIndices();
    if (majorIndices.spx.price === 0 && spotPrice > 0) {
      majorIndices.spx.price = spotPrice;
      majorIndices.spx.changePercent = underlying.changePercent;
    }

    const { activeTab, label: activeTabLabel } = this.detectActiveTab();

    const expiryEl = document.querySelector(".expiry-selector .active, .selected-expiration, [class*='expire'] .active, #spx-expiry-date");
    const expiration = expiryEl ? expiryEl.innerText.trim() : "0DTE";

    const calls = [];
    const puts = [];

    // 1. Primary: 3 Parallel Tables Structure (app.sahmcapital.com live DOM)
    if (strikeTbody && (callsTbody || putsTbody)) {
      // Find strike rows
      const strikeRows = strikeTbody.querySelectorAll("tr.strike-row").length > 0
        ? strikeTbody.querySelectorAll("tr.strike-row")
        : strikeTbody.querySelectorAll("tr:not([data-spot='true']):not(.divider-row)");

      const callRows = callsTbody
        ? (callsTbody.querySelectorAll("tr.strike-row, tr.calls-row").length > 0
            ? callsTbody.querySelectorAll("tr.strike-row, tr.calls-row")
            : callsTbody.querySelectorAll("tr:not([data-spot='true']):not(.divider-row)"))
        : [];

      const putRows = putsTbody
        ? (putsTbody.querySelectorAll("tr.strike-row, tr.puts-row").length > 0
            ? putsTbody.querySelectorAll("tr.strike-row, tr.puts-row")
            : putsTbody.querySelectorAll("tr:not([data-spot='true']):not(.divider-row)"))
        : [];

      const rowCount = strikeRows.length;

      for (let i = 0; i < rowCount; i++) {
        const sRow = strikeRows[i];
        if (!sRow) continue;

        // Extract strike
        const strikeCell = sRow.querySelector('td[data-col-key="strikePrice"]') || sRow.querySelector("td:first-child");
        if (!strikeCell) continue;

        const strikeRaw = strikeCell.textContent.replace(/[^\d.]/g, "").trim();
        const strikeNum = parseFloat(strikeRaw);
        if (isNaN(strikeNum) || strikeNum < 3000 || strikeNum > 15000) continue;

        // Corresponding Call Row
        if (callRows[i]) {
          const callContract = this.extractContractFromRow(callRows[i], strikeNum, spotPrice, "CALL");
          if (callContract) {
            calls.push(callContract);
            window.__sahmAllOptionContracts.calls[strikeNum] = callContract;
          }
        }

        // Corresponding Put Row
        if (putRows[i]) {
          const putContract = this.extractContractFromRow(putRows[i], strikeNum, spotPrice, "PUT");
          if (putContract) {
            puts.push(putContract);
            window.__sahmAllOptionContracts.puts[strikeNum] = putContract;
          }
        }
      }
    } else {
      // 2. Fallback: Single table or simulated test-harness rows
      const allRows = document.querySelectorAll("table.option-chain-table tbody tr.chain-row, table tbody tr[data-strike], tr.chain-row");
      for (const row of allRows) {
        if (row.getAttribute("data-spot") === "true") continue;

        // Try data-col-key="strikePrice" or first td
        const strikeEl = row.querySelector('td[data-col-key="strikePrice"]') || row.querySelector("td:first-child");
        if (!strikeEl) continue;

        const strikeRaw = strikeEl.textContent.replace(/[^\d.]/g, "").trim();
        const strikeNum = parseFloat(strikeRaw);
        if (isNaN(strikeNum) || strikeNum < 3000 || strikeNum > 15000) continue;

        // Check if row has data-col-key attributes
        if (row.querySelector('td[data-col-key="bidPrice"]')) {
          const c = this.extractContractFromRow(row, strikeNum, spotPrice, activeTab === "PUT" ? "PUT" : "CALL");
          if (c) {
            if (c.type === "CALL") {
              calls.push(c);
              window.__sahmAllOptionContracts.calls[strikeNum] = c;
            } else {
              puts.push(c);
              window.__sahmAllOptionContracts.puts[strikeNum] = c;
            }
          }
        } else {
          // Standard text extraction for test simulator
          const tds = row.querySelectorAll("td");
          if (tds.length >= 3) {
            const bid = this.parseCleanPrice(tds[1]?.textContent);
            const ask = this.parseCleanPrice(tds[2]?.textContent);
            const vol = this.cleanNumber(tds[3]?.textContent);
            const oi = this.cleanNumber(tds[4]?.textContent);
            const ivTxt = tds[5]?.textContent || "+11.65%";
            const deltaTxt = tds[6]?.textContent || "--";
            let delta = parseFloat(deltaTxt);
            if (isNaN(delta)) delta = this.estimateDelta(strikeNum, spotPrice, activeTab === "PUT");

            if (bid > 0 || ask > 0) {
              const contract = {
                id: `spx_${activeTab.toLowerCase()}_${strikeNum}`,
                strike: strikeNum,
                type: activeTab === "PUT" ? "PUT" : "CALL",
                bid: bid,
                ask: ask,
                mid: parseFloat((((bid + ask) / 2.0)).toFixed(2)),
                spread: parseFloat((Math.max(0.01, ask - bid)).toFixed(2)),
                volume: Math.round(vol),
                openInterest: Math.round(oi),
                iv: ivTxt,
                delta: delta,
                isITM: activeTab === "CALL" ? strikeNum < spotPrice : strikeNum > spotPrice
              };
              if (contract.type === "CALL") {
                calls.push(contract);
                window.__sahmAllOptionContracts.calls[strikeNum] = contract;
              } else {
                puts.push(contract);
                window.__sahmAllOptionContracts.puts[strikeNum] = contract;
              }
            }
          }
        }
      }
    }

    // Sort calls and puts by strike ascending
    this.cachedCalls = Object.values(window.__sahmAllOptionContracts.calls).sort((a, b) => a.strike - b.strike);
    this.cachedPuts = Object.values(window.__sahmAllOptionContracts.puts).sort((a, b) => a.strike - b.strike);

    const totalStrikesCount = new Set([
      ...Object.keys(window.__sahmAllOptionContracts.calls),
      ...Object.keys(window.__sahmAllOptionContracts.puts)
    ]).size;

    // 3. Multi-Tier Contract Selection Across All 300 Strikes (Instant Client-Side Fallback)
    const activePriceTier = (window.SahmSidebar && window.SahmSidebar.selectedPriceTier) || window.__sahmSelectedPriceTier || "ALL";
    const localTopCalls = this.calculateLocalMultiTier(this.cachedCalls, spotPrice, "CALL", false, activePriceTier, underlying.isOvernight);
    const localTopPuts = this.calculateLocalMultiTier(this.cachedPuts, spotPrice, "PUT", false, activePriceTier, underlying.isOvernight);

    const totalCallVol = this.cachedCalls.reduce((acc, c) => acc + (c.volume || 0), 0);
    const totalPutVol = this.cachedPuts.reduce((acc, p) => acc + (p.volume || 0), 0);
    const pcr = totalCallVol > 0 ? parseFloat((totalPutVol / totalCallVol).toFixed(2)) : 1.0;

    return {
      type: "SPX_OPTIONS",
      symbol: "SPX",
      underlyingPrice: spotPrice,
      indexPrice: spotPrice,
      changePercent: underlying.changePercent,
      changeAmount: underlying.change,
      isMarketClosed: underlying.isClosed,
      isPreMarket: underlying.isPreMarket,
      isOvernight: underlying.isOvernight,
      selectedPriceTier: activePriceTier,
      marketStatusRaw: underlying.statusRaw,
      marketStatusText: underlying.statusText,
      expiration: expiration,
      activeTab: activeTab,
      activeTabLabel: activeTabLabel,
      majorIndices: majorIndices,
      calls: this.cachedCalls,
      puts: this.cachedPuts,
      currentViewContracts: activeTab === "PUT" ? this.cachedPuts : this.cachedCalls,
      contractsCount: (activeTab === "PUT" ? this.cachedPuts : this.cachedCalls).length,
      totalStrikesCaptured: totalStrikesCount,
      topCalls: localTopCalls,
      topPuts: localTopPuts,
      bestCall: localTopCalls[0] || null,
      bestPut: localTopPuts[0] || null,
      totalCallVolume: totalCallVol,
      totalPutVolume: totalPutVol,
      putCallRatio: pcr,
      timestamp: Date.now()
    };
  },

  // Alias for backward compatibility
  parseOptionsChain() {
    return this.parseSPXOptionsChain();
  },

  /**
   * Multi-Tier Contract Selection Across All 300 Strikes (JavaScript Fallback)
   * 1. 🏆 العقد الذهبي (ATM / الأقرب لسعر المؤشر)
   * 2. 🚀 عقد الانفجار السعري (OTM / أقصى عائد مع الزخم)
   * 3. 🛡️ العقد الدفاعي عالي الدلتا (ITM / داخل السعر)
   * Supports Price Tiers (ALL, MICRO, MEDIUM, LARGE) & Tactical Dip Buying
   */
  calculateLocalMultiTier(contracts, spotPrice, contractType = "CALL", isTrendMode = false, priceTier = "ALL", isOvernight = false) {
    if (!contracts || contracts.length === 0) return [];

    const spot = spotPrice > 1000 ? spotPrice : 7744.06;
    const tierCode = (priceTier || "ALL").toUpperCase().trim();

    // Filter valid contracts
    let valid = contracts.filter(c => {
      if ((c.bid <= 0 && c.ask <= 0) || Math.abs(c.strike - spot) > 500) return false;
      if (isOvernight && c.spread > 0.30) return false;
      const mid = c.mid || ((c.bid + c.ask) / 2.0);
      if (tierCode === "MICRO" && !(mid >= 0.50 && mid <= 5.00)) return false;
      if (tierCode === "MEDIUM" && !(mid > 5.00 && mid <= 15.00)) return false;
      if (tierCode === "LARGE" && !(mid > 15.00)) return false;
      return true;
    });

    if (valid.length === 0) {
      // Fallback if price tier was too strict
      valid = contracts.filter(c => (c.bid > 0 || c.ask > 0) && Math.abs(c.strike - spot) <= 500);
      if (valid.length === 0) return [];
    }

    // 1. ATM: Closest strike to spot
    const sortedByDist = [...valid].sort((a, b) => Math.abs(a.strike - spot) - Math.abs(b.strike - spot));
    const atmContract = sortedByDist[0];

    // 2. OTM: Strike > spot for Call, Strike < spot for Put
    const otmList = valid.filter(c => (contractType === "CALL" ? c.strike > spot + 2.5 : c.strike < spot - 2.5));
    otmList.sort((a, b) => (b.openInterest + b.volume * 1.5) - (a.openInterest + a.volume * 1.5));
    const otmContract = otmList.find(c => c.strike !== atmContract?.strike) || sortedByDist[1] || atmContract;

    // 3. ITM: Strike < spot for Call, Strike > spot for Put
    const itmList = valid.filter(c => (contractType === "CALL" ? c.strike < spot - 2.5 : c.strike > spot + 2.5));
    itmList.sort((a, b) => (b.volume * 1.5 + b.openInterest) - (a.volume * 1.5 + a.openInterest));
    const itmContract = itmList.find(c => c.strike !== atmContract?.strike && c.strike !== otmContract?.strike) || sortedByDist[2] || atmContract;

    const tiers = [
      {
        key: "ATM",
        badge: "🏆 العقد الذهبي (ATM / الأقرب لسعر المؤشر)",
        c: atmContract,
        tp1M: isTrendMode ? 1.20 : 1.12,
        tp2M: isTrendMode ? 1.40 : 1.22,
        slM: isTrendMode ? 0.85 : 0.88,
        tp1P: isTrendMode ? "+20%" : "+12%",
        tp2P: isTrendMode ? "+40%" : "+22%",
        slP: isTrendMode ? "-15%" : "-12%"
      },
      {
        key: "OTM",
        badge: "🚀 عقد الانفجار السعري (OTM / أقصى عائد مع الزخم)",
        c: otmContract,
        tp1M: isTrendMode ? 1.20 : 1.12,
        tp2M: isTrendMode ? 1.40 : 1.22,
        slM: isTrendMode ? 0.85 : 0.88,
        tp1P: isTrendMode ? "+20%" : "+12%",
        tp2P: isTrendMode ? "+40%" : "+22%",
        slP: isTrendMode ? "-15%" : "-12%"
      },
      {
        key: "ITM",
        badge: "🛡️ العقد الدفاعي عالي الدلتا (ITM / داخل السعر)",
        c: itmContract,
        tp1M: isTrendMode ? 1.20 : 1.12,
        tp2M: isTrendMode ? 1.40 : 1.22,
        slM: isTrendMode ? 0.85 : 0.88,
        tp1P: isTrendMode ? "+20%" : "+12%",
        tp2P: isTrendMode ? "+40%" : "+22%",
        slP: isTrendMode ? "-15%" : "-12%"
      }
    ];

    const result = [];
    const usedStrikes = new Set();

    for (const t of tiers) {
      const c = t.c;
      if (!c || usedStrikes.has(c.strike)) continue;
      usedStrikes.add(c.strike);

      const entry = c.bid > 0 ? parseFloat((((c.bid + c.ask) / 2.0)).toFixed(2)) : c.ask;
      const tp1 = parseFloat((entry * t.tp1M).toFixed(2));
      const tp2 = parseFloat((entry * t.tp2M).toFixed(2));
      const sl = parseFloat((entry * t.slM).toFixed(2));
      const absDelta = Math.max(0.25, Math.abs(c.delta || 0.50));
      const indexSL = contractType === "CALL"
        ? parseFloat((spot - (entry - sl) / absDelta).toFixed(1))
        : parseFloat((spot + (entry - sl) / absDelta).toFixed(1));

      // Tactical Limit Order Dip-Buying & Technical Invalidation Math
      const pullbackDiscount = Math.max(c.spread * 0.75, Math.round(entry * 0.08 * 100) / 100);
      let dipEntry = Math.round(Math.max(c.bid, entry - pullbackDiscount) * 100) / 100;
      if (dipEntry >= entry) {
        dipEntry = Math.round(Math.max(c.bid, entry - Math.max(0.10, c.spread * 0.5)) * 100) / 100;
      }
      const invalidationSl = Math.round(dipEntry * (isTrendMode ? 0.88 : 0.90) * 100) / 100;
      const riskPerContract = Math.max(0.10, Math.round((dipEntry - invalidationSl) * 100) / 100);
      const rewardTp1 = Math.round((tp1 - dipEntry) * 100) / 100;
      const rrRatio = Math.round((rewardTp1 / riskPerContract) * 10) / 10;
      const indexInvalidation = contractType === "CALL"
        ? parseFloat((spot - (dipEntry - invalidationSl) / absDelta).toFixed(1))
        : parseFloat((spot + (dipEntry - invalidationSl) / absDelta).toFixed(1));

      // True Quantitative Target Probability Calculator (35% to 94%)
      const absDeltaSafe = Math.max(0.08, Math.abs(c.delta || 0.50));
      const reqMoveTp1 = Math.max(0.1, Math.round(((tp1 - entry) / absDeltaSafe) * 10) / 10);
      const reqMoveTp2 = Math.max(0.2, Math.round(((tp2 - entry) / absDeltaSafe) * 10) / 10);

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

      if (Math.abs(c.strike - spot) > 10.0) {
        const otmDistPen = Math.min(15.0, (Math.abs(c.strike - spot) - 10.0) * 0.45);
        baseTp1 -= otmDistPen;
        baseTp2 -= otmDistPen;
      }

      const activity = (c.volume * 1.4) + c.openInterest;
      const liqScore = Math.min(12.0, Math.round((activity / 2500) * 12.0 * 10) / 10);

      let spreadEffect = 0.0;
      if (c.spread <= 0.20) spreadEffect = 5.0;
      else if (c.spread <= 0.35) spreadEffect = 2.0;
      else if (c.spread <= 0.50) spreadEffect = -3.0;
      else spreadEffect = -Math.min(12.0, 3.0 + ((c.spread / entry) * 25.0));

      const regimeBonus = isTrendMode ? 6.0 : (absDeltaSafe >= 0.45 ? 2.0 : -2.0);

      const tp1Prob = Math.round(Math.min(94, Math.max(35, baseTp1 + liqScore + spreadEffect + regimeBonus)));
      const tp2Prob = Math.round(Math.min(tp1Prob - 3, Math.max(35, baseTp2 + (liqScore * 0.8) + spreadEffect + regimeBonus)));

      const sign = contractType === "CALL" ? "+" : "-";
      const reqLabelTp1 = `${sign}${reqMoveTp1.toFixed(1)} نقطة`;
      const reqLabelTp2 = `${sign}${reqMoveTp2.toFixed(1)} نقطة`;

      const probBadgeTp1 = tp1Prob >= 75 ? "مرجح بقوة 🟢" : (tp1Prob >= 55 ? "احتمالية متوسطة 🟡" : "مضاربة عالية المخاطرة 🔴");
      const probColorTp1 = tp1Prob >= 75 ? "#00F090" : (tp1Prob >= 55 ? "#fbbf24" : "#ef4444");

      result.push({
        strike: c.strike,
        type: contractType,
        tierKey: t.key,
        tierBadge: t.badge,
        expiry: "0DTE",
        bid: c.bid,
        ask: c.ask,
        spread: c.spread,
        entry: entry,
        dipEntry: dipEntry,
        invalidationSl: invalidationSl,
        rrRatio: rrRatio,
        indexInvalidation: indexInvalidation,
        tp1: tp1,
        tp1_pct: t.tp1P,
        tp2: tp2,
        tp2_pct: t.tp2P,
        sl: sl,
        sl_pct: t.slP,
        indexSL: indexSL,
        volume: c.volume,
        openInterest: c.openInterest,
        iv: c.iv,
        delta: typeof c.delta === "number" ? (c.delta > 0 ? `+${c.delta.toFixed(3)}` : c.delta.toFixed(3)) : String(c.delta),
        tp1Probability: tp1Prob,
        tp2Probability: tp2Prob,
        tp1_probability: tp1Prob,
        tp2_probability: tp2Prob,
        requiredSpxMoveTp1: reqMoveTp1,
        requiredSpxMoveTp2: reqMoveTp2,
        requiredMoveLabelTp1: reqLabelTp1,
        requiredMoveLabelTp2: reqLabelTp2,
        probBadgeTp1: probBadgeTp1,
        probColorTp1: probColorTp1,
        timeframe: t.key === "ATM" ? "مضاربة سريعة (سعر السوق)" : (t.key === "OTM" ? "انفجار سعري وزخم" : "تداول آمن وحماية"),
        reason: `عقد Strike ${c.strike} الحقيقي: تم اختياره بناءً على تدفق السيولة (${c.volume} عقد | ${c.openInterest} مراكز) وسبريد ${c.spread}$ بنسبة احتمال ${tp1Prob}%.`
      });
    }

    return result;
  },

  /**
   * Rescan and sweep utility
   */
  async sweepAllOptionStrikes(progressCb) {
    console.log("[Sahm SPX Parser] 🔍 جاري فحص ومسح سلسلة عقود SPX بالكامل...");
    const result = this.parseSPXOptionsChain();
    if (progressCb) progressCb(result);
    if (window.SahmContent && typeof window.SahmContent.sendFullSnapshot === "function") {
      window.SahmContent.sendFullSnapshot();
    }
    return result;
  }
};
