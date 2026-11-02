"""
Telegram Notification Service for Sahm Trading Copilot
Supports:
1. Sending ALL recommended contracts (Top 3 Multi-Tier: ATM, OTM, ITM) or stock picks immediately.
2. Sending Real-Time Target 1, Target 2, and Stop-Loss execution alerts for monitored/executed trades.
Full HTML formatting, async & sync dispatching, deduplication, and zero-crash error handling.
"""

import os
import time
import json
import asyncio
import logging
import urllib.request
import urllib.parse
from typing import Dict, Any, List, Optional, Tuple

try:
    import aiohttp
    AIOHTTP_AVAILABLE = True
except ImportError:
    AIOHTTP_AVAILABLE = False

from config import settings
from utils.logger import setup_logger

logger = setup_logger("SahmCopilot.Telegram")

class TelegramNotifier:
    def __init__(
        self,
        bot_token: Optional[str] = None,
        chat_id: Optional[str] = None,
        enabled: Optional[bool] = None
    ):
        self.bot_token = bot_token or getattr(settings, "TELEGRAM_BOT_TOKEN", "")
        self.chat_id = str(chat_id or getattr(settings, "TELEGRAM_CHAT_ID", ""))
        self.enabled = enabled if enabled is not None else getattr(settings, "TELEGRAM_NOTIFICATIONS_ENABLED", True)

        # In-memory deduplication and rate-limiting cache
        self.last_recs_hash: str = ""
        self.last_recs_time: float = 0.0
        self.last_alert_times: Dict[Tuple[str, str], float] = {}
        self.target_hit_events: Set[Tuple[str, str]] = set()

    def clear_cache(self):
        """Reset all deduplication caches, alerts, and target hit memory."""
        self.last_recs_hash = ""
        self.last_recs_time = 0.0
        self.last_alert_times.clear()
        self.target_hit_events.clear()
        logger.info("🧹 Telegram notifier deduplication cache cleared.")

    def is_configured(self) -> bool:
        """Check if Telegram bot credentials are valid and active."""
        return bool(self.enabled and self.bot_token and self.chat_id and ":" in self.bot_token)

    def _format_time_ar(self) -> str:
        """Format current UTC/KSA time for clean display."""
        return time.strftime("%Y-%m-%d %H:%M:%S")

    # ---------------------------------------------------------
    # Core HTTP Dispatchers (Async with Sync Fallback)
    # ---------------------------------------------------------

    async def send_message_async(self, text: str, parse_mode: str = "HTML") -> bool:
        """Send message via Telegram Bot API asynchronously without blocking server loop."""
        if not self.is_configured():
            logger.debug("Telegram notifications disabled or missing credentials.")
            return False

        url = f"https://api.telegram.org/bot{self.bot_token}/sendMessage"
        payload = {
            "chat_id": self.chat_id,
            "text": text,
            "parse_mode": parse_mode,
            "disable_web_page_preview": True
        }

        # Truncate text if exceeding Telegram message length limit (4096 chars)
        if len(payload["text"]) > 4000:
            payload["text"] = payload["text"][:3990] + "\n...[مقتطع]"

        if AIOHTTP_AVAILABLE:
            try:
                timeout = aiohttp.ClientTimeout(total=8)
                async with aiohttp.ClientSession(timeout=timeout) as session:
                    async with session.post(url, json=payload) as resp:
                        if resp.status == 200:
                            logger.info("✅ Telegram notification sent successfully (async).")
                            return True
                        else:
                            resp_text = await resp.text()
                            logger.warning(f"Telegram API response error ({resp.status}): {resp_text}")
                            return False
            except Exception as e:
                logger.warning(f"Failed to send Telegram message asynchronously: {e}")

        # Fallback to sync thread executor
        return await asyncio.to_thread(self.send_message_sync, text, parse_mode)

    def send_message_sync(self, text: str, parse_mode: str = "HTML") -> bool:
        """Synchronous HTTP dispatch using standard library urllib (failsafe)."""
        if not self.is_configured():
            return False

        url = f"https://api.telegram.org/bot{self.bot_token}/sendMessage"
        data = {
            "chat_id": self.chat_id,
            "text": text[:4000],
            "parse_mode": parse_mode,
            "disable_web_page_preview": True
        }

        try:
            req_data = json.dumps(data).encode("utf-8")
            req = urllib.request.Request(
                url,
                data=req_data,
                headers={"Content-Type": "application/json"},
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=8) as resp:
                if resp.status == 200:
                    logger.info("✅ Telegram notification sent successfully (sync).")
                    return True
                else:
                    logger.warning(f"Telegram API status: {resp.status}")
                    return False
        except Exception as e:
            logger.warning(f"Failed to send Telegram message synchronously: {e}")
            return False

    def send_message(self, text: str, parse_mode: str = "HTML") -> bool:
        """Dispatch helper that automatically uses running event loop or sync execution."""
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(self.send_message_async(text, parse_mode))
            return True
        except RuntimeError:
            return self.send_message_sync(text, parse_mode)

    # ---------------------------------------------------------
    # TRIGGER 1: Send ALL Recommended Contracts Immediately
    # ---------------------------------------------------------

    async def send_recommended_contracts_alert(
        self,
        spx_result: Dict[str, Any],
        force: bool = False,
        event_type: str = "INITIAL",
        rotation_notice: Optional[str] = None
    ) -> bool:
        """
        Formats and sends Top 3 Multi-Tier Recommended SPX Contracts
        (ATM Sweet Spot, OTM Gamma Play, ITM Safe Scalp) with exact targets and stop losses.
        Strictly event-driven: ONLY sent on Initial Session Selection, Strike Rotation, or Forced Request.
        """
        if not self.is_configured() or not spx_result:
            return False

        underlying = float(spx_result.get("indexPrice", 0.0))
        change_pct = float(spx_result.get("changePercent", 0.0))
        bias = spx_result.get("bias", "CALL")
        active_tab = spx_result.get("activeTab", "CALL")
        strategy_ar = spx_result.get("strategyArabic", "Sideways Range & VWAP Scalper")
        top_calls = spx_result.get("topCalls", [])
        top_puts = spx_result.get("topPuts", [])

        # Determine active recommendations based on bias / active tab
        is_put = (bias == "PUT" or active_tab == "PUT")
        recommendations = (top_puts if is_put and top_puts else top_calls) or top_puts or top_calls

        if not recommendations:
            return False

        # Deduplication signature check (strike + entry list)
        recs_sig = f"{bias}_{len(recommendations)}_" + "_".join(
            f"{r.get('strike')}:{r.get('entry')}" for r in recommendations
        )
        now = time.time()
        if not force and event_type == "INITIAL" and recs_sig == self.last_recs_hash and (now - self.last_recs_time < 300):
            logger.debug("Skipping duplicate recommended contracts alert (sent recently).")
            return False

        self.last_recs_hash = recs_sig
        self.last_recs_time = now

        bias_icon = "🟢" if bias == "CALL" else "🔴" if bias == "PUT" else "⚡"
        bias_text = "خيار الشراء (CALLS 🟢)" if bias == "CALL" else "خيار البيع (PUTS 🔴)" if bias == "PUT" else "مضاربة سريعة (RANGE SCALP ⚡)"
        change_sign = "+" if change_pct >= 0 else ""

        header_title = "🎯 <b>توصيات عقود SPX الفورية | Sahm Copilot Pro</b>"
        if event_type == "ROTATION":
            header_title = "🔄 <b>تحديث تدوير العقود الذكي | عقود بديلة جديدة</b>"

        lines = [
            header_title,
            f"📊 <b>مؤشر SPX المباشر:</b> <code>{underlying:,.2f}</code> ({change_sign}{change_pct:.2f}%)",
            f"📌 <b>الاتجاه والنمط:</b> <b>{bias_text}</b>",
            f"⚙️ <b>الاستراتيجية:</b> {strategy_ar}",
            f"⏰ <b>التوقيت:</b> <code>{self._format_time_ar()}</code>",
            "━━━━━━━━━━━━━━━━━━━━"
        ]

        if rotation_notice:
            lines.append(f"ℹ️ <b>تنويه التدوير:</b> {rotation_notice}\n────────────────────")

        for i, c in enumerate(recommendations, 1):
            tier_badge = c.get("tierBadge") or ("🏆 العقد الذهبي (ATM)" if i == 1 else "🚀 عقد الانفجار السعري (OTM)" if i == 2 else "🛡️ العقد الدفاعي (ITM)")
            strike = c.get("strike")
            c_type = c.get("type", "CALL")
            entry = c.get("entry", 0.0)
            bid = c.get("bid", 0.0)
            ask = c.get("ask", 0.0)
            tp1 = c.get("tp1", 0.0)
            tp2 = c.get("tp2", 0.0)
            sl = c.get("sl", 0.0)
            tp1_pct = c.get("tp1_pct", "+12%")
            tp2_pct = c.get("tp2_pct", "+22%")
            sl_pct = c.get("sl_pct", "-12%")
            delta = c.get("delta", "--")
            spread = c.get("spread", 0.0)
            volume = c.get("volume", 0)
            oi = c.get("openInterest", 0)
            reason = c.get("reason", "عقد متوافق كمياً مع تدفق السيولة والزخم اللحظي.")
            rotated_label = " <i>[عقد بديل جديد]</i>" if c.get("isRotatedAlternative") else ""

            lines.extend([
                f"<b>{tier_badge}</b>{rotated_label}",
                f"🔹 <b>العقد:</b> <code>Strike {strike} {c_type}</code> ({c.get('timeframe', '0DTE')})",
                f"💵 <b>سعر الدخول المقترح:</b> <code>${entry:.2f}</code> <i>(طلب: ${bid:.2f} | عرض: ${ask:.2f})</i>",
                f"🎯 <b>الهدف 1:</b> <code>${tp1:.2f}</code> ({tp1_pct})",
                f"🎯 <b>الهدف 2:</b> <code>${tp2:.2f}</code> ({tp2_pct})",
                f"🛑 <b>وقف الخسارة:</b> <code>${sl:.2f}</code> ({sl_pct})",
                f"⚡ <b>الدلتا:</b> <code>{delta}</code> | <b>السبريد:</b> <code>${spread:.2f}</code>",
                f"📊 <b>الحجم:</b> {volume:,} | <b>المراكز:</b> {oi:,}",
                f"💡 <i>{reason}</i>",
                "────────────────────"
            ])

        lines.extend([
            "⚠️ <i>ملاحظة: الالتزام الصارم بوقف الخسارة وجني الأرباح الجزئي عند الهدف 1 هو مفتاح الاستدامة.</i>"
        ])

        message = "\n".join(lines)
        return await self.send_message_async(message)

    async def send_target_hit_status_alert(
        self,
        strike: int,
        contract_type: str,
        hit_target: str,
        current_price: float,
        initial_entry: float,
        is_safe_reentry: bool,
        delta: Any = "--",
        spread: float = 0.0,
        fresh_entry: Optional[float] = None,
        fresh_tp1: Optional[float] = None,
        fresh_tp2: Optional[float] = None,
        fresh_sl: Optional[float] = None,
        reason: str = ""
    ) -> bool:
        """
        Dispatched ONCE when a recommended or tracked contract reaches Target 1 (TP1) or Target 2 (TP2).
        Includes the Re-Entry Safety & Momentum Check result:
        - Case A: Safe for Re-Entry with fresh stepped-up levels.
        - Case B: Dangerous to Chase / Exhausted, rotating out.
        """
        if not self.is_configured():
            return False

        cache_key = (f"{strike}_{contract_type}", str(hit_target))
        if cache_key in self.target_hit_events:
            return False
        self.target_hit_events.add(cache_key)

        pnl = round(((current_price - initial_entry) / initial_entry) * 100, 1) if initial_entry > 0 else 0.0
        pnl_str = f"+{pnl}%" if pnl >= 0 else f"{pnl}%"
        delta_str = f"{delta:+.3f}" if isinstance(delta, (int, float)) else str(delta)

        if is_safe_reentry:
            lines = [
                f"🎉 <b>[تحقق الهدف {hit_target} لصفقة Strike {strike} {contract_type}]</b>",
                "━━━━━━━━━━━━━━━━━━━━",
                f"📈 <b>العقد:</b> <code>Strike {strike} {contract_type}</code>",
                f"💵 <b>سعر الدخول السابق:</b> <code>${initial_entry:.2f}</code> ➔ <b>السعر المباشر:</b> <code>${current_price:.2f}</code> (🟢 <b>{pnl_str}</b>)",
                f"⚡ <b>الدلتا:</b> <code>{delta_str}</code> | <b>السبريد:</b> <code>${spread:.2f}</code>",
                "━━━━━━━━━━━━━━━━━━━━",
                "🔄 <b>حالة الدخول مجدداً:</b> <b>✅ متاح وآمن للدخول مجدداً — استمرار الزخم والانضباط الكمي</b>",
                f"💵 <b>سعر الدخول المحدث:</b> <code>${(fresh_entry or current_price):.2f}</code>",
                f"🎯 <b>الهدف 1 الجديد:</b> <code>${(fresh_tp1 or current_price * 1.12):.2f}</code> | 🎯 <b>الهدف 2 الجديد:</b> <code>${(fresh_tp2 or current_price * 1.22):.2f}</code>",
                f"🛑 <b>الوقف المتحرك المشدد:</b> <code>${(fresh_sl or current_price * 0.92):.2f}</code>",
                f"💡 <i>{reason or 'الزخم مستمر والسبريد ضيق؛ الدخول متاح بإدارة مخاطر مشددة.'}</i>",
                f"⏰ <b>التوقيت:</b> <code>{self._format_time_ar()}</code>",
                "━━━━━━━━━━━━━━━━━━━━"
            ]
        else:
            lines = [
                f"🏆 <b>[تحقق الهدف {hit_target} لصفقة Strike {strike} {contract_type}]</b>",
                "━━━━━━━━━━━━━━━━━━━━",
                f"📈 <b>العقد:</b> <code>Strike {strike} {contract_type}</code>",
                f"💵 <b>سعر الدخول:</b> <code>${initial_entry:.2f}</code> ➔ <b>السعر الحالي:</b> <code>${current_price:.2f}</code> (🔥 <b>{pnl_str}</b>)",
                f"⚡ <b>الدلتا:</b> <code>{delta_str}</code> | <b>السبريد:</b> <code>${spread:.2f}</code>",
                "━━━━━━━━━━━━━━━━━━━━",
                "⛔ <b>حالة الدخول:</b> <b>خطر الدخول مجدداً — تشبع سعري وتآكل دلتا / جاري البحث التلقائي عن عقد بديل 🔄</b>",
                "⚠️ <b>توجيه النظام:</b> ممنوع مطاردة العقد، تم استبعاده وتدوير التوصية تلقائياً إلى عقد بديل أقرب لمنطقة الزخم المثلى.",
                f"💡 <i>{reason or 'السعر تشبع وتجاوز الهدف؛ المطاردة تعرض رأس المال لمخاطر تصحيح حادة.'}</i>",
                f"⏰ <b>التوقيت:</b> <code>{self._format_time_ar()}</code>",
                "━━━━━━━━━━━━━━━━━━━━"
            ]

        message = "\n".join(lines)
        return await self.send_message_async(message)

    async def send_rotation_alert(
        self,
        completed_strike: int,
        completed_type: str,
        hit_target: str,
        new_contract: Dict[str, Any],
        reason: str = ""
    ) -> bool:
        """
        Dispatched immediately when exhausted contracts are rotated out for fresh ones.
        """
        if not self.is_configured():
            return False

        lines = [
            f"🔄 <b>[تدوير العقود الذكي | بعد تحقق أهداف Strike {completed_strike} {completed_type}]</b>",
            "━━━━━━━━━━━━━━━━━━━━",
            f"✅ <b>العقد السابق:</b> <code>Strike {completed_strike} {completed_type}</code> حقق كامل أهدافه بنجاح ({hit_target}) وتم استبعاده للتشبع السعري.",
            f"🆕 <b>العقد البديل الجديد:</b> <code>Strike {new_contract.get('strike')} {new_contract.get('type')}</code> ({new_contract.get('tierBadge', 'العقد البديل')})",
            f"💵 <b>سعر الدخول المقترح:</b> <code>${new_contract.get('entry', 0):.2f}</code> <i>(طلب: ${new_contract.get('bid', 0):.2f} | عرض: ${new_contract.get('ask', 0):.2f})</i>",
            f"🎯 <b>الهدف 1:</b> <code>${new_contract.get('tp1', 0):.2f}</code> ({new_contract.get('tp1_pct', '+12%')})",
            f"🎯 <b>الهدف 2:</b> <code>${new_contract.get('tp2', 0):.2f}</code> ({new_contract.get('tp2_pct', '+22%')})",
            f"🛑 <b>وقف الخسارة:</b> <code>${new_contract.get('sl', 0):.2f}</code> ({new_contract.get('sl_pct', '-12%')})",
            f"⚡ <b>الدلتا:</b> <code>{new_contract.get('delta', '--')}</code> | <b>السبريد:</b> <code>${new_contract.get('spread', 0):.2f}</code>",
            f"📊 <b>الحجم:</b> {new_contract.get('volume', 0):,} | <b>المراكز:</b> {new_contract.get('openInterest', 0):,}",
            f"💡 <i>{reason or new_contract.get('reason', 'عقد طازج يتمتع بسبريد ضيق ودلتا متزنة لتجنب تآكل الثيتا.')}</i>",
            f"⏰ <b>التوقيت:</b> <code>{self._format_time_ar()}</code>",
            "━━━━━━━━━━━━━━━━━━━━"
        ]

        message = "\n".join(lines)
        return await self.send_message_async(message)

    async def send_stock_recommendations_alert(
        self,
        opportunities: List[Dict[str, Any]],
        market: str = "SA",
        force: bool = False
    ) -> bool:
        """
        Formats and sends recommended stock opportunities (e.g. Saudi market scanner picks)
        with target levels and stop losses to Telegram.
        """
        if not self.is_configured() or not opportunities:
            return False

        now = time.time()
        recs_sig = f"STOCKS_{market}_" + "_".join(f"{o.get('symbol')}:{o.get('entry')}" for o in opportunities[:5])
        if not force and recs_sig == self.last_recs_hash and (now - self.last_recs_time < 300):
            return False

        self.last_recs_hash = recs_sig
        self.last_recs_time = now

        currency = "ر.س" if market == "SA" else "$"
        market_name = "السوق السعودي (TASI)" if market == "SA" else "السوق الأمريكي (US Stocks)"

        lines = [
            f"📈 <b>توصيات الأسهم المقترحة | {market_name}</b>",
            f"⏰ <b>التوقيت:</b> <code>{self._format_time_ar()}</code>",
            "━━━━━━━━━━━━━━━━━━━━"
        ]

        for opp in opportunities[:4]:
            symbol = opp.get("symbol")
            name = opp.get("name", "")
            direction = "شراء صاعد 🟢" if opp.get("type") == "BULLISH" else "تحوط/بيع 🔴"
            entry = opp.get("entry", 0.0)
            tp1 = opp.get("tp1", 0.0)
            tp2 = opp.get("tp2", 0.0)
            sl = opp.get("sl", 0.0)
            rr = opp.get("rr", "1:2.0")
            strat = opp.get("strategyLabel", opp.get("timeframe", "جلسة 1-3"))
            reason = opp.get("reason", "اختراق مدعوم بالسيولة اللحظية.")

            lines.extend([
                f"🏷️ <b>{symbol} - {name}</b> ({direction})",
                f"📌 <b>النمط:</b> {strat} | <b>نسبة R:R:</b> <code>{rr}</code>",
                f"💵 <b>سعر الدخول:</b> <code>{entry} {currency}</code>",
                f"🎯 <b>الهدف 1:</b> <code>{tp1} {currency}</code> | 🎯 <b>الهدف 2:</b> <code>{tp2} {currency}</code>",
                f"🛑 <b>وقف الخسارة:</b> <code>{sl} {currency}</code>",
                f"💡 <i>{reason}</i>",
                "────────────────────"
            ])

        message = "\n".join(lines)
        return await self.send_message_async(message)

    # ---------------------------------------------------------
    # TRIGGER 2: Send Target/Stop-Loss Execution Alerts
    # ---------------------------------------------------------

    async def send_trade_execution_alert(
        self,
        trade_id: str,
        alert_type: str,
        symbol: str,
        locked_entry: float,
        current_price: float,
        target_1: float,
        target_2: float,
        stop_loss: float,
        pnl_pct: Optional[float] = None,
        notes: str = ""
    ) -> bool:
        """
        Immediately dispatches high-priority Telegram alerts when an executed/tracked trade:
        - Hits Target 1 (TP1)
        - Hits Target 2 (TP2)
        - Breaches Stop Loss (SL)
        - Approached SL within 3%
        - Or newly locked in
        """
        if not self.is_configured():
            return False

        # Throttling duplicate alerts for the same trade within 45 seconds
        now = time.time()
        cache_key = (str(trade_id), str(alert_type))
        last_sent = self.last_alert_times.get(cache_key, 0.0)
        if now - last_sent < 45:
            logger.debug(f"Throttling duplicate trade alert: {cache_key}")
            return False

        self.last_alert_times[cache_key] = now

        if pnl_pct is None and locked_entry > 0:
            pnl_pct = round(((current_price - locked_entry) / locked_entry) * 100, 2)
        pnl_pct = pnl_pct or 0.0
        pnl_sign = "+" if pnl_pct >= 0 else ""

        alert_type_upper = alert_type.upper()

        if alert_type_upper in ["TP1_REACHED", "TARGET_1", "TP1"]:
            header = "🎉 <b>[تحقق الهدف الأول - Take Profit 1 🎯]</b>"
            status_desc = f"نجاح الصفقة ووصول السعر إلى الهدف الأول المحدد <code>${target_1:.2f}</code>!"
            action_desc = "🛡️ <b>توصية النظام:</b> جني أرباح جزئي وتأمين الصفقة برفع الوقف لنقطة الدخول (Breakeven)."
            color_emoji = "🟢"

        elif alert_type_upper in ["TP2_REACHED", "TARGET_2", "TP2"]:
            header = "🏆 <b>[تحقق الهدف الثاني بالكامل - Take Profit 2 🚀]</b>"
            status_desc = f"الصفقة حققت أقصى أهدافها ووصلت للهدف 2 <code>${target_2:.2f}</code> بنجاح باهر!"
            action_desc = "✨ <b>توصية النظام:</b> إغلاق كامل المركز وجني كافة الأرباح المحققة."
            color_emoji = "🔥"

        elif alert_type_upper in ["STOP_BREACH", "STOP_LOSS", "SL_HIT"]:
            header = "🚨 <b>[تنبيه كسر وقف الخسارة الصارم - Stop Loss 🛑]</b>"
            status_desc = f"تجاوز السعر مستوى وقف الخسارة المحدد <code>${stop_loss:.2f}</code>."
            action_desc = "⚠️ <b>الإجراء المطلوب:</b> الخروج الفوري الصارم لمنع تفاقم الخسائر وحماية رأس المال."
            color_emoji = "🔴"

        elif alert_type_upper in ["SL_PROXIMITY", "SL_WARNING"]:
            header = "⚠️ <b>[اقتراب حرج من وقف الخسارة (< 3%) ⚠️]</b>"
            status_desc = f"السعر يقترب بمسافة أقل من 3% من مستوى الوقف <code>${stop_loss:.2f}</code>."
            action_desc = "👀 <b>المطلوب:</b> المراقبة اللحظية والاستعداد للخروج الفوري إذا كُسر الوقف."
            color_emoji = "🟡"

        elif alert_type_upper in ["TRADE_LOCKED", "TRADE_EXECUTED", "EXECUTION"]:
            header = "🎯 <b>[تم تأكيد تنفيذ وتثبيت صفقة جديدة 🔒]</b>"
            status_desc = "تم قفل سعر الدخول بنجاح وتفعيل الرادار اللحظي لمراقبة الأهداف ووقف الخسارة."
            action_desc = "📡 <b>المتابعة:</b> سيصلك إشعار فوري عند ملامسة الهدف 1 أو 2 أو الوقف."
            color_emoji = "⚡"

        else:
            header = f"🔔 <b>[تنبيه متابعة الصفقة: {alert_type}]</b>"
            status_desc = f"تحديث لحظي لصفقة <code>{symbol}</code>."
            action_desc = ""
            color_emoji = "ℹ️"

        lines = [
            header,
            f"━━━━━━━━━━━━━━━━━━━━",
            f"📈 <b>الصفقة:</b> <code>{symbol}</code>",
            f"🔒 <b>سعر الدخول المقفل (ثابت):</b> <code>${locked_entry:.2f}</code>",
            f"📊 <b>السعر المباشر اللحظي:</b> <code>${current_price:.2f}</code> ({color_emoji} <b>{pnl_sign}{pnl_pct:.2f}%</b>)",
            f"🎯 <b>الهدف 1:</b> <code>${target_1:.2f}</code> | 🎯 <b>الهدف 2:</b> <code>${target_2:.2f}</code>",
            f"🛑 <b>وقف الخسارة:</b> <code>${stop_loss:.2f}</code>",
            f"📝 {status_desc}",
        ]

        if action_desc:
            lines.append(action_desc)
        if notes:
            lines.append(f"💡 <i>{notes}</i>")

        lines.extend([
            f"⏰ <b>التوقيت:</b> <code>{self._format_time_ar()}</code>",
            "━━━━━━━━━━━━━━━━━━━━"
        ])

        message = "\n".join(lines)
        return await self.send_message_async(message)


# Singleton Instance
telegram_notifier = TelegramNotifier()
