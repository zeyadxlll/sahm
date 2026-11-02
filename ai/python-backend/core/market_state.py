"""
Global Market State Container
Stores active market (SA vs US), market session status, manual strategy overrides,
DOM snapshots, 4D analysis cache, and options chains.
"""

from typing import Dict, Any, List

class MarketState:
    def __init__(self):
        self.active_page_type: str = "UNKNOWN"
        self.active_market: str = "SA"  # SA or US
        self.market_status: str = "OPEN"  # OPEN or CLOSED
        self.active_strategy: str = "AUTO"  # AUTO or manual override
        self.last_stock_detail: Dict[str, Any] = {}
        self.last_market_overview: List[Dict[str, Any]] = []
        self.last_spx_options: Dict[str, Any] = {}
        self.client_count: int = 0
        self.last_update_ts: int = 0

    def update_from_dom(self, payload: Dict[str, Any]):
        page_type = payload.get("pageType", "UNKNOWN")
        data = payload.get("data", {})
        self.active_page_type = page_type
        self.last_update_ts = payload.get("timestamp", 0)

        # Update active market if present
        if payload.get("activeMarket"):
            self.active_market = payload.get("activeMarket")
        elif isinstance(data, dict) and data.get("activeMarket"):
            self.active_market = data.get("activeMarket")
        elif page_type == "SPX_OPTIONS":
            self.active_market = "US"

        # Update market status if present
        if payload.get("marketStatus"):
            self.market_status = payload.get("marketStatus")
        elif isinstance(data, dict) and data.get("summary", {}).get("status", {}).get("raw"):
            self.market_status = data["summary"]["status"]["raw"]

        # Strategy override if sent
        if payload.get("activeStrategy"):
            self.active_strategy = payload.get("activeStrategy")

        if page_type == "STOCK_DETAIL":
            self.last_stock_detail = data
            # Check symbol to infer market
            sym = str(data.get("stock", {}).get("symbol", ""))
            if sym.isdigit():
                self.active_market = "SA"
            elif sym in ["SPX", "AAPL", "NVDA", "TSLA", "MSFT", "AMZN", "META"]:
                self.active_market = "US"

        elif page_type == "MARKET_OVERVIEW":
            self.last_market_overview = data.get("stocks", [])
            if data.get("activeMarket"):
                self.active_market = data.get("activeMarket")

        elif page_type == "SPX_OPTIONS":
            self.last_spx_options = data
            self.active_market = "US"

    def get_summary(self) -> Dict[str, Any]:
        return {
            "activePageType": self.active_page_type,
            "activeMarket": self.active_market,
            "marketStatus": self.market_status,
            "activeStrategy": self.active_strategy,
            "connectedClients": self.client_count,
            "lastUpdateTimestamp": self.last_update_ts,
            "trackedStocksCount": len(self.last_market_overview),
            "hasActiveStock": bool(self.last_stock_detail),
            "hasSPXData": bool(self.last_spx_options)
        }

market_state = MarketState()
