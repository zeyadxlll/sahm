"""
Sahm Saudi Pro - Master FastAPI & WebSocket Server (تاسي ونمو)
Port: 8001
Connects to Chrome Extension, processes Saudi market DOM table and depth feeds,
and executes quantitative analysis for Saudi stocks.
"""

import asyncio
import time
import json
import logging
from typing import Set, Dict, Any, Optional, List
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import settings
from utils.logger import setup_logger
from utils.telegram_notifier import telegram_notifier
from core import (
    OrderFlowAnalyzer,
    HistoricalDataManager,
    SaudiMarketEngine,
    saudi_engine,
    StrategyCopilot,
    market_state
)

logger = setup_logger("SahmSaudiPro.Server")

# Initialize Quantitative Engine Services
hist_mgr = HistoricalDataManager()
order_flow_analyzer = OrderFlowAnalyzer()
strategy_copilot = StrategyCopilot(hist_mgr)

# Active WebSocket connections pool
active_connections: Set[WebSocket] = set()

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("=" * 60)
    logger.info("🚀 Sahm Saudi Pro Server Started Successfully!")
    logger.info(f"🇸🇦 Market: Saudi Tadawul (TASI & Nomu)")
    logger.info(f"📡 WebSocket Endpoint: ws://localhost:{settings.PORT}/ws")
    logger.info(f"📘 API Documentation: http://localhost:{settings.PORT}/docs")
    logger.info("=" * 60)
    yield
    logger.info("Shutting down Sahm Saudi Pro Server...")

app = FastAPI(
    title="Sahm Saudi Pro API",
    description="Real-time Quantitative Engine for Saudi Tadawul (TASI & Nomu) on Port 8001",
    version="2.1.0",
    lifespan=lifespan
)

# Enable CORS for Chrome Extension
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

async def broadcast_payload(payload: Dict[str, Any]):
    """Broadcast JSON payload to all connected Chrome Extension sidebars."""
    if not active_connections:
        return
    message = json.dumps(payload, ensure_ascii=False)
    to_remove = set()
    for ws in active_connections:
        try:
            await ws.send_text(message)
        except Exception:
            to_remove.add(ws)
    for ws in to_remove:
        active_connections.discard(ws)
    market_state.client_count = len(active_connections)

