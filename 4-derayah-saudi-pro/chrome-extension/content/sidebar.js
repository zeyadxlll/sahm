/**
 * Derayah Saudi Pro - Floating Sidebar UI
 * Port: 8003
 */

window.DerayahSaudiSidebar = {
  isOpen: true,
  isConnected: false,
  state: {
    opportunities: []
  },

  init() {
    if (document.getElementById("derayah-saudi-copilot-root")) return;

    const root = document.createElement("div");
    root.id = "derayah-saudi-copilot-root";
    root.innerHTML = `
      <div id="derayah-saudi-copilot-sidebar" class="copilot-sidebar">
        <div class="copilot-header">
          <div class="copilot-title-group">
            <span class="copilot-logo">🇸🇦</span>
            <div>
              <div class="copilot-title">Derayah Saudi Pro</div>
              <div class="copilot-subtitle">مساعد دراية للأسهم السعودية (تاسي ونمو)</div>
            </div>
          </div>
          <div class="copilot-header-actions">
            <span id="derayah-saudi-connection-badge" class="connection-pill">غير متصل (8003)</span>
            <button id="derayah-saudi-btn-toggle" class="btn-toggle">✕</button>
          </div>
        </div>

        <div class="copilot-market-bar">
          <span class="market-tag">🇸🇦 السوق السعودي (Derayah)</span>
          <span class="session-tag">Port 8003</span>
        </div>

        <div id="derayah-saudi-content-body" class="copilot-body">
          <div class="copilot-card">
            <div style="font-size:11px; color:#94a3b8; font-weight:700;">رادار الأسهم والسيولة (دراية)</div>
            <div style="font-size:13px; font-weight:800; color:#f8fafc; margin-top:4px;">تتبع السيولة الذكية ومزاد الإغلاق</div>
            <div style="font-size:10px; color:#38bdf8; margin-top:4px;">🎯 بانتظار مسح جدول السوق من منصة دراية المالية...</div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(root);

    document.getElementById("derayah-saudi-btn-toggle")?.addEventListener("click", () => {
      const sb = document.getElementById("derayah-saudi-copilot-sidebar");
      if (sb) {
        sb.style.display = sb.style.display === "none" ? "block" : "none";
      }
    });
  },

  updateConnectionStatus(connected) {
    this.isConnected = connected;
    const badge = document.getElementById("derayah-saudi-connection-badge");
    if (badge) {
      if (connected) {
        badge.innerText = "متصل (8003)";
        badge.style.background = "rgba(16, 185, 129, 0.2)";
        badge.style.color = "#00F090";
      } else {
        badge.innerText = "غير متصل (8003)";
        badge.style.background = "rgba(239, 68, 68, 0.2)";
        badge.style.color = "#FF3B56";
      }
    }
  },

  updateFromBackend(data) {
    if (!data) return;
    this.state.opportunities = data.opportunities || [];
  }
};
