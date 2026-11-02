"""
Global Market State Container for Sahm Saudi Pro (تاسي ونمو)
Stores Saudi market overview, TASI/Nomu indices, single stock order depth,
and active trade portfolios.
"""

from typing import Dict, Any, List

class MarketState:
    def __init__(self):
        self.active_page_type: str = "SAUDI_MARKET_TABLE"
        self.active_market: str = "SA"
        self.market_status: str = "OPEN"
        self.active_strategy: str = "AUTO"
        self.last_stock_detail: Dict[str, Any] = {}
        self.last_market_overview: List[Dict[str, Any]] = []
        self.last_market_summary: Dict[str, Any] = {
            "tasi": {"name": "تاسي (TASI)", "price": 0.0, "changePercent": 0.0},
            "nomu": {"name": "نمو (Nomu)", "price": 0.0, "changePercent": 0.0},
            "turnover": 0,
            "volume": 0,
            "trades": 0,
            "status": {"statusText": "سوق مفتوح 🟢", "raw": "OPEN"}
        }
        self.client_count: int = 0
        self.last_update_ts: int = 0

    def update_from_dom(self, payload: Dict[str, Any]):
        page_type = payload.get("pageType") or payload.get("type", "SAUDI_MARKET_TABLE")
        data = payload.get("data") if "data" in payload else payload
        self.active_page_type = page_type
        self.last_update_ts = payload.get("timestamp", 0)

        # Saudi market status
        if payload.get("marketStatus"):
            self.market_status = payload.get("marketStatus")
        elif isinstance(data, dict) and data.get("summary", {}).get("status", {}).get("raw"):
            self.market_status = data["summary"]["status"]["raw"]

        # Strategy override
        if payload.get("activeStrategy"):
            self.active_strategy = payload.get("activeStrategy")

        # 1. Saudi Market Table Update
        if page_type in ["SAUDI_MARKET_TABLE", "MARKET_OVERVIEW"]:
            if isinstance(data, dict):
                self.last_market_overview = data.get("rows") or data.get("stocks") or []
                if data.get("summary"):
                    self.last_market_summary = data["summary"]
            elif isinstance(data, list):
                self.last_market_overview = data

        # 2. Saudi Single Stock Detail (Order book & Time & Sales)
        elif page_type in ["SAUDI_STOCK_DETAIL", "STOCK_DETAIL"]:
            if isinstance(data, dict):
                self.last_stock_detail = data

    def get_summary(self) -> Dict[str, Any]:
        return {
            "activePageType": self.active_page_type,
            "activeMarket": "SA",
            "marketStatus": self.market_status,
            "activeStrategy": self.active_strategy,
            "connectedClients": self.client_count,
            "lastUpdateTimestamp": self.last_update_ts,
            "trackedStocksCount": len(self.last_market_overview),
            "hasActiveStock": bool(self.last_stock_detail),
            "marketSummary": self.last_market_summary
        }

market_state = MarketState()
