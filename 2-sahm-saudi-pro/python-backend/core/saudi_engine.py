"""
Sahm Saudi Pro - Core Quantitative Engine for Saudi Stocks (تاسي ونمو)
Implements precise step-by-step mathematical & algorithmic mechanics:
- Strategy A: Multi-Month Support & Range Rebound (قاع 6-12 شهر، وقف 0.8% أسفل القاع، 1-8 أسابيع)
- Strategy B: RVOL Momentum Breakout (حجم نسبي RVOL > 2.5، فوق VWAP، 1-3 جلسات)
- Strategy C: Defensive Mean-Reversion in Bearish Regimes (حظر صفقات الاختراق في السوق الهابط، دعوم هيكلية)
- Strategy D: Nomu Growth Scalper (مضاربة سريعة لأسهم نمو الواعدة)
"""

import re
import time
import logging
from typing import Dict, Any, List, Optional, Tuple
from core.historical_data import HistoricalDataManager

logger = logging.getLogger("SahmCopilot.SaudiEngine")

class SaudiMarketEngine:
    KNOWN_SAUDI_STOCKS = {
        "1120": "مصرف الراجحي",
        "2222": "أرامكو السعودية",
        "2360": "الفخارية",
        "9557": "إدارات",
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
    }

    def __init__(self):
        self.hist_mgr = HistoricalDataManager()
        self.active_tracked_trades: Dict[str, Dict[str, Any]] = {}
        self.last_alerts: Dict[str, float] = {}

    @classmethod
    def is_tadawul_code(cls, code: str) -> bool:
        """
        Check if code is genuine Saudi Tadawul code:
        - TASI: strictly 4 digits starting 1-8
        - Nomu: strictly 4 or 5 digits starting 9
        """
        if not code:
            return False
        c = str(code).strip()
        if len(c) == 4 and c.isdigit() and c[0] in "12345678":
            return True
        if (len(c) in [4, 5]) and c.isdigit() and c.startswith("9"):
            return True
        return False

    @classmethod
    def extract_clean_symbol_and_name(cls, raw_symbol: str, raw_name: str) -> Tuple[str, str]:
        """
        Extract genuine Tadawul code (e.g. 2360, 9557, 6013) and clean Arabic company name
        from strings like '2360Dالفخارية' or '9557Dإدارات', eliminating internal Sahm IDs.
        """
        combined = f"{raw_symbol} {raw_name}".strip()
        for ar, en in zip("٠١٢٣٤٥٦٧٨٩", "0123456789"):
            combined = combined.replace(ar, en)
            raw_symbol = str(raw_symbol).replace(ar, en)

        # 1. Broker prefix 59 e.g. 592360D
        m59 = re.search(r'(?<!\d)59([1-8]\d{3}|9\d{3,4})(?=[A-Za-z\s\u0600-\u06FF]|$)', combined)
        symbol = ""
        if m59 and cls.is_tadawul_code(m59.group(1)):
            symbol = m59.group(1)

        # 2. Standard Tadawul code e.g. 2360Dالفخارية, 9557Dإدارات
        if not symbol:
            m_code = re.search(r'(?<!\d)([1-8]\d{3}|9\d{3,4})(?=[A-Za-z\s\u0600-\u06FF]|$)', combined)
            if m_code and cls.is_tadawul_code(m_code.group(1)):
                symbol = m_code.group(1)

        # 3. Direct raw_symbol check
        if not symbol:
            digits = "".join(filter(str.isdigit, raw_symbol))
            if digits.startswith("59") and len(digits) == 6:
                cand = digits[2:]
                if cls.is_tadawul_code(cand):
                    symbol = cand
            elif cls.is_tadawul_code(digits):
                symbol = digits

        # Clean Company Name
        name = combined
        # Eliminate 6-digit internal IDs (e.g. 214327, 129632)
        name = re.sub(r'\b\d{6,}\b', ' ', name)
        if symbol:
            name = re.sub(rf'(?:59)?{symbol}[A-Za-z]?', ' ', name, flags=re.IGNORECASE)
        name = re.sub(r'\b(?:59)?\d{4,5}[A-Za-z]?\b', ' ', name, flags=re.IGNORECASE)
        name = re.sub(r'\d+[A-Za-z]?', ' ', name)
        name = re.sub(r'\b[A-Za-z]+\b', ' ', name)
        name = re.sub(r'(?:^|\s+)سهم(?:\s+|$)', ' ', name)
        name = re.sub(r'[^\u0600-\u06FF\s&.-]', ' ', name)
        name = re.sub(r'\s+', ' ', name).strip()

        words = name.split()
        seen = set()
        clean_words = []
        for w in words:
            if w not in seen:
                seen.add(w)
                clean_words.append(w)
        name = " ".join(clean_words).strip()

        if not symbol:
            return "", ""
        if not name or len(name) < 2:
            name = cls.KNOWN_SAUDI_STOCKS.get(symbol, f"سهم {symbol}")

        return symbol, name

    def clear_all_trades_and_alerts(self):
        """Reset all tracked active trades and alert timestamps."""
        self.active_tracked_trades.clear()
        self.last_alerts.clear()
        logger.info("Cleared all Saudi tracked trades and alert history.")

    def evaluate_stock_row(self, row: Dict[str, Any], is_bearish_regime: bool = False) -> Dict[str, Any]:
        """
        Enrich a parsed stock row with precise quantitative scores, signals,
        exact mathematical strategy classification, price targets, and timeframe.
        """
        raw_symbol = str(row.get("symbol", "")).strip()
        raw_name = str(row.get("name", "")).strip()

        symbol, name = self.extract_clean_symbol_and_name(raw_symbol, raw_name)

        last_price = float(row.get("lastPrice") or row.get("price") or 0.0)
        chg_pct = float(row.get("changePercent", 0.0))
        volume = float(row.get("volume", 0.0))
        trades = int(row.get("trades", 0))
        bid_vol = float(row.get("bidVol", 0.0))
        ask_vol = float(row.get("askVol", 0.0))
        turnover = float(row.get("turnover", 0.0))
        open_price = float(row.get("openPrice", 0.0))
        high_price = float(row.get("highPrice", 0.0))
        low_price = float(row.get("lowPrice", 0.0))

        # Calculate buy pressure ratio
        total_depth_vol = bid_vol + ask_vol
        buy_ratio = round((bid_vol / total_depth_vol * 100), 1) if total_depth_vol > 0 else 50.0
        has_buying_absorption = (bid_vol > ask_vol) or (buy_ratio >= 51.5)

        # Market classification: Nomu stocks start with 9
        is_nomu = symbol.startswith("9")
        market_type = "NOMU" if is_nomu else "TASI"

        # Fetch technical indicators & historical benchmarks
        tech = self.hist_mgr.get_technical_indicators(
            symbol=symbol,
            current_price=last_price,
            high=high_price,
            low=low_price,
            open_price=open_price,
            volume=volume
        )

        rvol = float(tech.get("rvol", 1.0))
        multi_month_low = float(tech.get("multiMonthLow", round(last_price * 0.88, 2)))
        multi_month_high = float(tech.get("multiMonthHigh", round(last_price * 1.25, 2)))
        midpoint_res = float(tech.get("midpointResistance", round(last_price * 1.05, 2)))
        dist_from_low_pct = float(tech.get("distFromLowPct", 0.0))
        is_near_multi_month_low = bool(tech.get("isNearMultiMonthLow", False))
        vwap = float(tech.get("vwap", last_price))
        is_above_vwap = last_price >= vwap

        # --- STRATEGY ASSIGNMENT ENGINE ---
        strategy_code = "DEFENSIVE_SUPPORT"
        strategy_label = "🛡️ الاستراتيجية: حماية رأس المال والتمركز عند الدعوم"
        strategy_detail = "تمركز دفاعي حذر عند مستويات الارتكاز لحماية رأس المال واقتناص الارتداد."
        timeframe = "قيد المراقبة اللحظية"
        signal = "مراقبة ⚪"
        signal_color = "#94a3b8"
        score = 50

        target_1 = round(last_price * 1.025, 2)
        target_2 = round(last_price * 1.050, 2)
        stop_loss = round(last_price * 0.975, 2)

        # -------------------------------------------------------------------------
        # STRATEGY C: Defensive Mean-Reversion in Bearish Regimes (السوق الهابط والأزمات)
        # Block all momentum/breakouts when TASI breadth is negative
        # -------------------------------------------------------------------------
        if is_bearish_regime:
            if has_buying_absorption and trades >= 20 and chg_pct >= -3.5:
                strategy_code = "STRATEGY_C_DEFENSIVE_BEAR"
                strategy_label = "🛡️ الاستراتيجية: ارتداد دفاعي من الدعوم الهيكلية (سوق هابط)"
                strategy_detail = f"حظر صفقات الاختراق نظراً لضغوط السوق الهابط. تمركز دفاعي عند الدعوم مع امتصاص طلبات الشراء ({buy_ratio}%)."
                timeframe = "جلسة إلى جلستين (ارتداد دفاعي مؤقت)"
                signal = "دفاعي ارتدادي 🛡️"
                signal_color = "#38bdf8"
                score = min(89, max(68, int(70 + (buy_ratio - 50) * 0.4)))
                # Quick bounce targets
                target_1 = round(last_price * 1.025, 2)
                target_2 = round(last_price * 1.045, 2)
                # Strict structural stop loss at -1.5%
                stop_loss = round(last_price * 0.985, 2)
            else:
                strategy_code = "DEFENSIVE_SUPPORT"
                strategy_label = "🛡️ الاستراتيجية: حظر التداول وتفادي الهبوط (سوق هابط)"
                strategy_detail = "ضغط بيعي عام في السوق - تفعيل وضع حظر الصفقات والمراقبة الصارمة."
                timeframe = "ممنوع الدخول ⛔"
                signal = "تصريف سلبي 🔴"
                signal_color = "#ef4444"
                score = max(20, int(45 - abs(chg_pct) * 2))
                stop_loss = round(last_price * 0.985, 2)

        # -------------------------------------------------------------------------
        # STRATEGY A: Multi-Month Support & Range Rebound (الارتداد من الدعم التاريخي)
        # Scan lowest price over 6-12 months; if within ±1.5% and order-book shows absorption
        # -------------------------------------------------------------------------
        elif is_near_multi_month_low and has_buying_absorption:
            strategy_code = "STRATEGY_A_SUPPORT_REBOUND"
            strategy_label = "🎯 الاستراتيجية: الارتداد من الدعم التاريخي والمستويات السنوية"
            strategy_detail = f"السعر قرب قاع 6-12 شهر ({multi_month_low:.2f} ر.س بفارق {dist_from_low_pct:+.1f}%) مع امتصاص طلبات الشراء. وقف الخسارة صارم 0.8% أسفل القاع."
            timeframe = "1 إلى 8 أسابيع (سوينغ/استثماري)"
            signal = "ارتداد سنوي 🎯"
            signal_color = "#10b981"
            score = min(98, max(78, int(82 + (buy_ratio - 50) * 0.35 - abs(dist_from_low_pct) * 2)))

            # Target 1: Midpoint resistance (+3% to +5%)
            tp1_mid = midpoint_res if (midpoint_res > last_price * 1.025 and midpoint_res < last_price * 1.07) else round(last_price * 1.04, 2)
            target_1 = round(tp1_mid, 2)

            # Target 2: Upper range boundary (+8% to +12%)
            tp2_upper = multi_month_high if (multi_month_high > last_price * 1.06 and multi_month_high < last_price * 1.15) else round(last_price * 1.095, 2)
            target_2 = round(tp2_upper, 2)

            # Stop loss: Strictly 0.8% below the multi-month support!
            stop_loss = round(multi_month_low * 0.992, 2)

        # -------------------------------------------------------------------------
        # STRATEGY B: RVOL Momentum Breakout (اختراق السيولة والزخم للجلسة)
        # RVOL > 2.5, price above VWAP, trade frequency spike (trades >= 30)
        # -------------------------------------------------------------------------
        elif rvol >= 2.5 and is_above_vwap and trades >= 30 and chg_pct >= 0.8:
            strategy_code = "STRATEGY_B_RVOL_BREAKOUT"
            strategy_label = "⚡ الاستراتيجية: اختراق الزخم وحجم التداول النسبي RVOL"
            strategy_detail = f"اختراق سعري مدعوم بتدفق سيولة نسبية RVOL={rvol:.1f}x فوق متوسط VWAP ({vwap:.2f}) مع تسارع الصفقات."
            timeframe = "1 إلى 3 جلسات (مضاربة سريعة)"
            signal = "زخم اختراق 🚀"
            signal_color = "#00F090"
            score = min(98, max(76, int(76 + min(rvol * 4, 14) + chg_pct * 1.8)))

            # Quick intraday targets (+2% to +4%)
            target_1 = round(last_price * 1.025, 2)
            target_2 = round(last_price * 1.045, 2)

            # Stop loss below session VWAP
            stop_loss = round(min(vwap * 0.995, last_price * 0.985), 2)

        # -------------------------------------------------------------------------
        # STRATEGY D: Nomu High-Growth Scalper
        # -------------------------------------------------------------------------
        elif is_nomu and chg_pct >= 1.2 and buy_ratio >= 55.0:
            strategy_code = "NOMU_GROWTH"
            strategy_label = "🚀 الاستراتيجية: مضاربة نمو السريعة للشركات الواعدة"
            strategy_detail = f"اقتناص الزخم المتسارع في سوق نمو بسيولة شرائية {buy_ratio}% وأحجام صفقات نشطة."
            timeframe = "1 إلى 3 جلسات (مضاربة سريعة)"
            signal = "نمو سريع 🚀"
            signal_color = "#fbbf24"
            score = min(94, max(72, int(72 + chg_pct * 1.6)))
            target_1 = round(last_price * 1.030, 2)
            target_2 = round(last_price * 1.060, 2)
            stop_loss = round(last_price * 0.975, 2)

        # -------------------------------------------------------------------------
        # Whale Accumulation (Sideways range accumulation)
        # -------------------------------------------------------------------------
        elif buy_ratio >= 60.0 and chg_pct >= -0.8:
            strategy_code = "WHALE_ACCUMULATION"
            strategy_label = "🔬 الاستراتيجية: تجميع الهوامير والسيولة الذكية عند الدعم"
            strategy_detail = "امتصاص صفقات كبار المتداولين لطلبات الشراء في عمق سجل الأوامر وتثبيت السعر."
            timeframe = "2 إلى 5 جلسات (تمركز ذكي)"
            signal = "تجميع هوامير 🟢"
            signal_color = "#10b981"
            score = min(92, max(70, int(70 + (buy_ratio - 50) * 0.4)))
            target_1 = round(last_price * 1.025, 2)
            target_2 = round(last_price * 1.050, 2)
            stop_loss = round(last_price * 0.980, 2)

        # -------------------------------------------------------------------------
        # Bearish Breakdown / Dumping
        # -------------------------------------------------------------------------
        elif chg_pct <= -2.5 and buy_ratio <= 42.0:
            strategy_code = "DEFENSIVE_SUPPORT"
            strategy_label = "🛡️ الاستراتيجية: حماية رأس المال وتفادي التصريف"
            strategy_detail = "ضغط بيعي وتصريف سلبي - تفعيل سياسة تجنب الصفقات الخاسرة فوراً."
            timeframe = "ممنوع الدخول ⛔"
            signal = "تصريف سلبي 🔴"
            signal_color = "#ef4444"
            score = max(20, int(45 - abs(chg_pct) * 2))
            stop_loss = round(last_price * 0.980, 2)

        # Default Neutral / Positive Flow
        elif chg_pct > 0:
            strategy_code = "AUCTION_SNIPER"
            strategy_label = "🔮 الاستراتيجية: تمركز مزاد الإغلاق وفجوة الافتتاح"
            strategy_detail = "مراقبة تجميع مزاد الإغلاق لاقتناص فجوة الافتتاح الصاعدة لجلسة الغد."
            timeframe = "جلسة الغد (جرس الافتتاح)"
            signal = "إيجابي هادئ 🟡"
            signal_color = "#fbbf24"
            score = min(75, max(52, int(55 + chg_pct * 1.5)))
            target_1 = round(last_price * 1.020, 2)
            target_2 = round(last_price * 1.040, 2)
            stop_loss = round(last_price * 0.980, 2)

        # Overnight Gap Probability for Tab 3 (Auction Sniper)
        overnight_prob = min(94, max(45, int(score * 0.75 + (buy_ratio * 0.25))))

        return {
            "symbol": symbol,
            "name": name,
            "marketType": market_type,
            "lastPrice": last_price,
            "price": last_price,
            "changePercent": chg_pct,
            "changeAmount": float(row.get("changeAmount", 0.0)),
            "volume": volume,
            "trades": trades,
            "turnover": turnover if turnover > 0 else round(volume * last_price, 2),
            "bidPrice": float(row.get("bidPrice", 0.0)),
            "bidVol": bid_vol,
            "askPrice": float(row.get("askPrice", 0.0)),
            "askVol": ask_vol,
            "openPrice": open_price,
            "highPrice": high_price,
            "lowPrice": low_price,
            "buyRatio": buy_ratio,
            "score": score,
            "signal": signal,
            "signalColor": signal_color,
            "strategyCode": strategy_code,
            "strategyLabel": strategy_label,
            "strategyDetail": strategy_detail,
            "timeframe": timeframe,
            "rvol": rvol,
            "multiMonthLow": multi_month_low,
            "distFromLowPct": dist_from_low_pct,
            "vwap": vwap,
            "target1": target_1,
            "target2": target_2,
            "stopLoss": stop_loss,
            "overnightProbability": overnight_prob,
            "timestamp": int(time.time() * 1000)
        }

    def process_market_table(self, rows: List[Dict[str, Any]], is_bearish: Optional[bool] = None) -> List[Dict[str, Any]]:
        """
        Process and sort all rows from the Saudi market table.
        Automatically checks TASI market breadth to detect bearish regimes and block breakouts.
        """
        if is_bearish is None and rows:
            # Measure breadth: decliners vs advancers
            decliners = sum(1 for r in rows if float(r.get("changePercent", 0.0)) < -0.2)
            advancers = sum(1 for r in rows if float(r.get("changePercent", 0.0)) > 0.2)
            is_bearish = (decliners > advancers * 1.3) and (decliners > len(rows) * 0.45)

        enriched = []
        seen = set()
        for r in rows:
            item = self.evaluate_stock_row(r, is_bearish_regime=bool(is_bearish))
            sym = item.get("symbol", "")
            if not sym or not self.is_tadawul_code(sym) or sym in seen:
                continue
            seen.add(sym)
            enriched.append(item)

        # Sort by institutional score (primary) and turnover (tiebreaker)
        enriched.sort(key=lambda s: (s["score"] * 10_000_000 + min(s["turnover"], 10_000_000)), reverse=True)
        return enriched

    def get_top_breakout_stocks(self, stocks: List[Dict[str, Any]], limit: int = 5) -> List[Dict[str, Any]]:
        """Filter top high-probability breakout stocks."""
        filtered = [s for s in stocks if s["score"] >= 70 and s["lastPrice"] > 0]
        return filtered[:limit]

    def get_next_session_candidates(self, stocks: List[Dict[str, Any]], limit: int = 4) -> List[Dict[str, Any]]:
        """Filter top candidates for overnight gap and next session auction."""
        candidates = [s for s in stocks if s["overnightProbability"] >= 65 and s["lastPrice"] > 0]
        candidates.sort(key=lambda s: s["overnightProbability"], reverse=True)
        return candidates[:limit]

    def track_trade(
        self,
        symbol: str,
        name: str,
        entry_price: float,
        target_1: float,
        target_2: float,
        stop_loss: float,
        strategy_label: str = "",
        strategy_detail: str = "",
        timeframe: str = ""
    ) -> Dict[str, Any]:
        """Add or update an active tracked Saudi trade."""
        record = {
            "symbol": symbol,
            "name": name,
            "entryPrice": entry_price,
            "currentPrice": entry_price,
            "target1": target_1,
            "target2": target_2,
            "stopLoss": stop_loss,
            "strategyLabel": strategy_label or "⚡ الاستراتيجية: اختراق الزخم وحجم التداول النسبي RVOL",
            "strategyDetail": strategy_detail or "متابعة مسار الصفقة النشطة ونقاط جني الأرباح ووقف الخسارة.",
            "timeframe": timeframe or "1 إلى 3 جلسات (مضاربة سريعة)",
            "lockedTime": time.strftime("%H:%M:%S", time.localtime()),
            "pnlPct": 0.0
        }
        self.active_tracked_trades[symbol] = record
        return record

    def update_tracked_trade_price(self, symbol: str, current_price: float) -> Optional[Dict[str, Any]]:
        """Update live price and evaluate target/stop triggers."""
        if symbol not in self.active_tracked_trades or current_price <= 0:
            return None

        trade = self.active_tracked_trades[symbol]
        trade["currentPrice"] = current_price
        entry = trade["entryPrice"]
        trade["pnlPct"] = round(((current_price - entry) / entry * 100), 2) if entry > 0 else 0.0

        alert_type = None
        now = time.time()

        # TP1 check
        if trade["target1"] > 0 and current_price >= trade["target1"]:
            key = f"{symbol}_tp1"
            if now - self.last_alerts.get(key, 0) > 60:
                self.last_alerts[key] = now
                alert_type = "TP1_REACHED"

        # TP2 check
        if trade["target2"] > 0 and current_price >= trade["target2"]:
            key = f"{symbol}_tp2"
            if now - self.last_alerts.get(key, 0) > 60:
                self.last_alerts[key] = now
                alert_type = "TP2_REACHED"

        # SL check
        if trade["stopLoss"] > 0 and current_price <= trade["stopLoss"]:
            key = f"{symbol}_sl"
            if now - self.last_alerts.get(key, 0) > 60:
                self.last_alerts[key] = now
                alert_type = "STOP_LOSS_HIT"

        return {
            "trade": trade,
            "alertType": alert_type
        }

saudi_engine = SaudiMarketEngine()