def compute_saudi_signal(dom_data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Run quant engine on latest Saudi market DOM data and generate enriched signal.
    """
    # 1. Process market stocks
    raw_stocks = market_state.last_market_overview
    if dom_data and isinstance(dom_data, dict):
        if "rows" in dom_data:
            raw_stocks = dom_data["rows"]
        elif "stocks" in dom_data:
            raw_stocks = dom_data["stocks"]

    # Check market breadth (decliners vs advancers) to detect bearish regimes
    decliners = sum(1 for s in (raw_stocks or []) if float(s.get("changePercent", 0.0)) < -0.2)
    advancers = sum(1 for s in (raw_stocks or []) if float(s.get("changePercent", 0.0)) > 0.2)
    is_bearish = (decliners > advancers * 1.2) and (decliners >= max(1, len(raw_stocks or [])) * 0.45)

    stocks = saudi_engine.process_market_table(raw_stocks, is_bearish=is_bearish)
    market_state.last_market_overview = stocks

    # 2. Market Regime & Strategy
    market_regime = strategy_copilot.evaluate_market_regime(
        stocks,
        strategy_override=market_state.active_strategy
    )

    # 3. Top Opportunities
    opportunities = strategy_copilot.generate_opportunities(
        stocks,
        strategy_code=market_regime.get("activeStrategy", "AUTO")
    )

    # 4. Next-Session Predictions (Tab 3)
    next_session_predictions = strategy_copilot.predict_next_session(stocks)

    # 5. Order Flow Analysis for Active Stock (Tab 2)
    stock_detail = market_state.last_stock_detail
    symbol = "1120"
    name = "مصرف الراجحي"
    price = 87.50
    st_header = {"symbol": symbol, "name": name, "price": price}

    if stock_detail and "stock" in stock_detail:
        st = stock_detail["stock"]
        symbol = st.get("symbol", symbol)
        name = st.get("name", name)
        price = float(st.get("price") or st.get("lastPrice") or price)
        st_header = st

    ts = stock_detail.get("timeAndSales", {}) if stock_detail else {}
    ob = stock_detail.get("orderBook", {}) if stock_detail else {}

    analysis = order_flow_analyzer.analyze(
        time_and_sales=ts,
        order_book=ob,
        stock_header=st_header,
        symbol=symbol
    )

    order_flow_result = {
        "symbol": symbol,
        "name": name,
        "price": price,
        **analysis,
        "recentTrades": ts.get("recentTrades", []),
        "orderBook": ob if (ob.get("bids") or ob.get("asks")) else {"bids": [], "asks": []}
    }

    # 6. Composite 4D Rating
    analysis_4d = strategy_copilot.compute_4d_analysis(
        stock_header={"symbol": symbol, "name": name, "price": price},
        order_flow=order_flow_result
    )

    return {
        "type": "ANALYSIS_UPDATE",
        "timestamp": int(time.time() * 1000),
        "data": {
            "activeMarket": "SA",
            "marketStatus": market_state.market_status,
            "marketSummary": market_state.last_market_summary,
            "activeStrategy": market_regime.get("activeStrategy", "TASI_BREAKOUT"),
            "marketState": market_regime,
            "stocks": stocks,
            "opportunities": opportunities,
            "nextSession": next_session_predictions,
            "orderFlow": order_flow_result,
            "analysis4D": analysis_4d
        }
    }

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    active_connections.add(websocket)
    market_state.client_count = len(active_connections)
    logger.info(f"🟢 Saudi Pro Client connected. Total active clients: {len(active_connections)}")

    # Send initial state snapshot
    try:
        initial_signal = compute_saudi_signal()
        await websocket.send_text(json.dumps(initial_signal, ensure_ascii=False))
    except Exception as e:
        logger.warning(f"Error sending initial Saudi signal: {e}")

    try:
        while True:
            raw_text = await websocket.receive_text()
            try:
                msg = json.loads(raw_text)
                msg_type = msg.get("type", "")

                if msg_type == "PING":
                    await websocket.send_text(json.dumps({
                        "type": "PONG",
                        "timestamp": msg.get("timestamp", 0)
                    }))

                elif msg_type == "HANDSHAKE":
                    logger.info(f"🤝 Handshake from: {msg.get('client')} | Market: SA (Port 8001)")
                    await websocket.send_text(json.dumps({
                        "type": "HANDSHAKE_ACK",
                        "status": "READY",
                        "server": "SahmSaudiPro-FastAPI-v2",
                        "market": "SA"
                    }))

                elif msg_type in ["DOM_UPDATE", "SAUDI_MARKET_TABLE", "SAUDI_STOCK_DETAIL"]:
                    market_state.update_from_dom(msg)
                    fresh_signal = compute_saudi_signal(msg.get("data") or msg)
                    await broadcast_payload(fresh_signal)

                elif msg_type in ["TRADE_ALERT", "TRADE_EXECUTED"]:
                    logger.info(f"🔔 Received Trade Alert: {msg.get('symbol')} - {msg.get('alertType')}")
                    await telegram_notifier.send_trade_execution_alert(
                        trade_id=str(msg.get("tradeId", msg.get("symbol", ""))),
                        alert_type=str(msg.get("alertType", "EXECUTION")),
                        symbol=str(msg.get("symbol", "")),
                        locked_entry=float(msg.get("lockedEntry", msg.get("entryPrice", 0.0))),
                        current_price=float(msg.get("currentPrice", 0.0)),
                        target_1=float(msg.get("target1", 0.0)),
                        target_2=float(msg.get("target2", 0.0)),
                        stop_loss=float(msg.get("stopLoss", 0.0)),
                        pnl_pct=float(msg.get("pnlPct")) if msg.get("pnlPct") is not None else None,
                        notes=str(msg.get("notes", ""))
                    )

                elif msg_type == "CLEAR_TRADES":
                    logger.info("🗑️ Received CLEAR_TRADES request from Chrome Extension client.")
                    saudi_engine.clear_all_trades_and_alerts()
                    telegram_notifier.clear_cache()
                    await websocket.send_text(json.dumps({
                        "type": "TRADES_CLEARED",
                        "status": "OK"
                    }))

                elif msg_type == "SET_STRATEGY":
                    market_state.active_strategy = msg.get("strategy", "AUTO")
                    fresh_signal = compute_saudi_signal()
                    await broadcast_payload(fresh_signal)

            except json.JSONDecodeError:
                logger.error("Failed to decode JSON from client")
            except Exception as e:
                logger.error(f"Error processing client message: {e}", exc_info=True)

    except WebSocketDisconnect:
        active_connections.discard(websocket)
        market_state.client_count = len(active_connections)
        logger.info(f"🔴 Client disconnected. Remaining clients: {len(active_connections)}")

# ----------------- REST Endpoints -----------------

@app.get("/")
def read_root():
    return {
        "service": "Sahm Saudi Pro Quantitative Backend",
        "market": "SA (TASI & Nomu)",
        "port": settings.PORT,
        "status": "ONLINE",
        "marketStatus": market_state.market_status,
        "websocket": f"ws://localhost:{settings.PORT}/ws",
        "activeClients": market_state.client_count,
        "telegramNotifications": telegram_notifier.is_configured()
    }

@app.post("/analyze")
async def analyze_endpoint(payload: Dict[str, Any]):
    """
    HTTP fallback endpoint for Chrome Extension.
    """
    try:
        market_state.update_from_dom(payload)
        fresh_signal = compute_saudi_signal(payload.get("data") or payload)
        await broadcast_payload(fresh_signal)
        return fresh_signal
    except Exception as e:
        logger.error(f"Error in /analyze endpoint: {e}")
        return compute_saudi_signal()

@app.get("/api/saudi/radar")
def get_saudi_radar():
    """Returns parsed Saudi market table and indices."""
    signal = compute_saudi_signal()
    return signal.get("data", {})

@app.get("/api/saudi/opportunities")
def get_saudi_opportunities():
    """Returns top breakout and momentum opportunities."""
    stocks = market_state.last_market_overview
    return strategy_copilot.generate_opportunities(stocks)

@app.get("/api/saudi/next_session")
def get_saudi_next_session():
    """Returns Next-Session AI predictions based on closing auction metrics."""
    stocks = market_state.last_market_overview
    return strategy_copilot.predict_next_session(stocks)

@app.post("/api/telegram/send_recommendations")
async def telegram_send_recommendations(force: bool = False):
    """
    Dispatches Telegram alert with Top Saudi stocks.
    """
    stocks = market_state.last_market_overview
    summary = market_state.last_market_summary
    success = await telegram_notifier.send_saudi_recommendations_alert(
        stocks=stocks,
        summary=summary,
        force=force
    )
    return {"success": success, "stocksCount": min(3, len(stocks))}

@app.post("/api/trades/clear")
def clear_trades():
    saudi_engine.clear_all_trades_and_alerts()
    telegram_notifier.clear_cache()
    return {"success": True, "message": "تم مسح وإيقاف جميع التنبيهات بنجاح"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=settings.HOST, port=settings.PORT, reload=settings.DEBUG)
