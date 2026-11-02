/**
 * Derayah Global SPX Options - Floating Sidebar UI
 * Port: 8002
 */

window.DerayahSidebar = {
  isOpen: true,
  isConnected: false,
  state: {
    spxEngine: {}
  },

  init() {
    if (document.getElementById("derayah-copilot-root")) return;

    const root = document.createElement("div");
    root.id = "derayah-copilot-root";
    root.innerHTML = `
      <div id="derayah-copilot-sidebar" class="copilot-sidebar">
        <div class="copilot-header">
          <div class="copilot-title-group">
            <span class="copilot-logo">📈</span>
            <div>
              <div class="copilot-title">Derayah Global SPX</div>
              <div class="copilot-subtitle">مساعد دراية جلوبل SPX 0DTE</div>
            </div>
          </div>
          <div class="copilot-header-actions">
            <span id="derayah-connection-badge" class="connection-pill">غير متصل (8002)</span>
            <button id="derayah-btn-toggle" class="btn-toggle">✕</button>
          </div>
        </div>

        <div class="copilot-market-bar">
          <span class="market-tag">🇺🇸 السوق الأمريكي (Derayah Global)</span>
          <span class="session-tag">Port 8002</span>
        </div>

        <div id="derayah-content-body" class="copilot-body">
          <div class="copilot-card">
            <div style="font-size:11px; color:#94a3b8; font-weight:700;">سعر مؤشر SPX (دراية جلوبل)</div>
            <div id="derayah-spx-price" style="font-size:22px; font-weight:900; color:#f8fafc; margin-top:2px;">7744.06</div>
            <div style="font-size:10px; color:#38bdf8; margin-top:4px;">🎯 بانتظار مسح سلسلة العقود من منصة دراية جلوبل...</div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(root);

    document.getElementById("derayah-btn-toggle")?.addEventListener("click", () => {
      const sb = document.getElementById("derayah-copilot-sidebar");
      if (sb) {
        sb.style.display = sb.style.display === "none" ? "block" : "none";
      }
    });
  },

  updateConnectionStatus(connected) {
    this.isConnected = connected;
    const badge = document.getElementById("derayah-connection-badge");
    if (badge) {
      if (connected) {
        badge.innerText = "متصل (8002)";
        badge.style.background = "rgba(16, 185, 129, 0.2)";
        badge.style.color = "#00F090";
      } else {
        badge.innerText = "غير متصل (8002)";
        badge.style.background = "rgba(239, 68, 68, 0.2)";
        badge.style.color = "#FF3B56";
      }
    }
  },

  updateFromBackend(data) {
    if (!data) return;
    this.state.spxEngine = data;
    const priceEl = document.getElementById("derayah-spx-price");
    if (priceEl && data.indexPrice) {
      priceEl.innerText = data.indexPrice;
    }
  }
};
