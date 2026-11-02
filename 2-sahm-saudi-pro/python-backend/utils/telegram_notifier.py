"""
Telegram Notification Service for Sahm Saudi Pro (تاسي ونمو)
Supports:
1. Sending Saudi Stock Recommendations (Top Breakouts & Whale Accumulation).
2. Sending Real-Time Target 1, Target 2, and Stop-Loss execution alerts for active tracked trades.
Full HTML formatting, async & sync dispatching, deduplication, and zero-crash error handling.
"""

import os
import time
import json
import asyncio
import logging
import urllib.request
import urllib.parse
from typing import Dict, Any, List, Optional, Tuple, Set

try:
    import aiohttp
    AIOHTTP_AVAILABLE = True
except ImportError:
    AIOHTTP_AVAILABLE = False

from config import settings
from utils.logger import setup_logger

logger = setup_logger("SahmSaudiPro.Telegram")

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
        """Format current time for clean display."""
        return time.strftime("%Y-%m-%d %H:%M:%S")

    # ---------------------------------------------------------
    # Core HTTP Dispatchers (Async with Sync Fallback)
    # ---------------------------------------------------------

    async def send_message_async(self, text: str, parse_mode: str = "HTML") -> bool:
        """Send message via Telegram Bot API asynchronously."""
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
        """Synchronous fallback to dispatch message via urllib."""
        if not self.is_configured():
            return False

        url = f"https://api.telegram.org/bot{self.bot_token}/sendMessage"
        payload = {
            "chat_id": self.chat_id,
            "text": text,
            "parse_mode": parse_mode,
            "disable_web_page_preview": True
        }

        try:
            data = json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(
                url,
                data=data,
                headers={"Content-Type": "application/json"}
            )
            with urllib.request.urlopen(req, timeout=8) as resp:
                if resp.status == 200:
                    logger.info("✅ Telegram notification sent successfully (sync).")
                    return True
                return False
        except Exception as e:
            logger.error(f"Failed to send Telegram message synchronously: {e}")
            return False

    # ---------------------------------------------------------
    # Saudi Stock Breakout Recommendations Alert
    # ---------------------------------------------------------

    async def send_saudi_recommendations_alert(
        self,
        stocks: List[Dict[str, Any]],
        summary: Optional[Dict[str, Any]] = None,
        force: bool = False
    ) -> bool:
        """
        Formats and sends Top 3 Saudi Stock Breakout & Whale Accumulation Recommendations.
        """
        if not self.is_configured() or not stocks:
            return False

        now = time.time()
        top_stocks = stocks[:3]
        symbols_key = "_".join(str(s.get("symbol")) for s in top_stocks)

        if not force:
            if symbols_key == self.last_recs_hash and (now - self.last_recs_time < 300):
                logger.debug("Deduplicated: Saudi stock recommendations sent recently.")
                return False

        self.last_recs_hash = symbols_key
        self.last_recs_time = now

        tasi_price = "--"
        tasi_chg = "0.00%"
        if summary and summary.get("tasi"):
            tp = summary["tasi"].get("price", 0)
            tc = summary["tasi"].get("changePercent", 0)
            if tp:
                tasi_price = f"{tp:,.2f}"
            tasi_chg = f"{'+' if tc >= 0 else ''}{tc:.2f}%"

        lines = [
            "🎯 <b>توصيات السوق السعودي الفورية | Sahm Saudi Pro</b>",
            f"📊 <b>مؤشر تاسي:</b> <code>{tasi_price}</code> ({tasi_chg})",
            f"🕒 <b>التوقيت:</b> <code>{self._format_time_ar()}</code>",
            "────────────────────────"
        ]

        for idx, s in enumerate(top_stocks, start=1):
            sym = s.get("symbol", "")
            name = s.get("name", "")
            price = float(s.get("lastPrice") or s.get("price") or 0.0)
            chg = float(s.get("changePercent", 0.0))
            chg_sign = "+" if chg >= 0 else ""
            score = s.get("score", 85)
            signal = s.get("signal", "زخم اختراق 🚀")
            tp1 = s.get("target1", round(price * 1.025, 2))
            tp2 = s.get("target2", round(price * 1.05, 2))
            sl = s.get("stopLoss", round(price * 0.975, 2))
            trades = s.get("trades", 0)

            strategy_lbl = s.get("strategyLabel") or "⚡ الاستراتيجية: اختراق الزخم وحجم التداول النسبي RVOL"
            timeframe = s.get("timeframe") or "1 إلى 3 جلسات (مضاربة سريعة)"
            lines.append(f"<b>{idx}. {sym} - {name}</b> ({signal})")
            lines.append(f"   🔬 <b>{strategy_lbl}</b>")
            lines.append(f"   ⏱️ <b>المدى الزمني:</b> <code>{timeframe}</code>")
            lines.append(f"   💵 <b>السعر اللحظي:</b> <code>{price:.2f} ر.س</code> ({chg_sign}{chg:.2f}%)")
            lines.append(f"   🎯 <b>الهدف الأول (TP1):</b> <code>{tp1:.2f} ر.س</code>")
            lines.append(f"   🎯 <b>الهدف الثاني (TP2):</b> <code>{tp2:.2f} ر.س</code>")
            lines.append(f"   🛡️ <b>وقف الخسارة (SL):</b> <code>{sl:.2f} ر.س</code>")
            lines.append(f"   🔥 <b>نقاط الزخم:</b> <code>{score}/100</code> | صفقات: <code>{trades}</code>")
            lines.append("────────────────────────")

        lines.append("⚠️ <i>إدارة رأس المال الصارمة هي أساس الاستمرارية والربح في السوق.</i>")
        msg = "\n".join(lines)
        return await self.send_message_async(msg)

    # ---------------------------------------------------------
    # Active Trade Execution / Target Hit Alerts
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
        Sends alerts when a tracked Saudi trade achieves TP1, TP2, or triggers Stop-Loss.
        """
        if not self.is_configured():
            return False

        now = time.time()
        dedup_key = (trade_id, alert_type)
        if dedup_key in self.last_alert_times:
            if now - self.last_alert_times[dedup_key] < 60:
                logger.debug(f"Throttled duplicate alert: {dedup_key}")
                return False

        self.last_alert_times[dedup_key] = now

        pnl_calc = pnl_pct
        if pnl_calc is None and locked_entry > 0 and current_price > 0:
            pnl_calc = round(((current_price - locked_entry) / locked_entry) * 100, 2)
        pnl_str = f"{'+' if (pnl_calc or 0) >= 0 else ''}{pnl_calc:.2f}%" if pnl_calc is not None else "--%"

        if alert_type == "TP1_REACHED":
            header = "🎯 <b>تحقيق الهدف الأول (TP1) بنجاح! 🚀</b>"
            badge = "🟢 <b>الربح المحقق:</b>"
        elif alert_type == "TP2_REACHED":
            header = "🏆 <b>تحقيق الهدف الثاني الكامل (TP2)! 🌟</b>"
            badge = "🟢 <b>الربح الإجمالي:</b>"
        elif alert_type in ["STOP_LOSS_HIT", "STOP_LOSS"]:
            header = "🚨 <b>تنبيه وقف الخسارة (Stop Loss Hit)!</b>"
            badge = "🔴 <b>تغير السعر:</b>"
        else:
            header = "🔒 <b>تأكيد قفل ومتابعة صفقة جديدة (Saudi Trade)</b>"
            badge = "⚪ <b>الحالة:</b> قيد المتابعة اللحظية"

        lines = [
            header,
            f"📌 <b>السهم:</b> <code>{symbol}</code>",
            f"💵 <b>سعر الدخول:</b> <code>{locked_entry:.2f} ر.س</code>",
            f"⚡ <b>السعر الحالي:</b> <code>{current_price:.2f} ر.س</code>",
            f"{badge} <code>{pnl_str}</code>",
            "────────────────────────",
            f"🎯 هدف 1: <code>{target_1:.2f} ر.س</code> | هدف 2: <code>{target_2:.2f} ر.س</code>",
            f"🛡️ وقف الخسارة: <code>{stop_loss:.2f} ر.س</code>",
            f"🕒 <code>{self._format_time_ar()}</code>"
        ]
        if notes:
            lines.append(f"💬 <i>{notes}</i>")

        msg = "\n".join(lines)
        return await self.send_message_async(msg)

telegram_notifier = TelegramNotifier()
