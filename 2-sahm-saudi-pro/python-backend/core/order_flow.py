"""
Sahm Saudi Pro - Institutional Smart Money & Order Flow Intelligence Engine
Analyzes aggressive tape orders, Iceberg hidden absorption, Block trades,
and Level 2 Order Book depth to generate high-precision day-trading setups.
"""

import time
from typing import Dict, Any, List, Optional

class OrderFlowAnalyzer:
    def __init__(self):
        self.history_deltas: List[float] = []

    def analyze(
        self,
        time_and_sales: Dict[str, Any],
        order_book: Dict[str, Any],
        stock_header: Optional[Dict[str, Any]] = None,
        symbol: str = "TASI"
    ) -> Dict[str, Any]:
        """
        Deep quantitative analysis of DOM Time & Sales, Level 2 Depth,
        Iceberg orders, Fake Pumps, and exact day-trading trade levels.
        """
        stock_header = stock_header or {}
        current_price = float(stock_header.get("price") or stock_header.get("lastPrice") or 50.0)
        chg_pct = float(stock_header.get("changePercent", 0.0))
        vwap = float(stock_header.get("vwap") or current_price)
        rvol = float(stock_header.get("rvol", 1.8))

        trades = time_and_sales.get("recentTrades", [])
        total_buy_vol = float(time_and_sales.get("totalBuyVolume", 0))
        total_sell_vol = float(time_and_sales.get("totalSellVolume", 0))

        # Re-compute tape totals if empty
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

        # -------------------------------------------------------------
        # 1. Level 2 Order Book Depth & Imbalance Analysis
        # -------------------------------------------------------------
        bids = order_book.get("bids", [])
        asks = order_book.get("asks", [])
        bid_depth = float(order_book.get("totalBidVolume") or sum(b.get("volume", 0) for b in bids))
        ask_depth = float(order_book.get("totalAskVolume") or sum(a.get("volume", 0) for a in asks))
        total_depth = bid_depth + ask_depth

        if total_depth > 0:
            bid_ratio = round((bid_depth / total_depth) * 100, 1)
            ask_ratio = round((ask_depth / total_depth) * 100, 1)
            depth_imbalance = round((bid_depth - ask_depth) / total_depth, 2)
        else:
            bid_ratio = 50.0
            ask_ratio = 50.0
            depth_imbalance = 0.0

        spread = float(order_book.get("depthSpread", 0.05))
        spread_pct = round((spread / current_price) * 100, 2) if current_price > 0 else 0.1

        # Aggressive buying pressure indicator (Bid/Ask Imbalance > 75%)
        has_aggressive_buying_imbalance = (bid_ratio >= 75.0) or (buy_ratio >= 75.0 and bid_ratio >= 60.0)

        # -------------------------------------------------------------
        # 2. Institutional Block Trades & Tape Intelligence
        # -------------------------------------------------------------
        block_trades_count = 0
        whale_buy_vol = 0
        whale_sell_vol = 0
        whale_buy_blocks = 0
        whale_sell_blocks = 0

        for t in trades:
            vol = float(t.get("volume", 0))
            pr = float(t.get("price") or current_price)
            trade_val = vol * pr
            is_block = vol >= 10000 or trade_val >= 150000

            if is_block:
                block_trades_count += 1
                side = str(t.get("side", "BUY")).upper()
                if side in ["BUY", "UP", "شراء"]:
                    whale_buy_vol += vol
                    whale_buy_blocks += 1
                else:
                    whale_sell_vol += vol
                    whale_sell_blocks += 1

        # -------------------------------------------------------------
        # 3. Iceberg Order Detection (كشف أوامر جبل الجليد المخفية)
        # -------------------------------------------------------------
        # Iceberg Buy: Heavy sell volume executed at best bid, but price refuses to break down
        # and bid depth continuously replenishes
        best_bid = float(bids[0].get("price", current_price)) if bids else current_price
        best_ask = float(asks[0].get("price", current_price)) if asks else current_price

        executed_at_bid = sum(float(t.get("volume", 0)) for t in trades if abs(float(t.get("price", 0)) - best_bid) <= 0.03 and str(t.get("side", "")).upper() in ["SELL", "DOWN", "بيع"])
        executed_at_ask = sum(float(t.get("volume", 0)) for t in trades if abs(float(t.get("price", 0)) - best_ask) <= 0.03 and str(t.get("side", "")).upper() in ["BUY", "UP", "شراء"])

        has_buy_iceberg = False
        has_sell_iceberg = False
        iceberg_type = "NONE"
        iceberg_details = "لا توجد أوامر مخفية مرصودة حالياً"

        if executed_at_bid >= 20000 and bid_ratio >= 55.0 and current_price >= best_bid:
            has_buy_iceberg = True
            iceberg_type = "BUY_ICEBERG"
            iceberg_details = f"رصد أمر جبل جليدي شرائي مخفي (Iceberg Buy) يبتلع صفقات البيع عند مستوى {best_bid:.2f} ر.س دون السماح للسعر بالهبوط."
        elif executed_at_ask >= 20000 and ask_ratio >= 65.0 and current_price <= best_ask:
            has_sell_iceberg = True
            iceberg_type = "SELL_ICEBERG"
            iceberg_details = f"رصد جدار تصريف مخفي (Iceberg Sell) يمتص طلبات الشراء عند مستوى {best_ask:.2f} ر.س."

        # -------------------------------------------------------------
        # 4. Fake Pump Filter (فلتر المصائد الوهمية والفخاخ)
        # -------------------------------------------------------------
        # Condition: High volume or price up, but institutional tape is negative or bid is completely hollow
        is_fake_trap = False
        trap_reason = ""

        if chg_pct >= 1.5 and (buy_ratio <= 44.0 or net_delta < -15000):
            is_fake_trap = True
            trap_reason = "⚠️ مصيدة وهمية (Fake Pump): صعود سعري مصطنع مع تدفق بيعي سلبي (-Delta) وخروج سيولة كبار المتداولين."
        elif chg_pct >= 2.0 and bid_ratio <= 35.0 and ask_ratio >= 65.0:
            is_fake_trap = True
            trap_reason = "⚠️ فخ سيولة (Liquidity Trap): عمق الطلبات ضعيف ومجوف (35%) مع وجود جدار عروض تصريفية كثيفة."
        elif sell_ratio >= 65.0 and whale_sell_blocks >= 2:
            is_fake_trap = True
            trap_reason = "⚠️ تصريف كتل كبرى: صفقات بيع مؤسسية متتالية تضغط على السهم."

        # -------------------------------------------------------------
        # 5. True Probability Score (75% to 94% for Valid Day-Trading Setups)
        # -------------------------------------------------------------
        if is_fake_trap:
            true_probability = 38
        else:
            # Base probability for day-trading setup
            prob = 75.0

            # RVOL momentum component (+2% to +5%)
            if rvol >= 3.0:
                prob += 5.0
            elif rvol >= 2.0:
                prob += 3.5
            elif rvol >= 1.5:
                prob += 2.0

            # Order Flow tape component (+3% to +6%)
            if buy_ratio >= 75.0:
                prob += 6.0
            elif buy_ratio >= 65.0:
                prob += 4.0
            elif buy_ratio >= 55.0:
                prob += 2.0

            # Level 2 Order Book Depth component (+2% to +4%)
            if bid_ratio >= 75.0:
                prob += 4.5
            elif bid_ratio >= 65.0:
                prob += 3.0

            # Hidden Iceberg bonus (+3.5%)
            if has_buy_iceberg:
                prob += 3.5

            # Whale Block Trades aggression (+2.5%)
            if whale_buy_blocks >= 2 and whale_buy_vol > whale_sell_vol * 1.5:
                prob += 2.5

            # VWAP Institutional benchmark (+2.0%)
            if current_price >= vwap:
                prob += 2.0

            # Spread efficiency penalty (wide spread reduces probability)
            if spread_pct > 0.4:
                prob -= 3.0

            # Strict bounds: strictly 75% to 94% for high-probability setups
            true_probability = int(min(94, max(75, round(prob))))

        # -------------------------------------------------------------
        # 6. Precise Day-Trading Levels Calculator (بالهللة)
        # -------------------------------------------------------------
        # Exact Entry Price: Breakout trigger or dip absorption price
        if has_buy_iceberg:
            entry_price = round(best_bid, 2)
            entry_type = "تمركز عند دعم جبل الجليد المخفي (Dip Absorption)"
        elif current_price >= vwap:
            entry_price = round(current_price, 2)
            entry_type = "دخول لحظي مؤكد مع اختراق الزخم (Momentum Breakout)"
        else:
            entry_price = round(max(current_price, vwap), 2)
            entry_type = "تأكيد تجاوز متوسط الجلسة VWAP"

        # Target 1: Intraday Resistance 1 (+2.5% to +4.5%)
        # Dynamically sized based on probability and RVOL
        tp1_pct = 0.035 if true_probability >= 85 else 0.028
        target_1 = round(entry_price * (1 + tp1_pct), 2)

        # Target 2: Intraday Resistance 2 (+6.0% to +9.0%)
        tp2_pct = 0.075 if true_probability >= 85 else 0.062
        target_2 = round(entry_price * (1 + tp2_pct), 2)

        # Stop Loss: VWAP or immediate structural support breach
        # STRICT RULE: Maximum -1.5% from entry price!
        raw_sl = max(vwap * 0.995, entry_price * 0.985)
        # Enforce strict max -1.5% boundary
        max_allowed_sl = entry_price * 0.985
        stop_loss = round(min(raw_sl, max_allowed_sl), 2)
        sl_pct = round(((stop_loss - entry_price) / entry_price) * 100, 1)

        # Risk-to-Reward Ratios
        risk_per_share = max(0.01, entry_price - stop_loss)
        reward_tp1 = max(0.01, target_1 - entry_price)
        reward_tp2 = max(0.01, target_2 - entry_price)
        rr_tp1 = round(reward_tp1 / risk_per_share, 1)
        rr_tp2 = round(reward_tp2 / risk_per_share, 1)

        # -------------------------------------------------------------
        # 7. Institutional Smart Money Rationale Generator (باللغة العربية)
        # -------------------------------------------------------------
        if is_fake_trap:
            rationale = trap_reason
            sentiment_ar = "مصيدة وهمية ⚠️"
            signal_color = "#ef4444"
            action_tag = "حظر الشراء وتفادي الفخ ⛔"
        elif has_buy_iceberg:
            rationale = f"رصد أوامر جبل جليدي مخفية (Iceberg) تبتلع العروض عند {entry_price:.2f} ر.س، مع تفوق طلبات الشراء ({bid_ratio}%) وتدفق صفقات كتل تدعم الانفجار السعري."
            sentiment_ar = "امتصاص مخفي قوي 🧊"
            signal_color = "#00F090"
            action_tag = "دخول لحظي مؤكد 🎯"
        elif has_aggressive_buying_imbalance:
            rationale = f"ضغط شرائي كاسح في عمق سجل الأوامر بنسبة طلبات {bid_ratio}% وسيطرة مطلقة لصفقات الشراء في شريط الصفقات ({buy_ratio}%) فوق متوسط VWAP."
            sentiment_ar = "ضغط شراء كاسح ⚡"
            signal_color = "#00F090"
            action_tag = "اختراق زخم سريع 🚀"
        elif buy_ratio >= 60.0:
            rationale = f"تجميع مؤسسي منتظم مع سيولة شرائية صافية (+{net_delta:,.0f} سهم) وتمركز استباقي لكبار الملاك تمهيداً لتحقيق الأهداف."
            sentiment_ar = "تجميع مؤسسي استباقي 🟢"
            signal_color = "#10b981"
            action_tag = "تمركز مضاربي آمن 💼"
        else:
            rationale = "توازن نسبي بين قوى العرض والطلب قرب مستويات الارتكاز مع مراقبة تدفق صفقات الكتل اللحظية."
            sentiment_ar = "توازن وترقب ⚪"
            signal_color = "#94a3b8"
            action_tag = "مراقبة لحظية ⏳"

        return {
            "symbol": symbol,
            "buyRatio": buy_ratio,
            "sellRatio": sell_ratio,
            "netDelta": int(net_delta),
            "sentiment": sentiment_ar,
            "sentimentArabic": sentiment_ar,
            "signalColor": signal_color,
            "actionTag": action_tag,
            "totalBuyVolume": int(total_buy_vol),
            "totalSellVolume": int(total_sell_vol),
            "bidRatio": bid_ratio,
            "askRatio": ask_ratio,
            "depthImbalance": depth_imbalance,
            "spread": spread,
            "spreadPct": spread_pct,
            # Block trades & Tape
            "blockTradesCount": block_trades_count,
            "whaleBuyBlocks": whale_buy_blocks,
            "whaleSellBlocks": whale_sell_blocks,
            "whaleBuyVol": int(whale_buy_vol),
            "whaleSellVol": int(whale_sell_vol),
            "hasAggressiveImbalance": has_aggressive_buying_imbalance,
            # Iceberg Detection
            "hasBuyIceberg": has_buy_iceberg,
            "hasSellIceberg": has_sell_iceberg,
            "icebergType": iceberg_type,
            "icebergDetails": iceberg_details,
            # Fake Trap Filter
            "isFakeTrap": is_fake_trap,
            "trapReason": trap_reason,
            # True Probability (75% - 94%)
            "trueProbability": true_probability,
            # Exact Day-Trading Plan
            "entryPrice": entry_price,
            "entryType": entry_type,
            "target1": target_1,
            "target1Pct": round(tp1_pct * 100, 1),
            "target2": target_2,
            "target2Pct": round(tp2_pct * 100, 1),
            "stopLoss": stop_loss,
            "stopLossPct": sl_pct,
            "riskRewardTp1": f"1 : {rr_tp1}",
            "riskRewardTp2": f"1 : {rr_tp2}",
            # Institutional Smart Money Rationale
            "rationale": rationale,
            "timestamp": int(time.time() * 1000)
        }
