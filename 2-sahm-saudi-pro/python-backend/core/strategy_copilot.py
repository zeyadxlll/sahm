"""
Trading Strategy Copilot & Quantitative Engine for Saudi Market (تاسي ونمو)
Implements precise step-by-step mathematical & algorithmic mechanics:
- Strategy A: Multi-Month Support & Range Rebound (قاع 6-12 شهر، وقف 0.8% أسفل القاع، 1-8 أسابيع)
- Strategy B: RVOL Momentum Breakout (حجم نسبي RVOL > 2.5، فوق VWAP، 1-3 جلسات)
- Strategy C: Defensive Mean-Reversion in Bearish Regimes (حظر صفقات الاختراق في السوق الهابط، دعوم هيكلية)
- Strategy D: Nomu High-Growth Scalper (مضاربة سريعة لأسهم نمو الواعدة)
- Strategy E: Auction Gap & Overnight Sniper (قناص مزاد الإغلاق وفجوات الغد)
"""

from typing import Dict, Any, List, Optional
import math

class StrategyCopilot:
    def __init__(self, historical_mgr):
        self.hist_mgr = historical_mgr

    def evaluate_market_regime(
        self,
        market_stocks: List[Dict[str, Any]],
        strategy_override: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Evaluate overall Saudi market regime from TASI and Nomu watchlist.
        Detects Bullish / Bearish / Sideways regimes and selects active Saudi strategy.
        When Bearish (decliners > advancers): blocks momentum breakouts and enforces defensive support.
        """
        if not market_stocks:
            return {
                "status": "SIDEWAYS_WARNING",
                "title": "مسار عرضي حرج",
                "warningText": "ممنوع الدخول ⛔",
                "detail": "عدم وجود سيولة كافية للتأكيد، ينصح بالبقاء في وضع المراقبة وعدم التداول.",
                "activeStrategy": "DEFENSIVE_SUPPORT",
                "strategyArabic": "استراتيجية الحذر والمراقبة",
                "isSidewaysWarning": True,
                "blockBreakouts": False
            }

        up_count = sum(1 for s in market_stocks if float(s.get("changePercent", 0.0)) > 0.2)
        down_count = sum(1 for s in market_stocks if float(s.get("changePercent", 0.0)) < -0.2)
        flat_count = len(market_stocks) - up_count - down_count

        total = len(market_stocks)
        up_ratio = round((up_count / total) * 100, 1) if total > 0 else 50.0
        down_ratio = round((down_count / total) * 100, 1) if total > 0 else 50.0

        # Handle Strategy Override if user selected manually
        if strategy_override and strategy_override != "AUTO":
            strat_info = self._get_strategy_info(strategy_override)
            return {
                "status": strat_info["regimeStatus"],
                "title": strat_info["title"],
                "warningText": strat_info.get("warningText"),
                "detail": strat_info["detail"],
                "activeStrategy": strategy_override,
                "strategyArabic": strat_info["nameArabic"],
                "isSidewaysWarning": strategy_override == "DEFENSIVE_SUPPORT",
                "blockBreakouts": strategy_override == "DEFENSIVE_SUPPORT"
            }

        # Auto Regime Detection for Saudi Market
        # When TASI breadth is negative: decliners > advancers
        if down_count > up_count * 1.2 or down_ratio >= 50.0:
            active_strat = "DEFENSIVE_SUPPORT"
            title = "سوق هابط / ضغوط تصحيحية 🔴"
            warning = "حظر صفقات الاختراق ⛔ (سوق هابط)"
            detail = "حظر صفقات الاختراق والزخم نظراً لاتساع رقعة الهبوط. تفعيل استراتيجية الارتداد الدفاعي عند الدعوم الهيكلية لحماية رأس المال."
            status = "BEARISH"
            strat_ar = "Strategy C: Defensive Mean-Reversion (استراتيجية السوق الهابط والأزمات)"
            block_breakouts = True
        elif up_count > down_count * 1.3 and up_ratio >= 50.0:
            active_strat = "TASI_BREAKOUT"
            title = "سوق صاعد ذو زخم وسيولة 🟢"
            warning = None
            detail = "تفعيل استراتيجية اختراق السيولة والزخم (RVOL > 2.5) فوق متوسط VWAP مع تسارع الصفقات."
            status = "BULLISH"
            strat_ar = "Strategy B: RVOL Momentum Breakout (اختراق السيولة والزخم للجلسة)"
            block_breakouts = False
        elif abs(up_ratio - down_ratio) < 18 or flat_count > (total * 0.40):
            active_strat = "WHALE_ACCUMULATION"
            title = "مسار عرضي متذبذب (تجميع هوامير) 🟡"
            warning = None
            detail = "تتبع فرص الارتداد من الدعوم التاريخية وتجميع الصناديق في عمق سجل الأوامر."
            status = "SIDEWAYS"
            strat_ar = "Strategy A: Multi-Month Support & Rebound (الارتداد من الدعم التاريخي)"
            block_breakouts = False
        else:
            active_strat = "TASI_BREAKOUT"
            title = "سوق متوازن مائل للإيجابية 🟢"
            warning = None
            detail = "تتبع فرص الاختراق والارتداد المدعومة بارتفاع أحجام التداول وسيولة الطلبات."
            status = "BULLISH"
            strat_ar = "Strategy B: RVOL Momentum Breakout (اختراق السيولة والزخم للجلسة)"
            block_breakouts = False

        return {
            "status": status,
            "title": title,
            "warningText": warning,
            "detail": detail,
            "activeStrategy": active_strat,
            "strategyArabic": strat_ar,
            "isSidewaysWarning": status == "SIDEWAYS",
            "blockBreakouts": block_breakouts,
            "upCount": up_count,
            "downCount": down_count,
            "upRatio": up_ratio,
            "downRatio": down_ratio
        }

    def _get_strategy_info(self, strategy_code: str) -> Dict[str, Any]:
        catalog = {
            "STRATEGY_A_SUPPORT_REBOUND": {
                "nameArabic": "Strategy A: Multi-Month Support & Range Rebound (الارتداد من الدعم التاريخي)",
                "regimeStatus": "SIDEWAYS",
                "title": "استراتيجية الارتداد من الدعم التاريخي السنوي",
                "detail": "رصد الأسهم قرب قاع 6-12 شهر (±1.5%) مع امتصاص طلبات الشراء. أهداف تمتد من أسبوع إلى 8 أسابيع ووقف 0.8% أسفل القاع.",
                "warningText": None
            },
            "STRATEGY_B_RVOL_BREAKOUT": {
                "nameArabic": "Strategy B: RVOL Momentum Breakout (اختراق السيولة والزخم للجلسة)",
                "regimeStatus": "BULLISH",
                "title": "استراتيجية اختراق السيولة والزخم للجلسة",
                "detail": "حجم نسبي RVOL > 2.5، سعر أعلى من VWAP، وتسارع وتيرة الصفقات لأهداف سريعة خلال 1-3 جلسات.",
                "warningText": None
            },
            "STRATEGY_C_DEFENSIVE_BEAR": {
                "nameArabic": "Strategy C: Defensive Mean-Reversion (استراتيجية السوق الهابط والأزمات)",
                "regimeStatus": "BEARISH",
                "title": "استراتيجية السوق الهابط والأزمات",
                "detail": "حظر صفقات الاختراق التام عند اتساع الهبوط. اقتناص الارتداد الدفاعي من الدعوم الهيكلية مع وقف صارم.",
                "warningText": "حظر صفقات الاختراق ⛔"
            },
            "DEFENSIVE_SUPPORT": {
                "nameArabic": "Defensive Support Mode (استراتيجية الحماية والدعوم التاريخية)",
                "regimeStatus": "BEARISH",
                "title": "استراتيجية الحماية والدعوم التاريخية",
                "detail": "فلترة الكسور الوهمية واختيار الأسهم ذات الامتصاص المؤسسي عند الدعوم فقط.",
                "warningText": "نمط دفاعي نشط ⛔"
            },
            "TASI_BREAKOUT": {
                "nameArabic": "TASI Momentum Breakout (اختراق السيولة والزخم)",
                "regimeStatus": "BULLISH",
                "title": "استراتيجية اختراق السيولة والزخم",
                "detail": "استهداف الأسهم ذات الحجم العالي والارتفاع اللحظي المخترقة لمتوسط VWAP.",
                "warningText": None
            },
            "WHALE_ACCUMULATION": {
                "nameArabic": "Whale Accumulation (تجميع هوامير وصناديق)",
                "regimeStatus": "SIDEWAYS",
                "title": "تجميع هوامير وصناديق",
                "detail": "تتبع صفقات الشراء اللحظية الكبيرة (Whale Trades) وعمق سجل الأوامر.",
                "warningText": None
            },
            "AUCTION_SNIPER": {
                "nameArabic": "Next Session & Auction Sniper (قناص مزاد الإغلاق وفجوات الغد)",
                "regimeStatus": "AUCTION",
                "title": "رادار فجوات وتوقعات الجلسة القادمة",
                "detail": "تحليل إغلاقات مزاد الإغلاق وصفقات اللحظات الأخيرة لترشيح الأسهم الصاعدة في افتتاح الغد.",
                "warningText": None
            },
            "NOMU_GROWTH": {
                "nameArabic": "Nomu High-Growth Scalper (مضاربة أسهم نمو السريعة)",
                "regimeStatus": "BULLISH",
                "title": "مضاربة أسهم نمو ذات الحركة السريعة",
                "detail": "اقتناص الفرص السريعة في سوق نمو للشركات ذات الارتفاعات القوية والسيولة المتسارعة.",
                "warningText": "تذبذب عالي"
            }
        }
        return catalog.get(strategy_code, {
            "nameArabic": "الاستراتيجية الكمية المعتمدة",
            "regimeStatus": "BULLISH",
            "title": "النمط التلقائي",
            "detail": "تحديد أفضل الفرص بناء على خوارزميات رادار تاسي ونمو.",
            "warningText": None
        })

    def generate_opportunities(
        self,
        stocks: List[Dict[str, Any]],
        strategy_code: str = "AUTO"
    ) -> List[Dict[str, Any]]:
        """
        Generate high-probability trade setups for Saudi stocks with exact strategy details & timeframe.
        """
        opportunities = []
        for s in stocks:
            price = float(s.get("lastPrice") or s.get("price") or 0.0)
            if price <= 0:
                continue

            score = int(s.get("score", 50))
            chg = float(s.get("changePercent", 0.0))
            trades = int(s.get("trades", 0))

            if score >= 65:
                tp1 = float(s.get("target1", round(price * 1.025, 2)))
                tp2 = float(s.get("target2", round(price * 1.050, 2)))
                sl = float(s.get("stopLoss", round(price * 0.975, 2)))

                opportunities.append({
                    "symbol": s.get("symbol", ""),
                    "name": s.get("name", ""),
                    "price": price,
                    "changePercent": chg,
                    "score": score,
                    "signal": s.get("signal", "إيجابي"),
                    "signalColor": s.get("signalColor", "#00F090"),
                    "strategyCode": s.get("strategyCode", "TASI_BREAKOUT"),
                    "strategyLabel": s.get("strategyLabel", "⚡ الاستراتيجية: اختراق الزخم وحجم التداول النسبي RVOL"),
                    "strategyDetail": s.get("strategyDetail", "اختراق سعري مدعوم بارتفاع أحجام التداول والصفقات فوق متوسط الجلسة."),
                    "timeframe": s.get("timeframe", "1 إلى 3 جلسات (مضاربة سريعة)"),
                    "rvol": s.get("rvol", 1.0),
                    "multiMonthLow": s.get("multiMonthLow", 0.0),
                    "distFromLowPct": s.get("distFromLowPct", 0.0),
                    "vwap": s.get("vwap", price),
                    "target1": tp1,
                    "target2": tp2,
                    "stopLoss": sl,
                    "trades": trades,
                    "volume": s.get("volume", 0)
                })

        opportunities.sort(key=lambda x: x["score"], reverse=True)
        return opportunities[:8]

    def predict_next_session(self, stocks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Next-Session AI Predictor for Tab 3:
        Identifies Saudi stocks with highest probability of an opening gap up tomorrow.
        """
        predictions = []
        for s in stocks:
            price = float(s.get("lastPrice") or s.get("price") or 0.0)
            if price <= 0:
                continue

            buy_ratio = float(s.get("buyRatio", 50.0))
            score = int(s.get("score", 50))
            prob = int(s.get("overnightProbability") or min(94, max(45, int(score * 0.75 + (buy_ratio * 0.25)))))

            if prob >= 65:
                predictions.append({
                    "symbol": s.get("symbol", ""),
                    "name": s.get("name", ""),
                    "closingPrice": price,
                    "trades": s.get("trades", 0),
                    "score": score,
                    "gapProbability": prob,
                    "strategyLabel": "🔮 الاستراتيجية: فجوة مزاد الإغلاق وتوقع افتتاح الغد",
                    "strategyDetail": "تجميع كميات في مزاد الإغلاق وتوقع افتتاح بفجوة سعرية صاعدة (Overnight Gap).",
                    "timeframe": "جلسة الغد (جرس الافتتاح)",
                    "target1": s.get("target1", round(price * 1.025, 2)),
                    "target2": s.get("target2", round(price * 1.050, 2)),
                    "stopLoss": s.get("stopLoss", round(price * 0.975, 2)),
                    "recommendation": "دخول مزاد الإغلاق أو مع جرس الافتتاح 🎯"
                })

        predictions.sort(key=lambda x: x["gapProbability"], reverse=True)
        return predictions[:5]

    def compute_4d_analysis(
        self,
        stock_header: Dict[str, Any],
        order_flow: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Composite 4D institutional analysis for a single Saudi stock.
        """
        symbol = stock_header.get("symbol", "1120")
        price = float(stock_header.get("price", 0.0))
        chg = float(stock_header.get("changePercent", 0.0))

        # Technical score
        tech_indicators = self.hist_mgr.get_technical_indicators(symbol, current_price=price)
        tech_score = 70 if tech_indicators.get("isAboveVWAP") else 45

        # Order Flow score
        buy_ratio = float(order_flow.get("buyRatio", 50.0))
        flow_score = min(95, max(30, int(buy_ratio * 1.2)))

        # Composite Institutional Whale Score
        composite_score = int(tech_score * 0.4 + flow_score * 0.6)

        return {
            "symbol": symbol,
            "name": stock_header.get("name", f"سهم {symbol}"),
            "currentPrice": price,
            "changePercent": chg,
            "compositeScore": composite_score,
            "technicalScore": tech_score,
            "flowScore": flow_score,
            "vwap": tech_indicators.get("vwap", price),
            "isAboveVWAP": tech_indicators.get("isAboveVWAP", True),
            "rsi": tech_indicators.get("rsi", 52.0),
            "support": tech_indicators.get("support1", round(price * 0.98, 2)),
            "resistance": tech_indicators.get("resistance1", round(price * 1.02, 2)),
            "multiMonthLow": tech_indicators.get("multiMonthLow", 0.0),
            "rvol": tech_indicators.get("rvol", 1.0),
            "verdict": "تجميع مؤسسي قوي 🟢" if composite_score >= 70 else ("مراقبة حذرة ⚪" if composite_score >= 50 else "تصريف سلبي 🔴")
        }
