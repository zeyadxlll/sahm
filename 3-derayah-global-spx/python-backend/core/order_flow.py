"""
Order Flow & Time and Sales Quantitative Analyzer
Analyzes aggressive market orders, Cumulative Volume Delta (CVD),
and Level 2 Order Book imbalance to detect real-time Accumulation vs Distribution.
"""

from typing import Dict, Any, List

class OrderFlowAnalyzer:
    def __init__(self):
        self.history_deltas: List[float] = []

    def analyze(self, time_and_sales: Dict[str, Any], order_book: Dict[str, Any], symbol: str = "TASI") -> Dict[str, Any]:
        """
        Process incoming DOM Time & Sales and Level 2 Order Book.
        """
        trades = time_and_sales.get("recentTrades", [])
        total_buy_vol = float(time_and_sales.get("totalBuyVolume", 0))
        total_sell_vol = float(time_and_sales.get("totalSellVolume", 0))

        # Re-verify and compute if needed
        if not total_buy_vol and not total_sell_vol and trades:
            for t in trades:
                vol = float(t.get("volume", 0))
                side = str(t.get("side", "NEUTRAL")).upper()
                if side in ["BUY", "UP", "شراء"]:
                    total_buy_vol += vol
                elif side in ["SELL", "DOWN", "بيع"]:
                    total_sell_vol += vol

        total_active_vol = total_buy_vol + total_sell_vol
        if total_active_vol > 0:
            buy_ratio = round((total_buy_vol / total_active_vol) * 100, 1)
            sell_ratio = round((total_sell_vol / total_active_vol) * 100, 1)
        else:
            buy_ratio = 50.0
            sell_ratio = 50.0

        net_delta = total_buy_vol - total_sell_vol
        self.history_deltas.append(net_delta)
        if len(self.history_deltas) > 100:
            self.history_deltas.pop(0)

        # Order Book Level 2 Depth Imbalance
        bid_depth = float(order_book.get("totalBidVolume", 0))
        ask_depth = float(order_book.get("totalAskVolume", 0))
        total_depth = bid_depth + ask_depth

        if total_depth > 0:
            bid_ratio = round((bid_depth / total_depth) * 100, 1)
            ask_ratio = round((ask_depth / total_depth) * 100, 1)
            depth_imbalance = round((bid_depth - ask_depth) / total_depth, 2)
        else:
            bid_ratio = 50.0
            ask_ratio = 50.0
            depth_imbalance = 0.0

        # Sentiment Classification
        if buy_ratio >= 58.0 and (depth_imbalance >= 0 or net_delta > 0):
            sentiment = "ACCUMULATION"
            sentiment_ar = "تجميع لحظي قوي"
            bias = "BULLISH"
        elif sell_ratio >= 58.0 and (depth_imbalance <= 0 or net_delta < 0):
            sentiment = "DISTRIBUTION"
            sentiment_ar = "تصريف وضغط بيعي"
            bias = "BEARISH"
        else:
            sentiment = "BALANCED"
            sentiment_ar = "توازن نسبي وترقب"
            bias = "NEUTRAL"

        # Detection of Iceberg / Absorption
        absorption_alert = None
        if buy_ratio > 65.0 and depth_imbalance < -0.3:
            absorption_alert = "امتصاص عروض بيع ضخمة (Buying Absorption) - إشارة انفجار سعري محتمل"
        elif sell_ratio > 65.0 and depth_imbalance > 0.3:
            absorption_alert = "كسر وامتصاص طلبات شراء (Selling Absorption) - إشارة هبوط محتمل"

        return {
            "symbol": symbol,
            "buyRatio": buy_ratio,
            "sellRatio": sell_ratio,
            "netDelta": int(net_delta),
            "sentiment": sentiment,
            "sentimentArabic": sentiment_ar,
            "bias": bias,
            "totalBuyVolume": int(total_buy_vol),
            "totalSellVolume": int(total_sell_vol),
            "bidRatio": bid_ratio,
            "askRatio": ask_ratio,
            "depthImbalance": depth_imbalance,
            "absorptionAlert": absorption_alert
        }
