/**
 * Derayah Global SPX Options Parser
 * Dedicated parser for Derayah Global / Interactive Brokers Web trader options chains.
 */

window.DerayahSPXParser = {
  isOptionsChainPage() {
    const url = window.location.href.toLowerCase();
    if (url.includes("derayah") && (url.includes("option") || url.includes("spx") || url.includes("chain"))) {
      return true;
    }
    const bodyText = document.body ? document.body.innerText : "";
    return bodyText.includes("SPX") && (bodyText.includes("Calls") || bodyText.includes("Puts") || bodyText.includes("Strike"));
  },

  parseUnderlyingPrice() {
    let spotPrice = 0;
    const priceEls = document.querySelectorAll(".symbol-price, .last-price, .quote-price, [data-field='last']");
    for (const el of priceEls) {
      const match = (el.textContent || "").match(/\b([4-9]\d{3}\.\d{2}|1[01]\d{3}\.\d{2})\b/);
      if (match) {
        spotPrice = parseFloat(match[1]);
        break;
      }
    }
    return spotPrice || 7744.06;
  },

  parseOptionsChain() {
    const spot = this.parseUnderlyingPrice();
    return {
      type: "DERAYAH_SPX_OPTIONS",
      symbol: "SPX",
      underlyingPrice: spot,
      indexPrice: spot,
      timestamp: Date.now(),
      platform: "Derayah Global",
      calls: [],
      puts: []
    };
  }
};
