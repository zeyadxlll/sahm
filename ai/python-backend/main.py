"""
Sahm Trading Copilot - Master FastAPI & WebSocket Server
Connects to Chrome Extension, processes DOM feeds, and runs Quantitative Multi-Strategy Analysis.
"""

import asyncio
import time
import json
import logging
from typing import Set, Dict, Any, Optional
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
    SPXOpeningEngine,
    StrategyCopilot,
    market_state
)

logger = setup_logger("SahmCopilot.Server")

# Initialize Quantitative Engine Services
hist_mgr = HistoricalDataManager()
order_flow_analyzer = OrderFlowAnalyzer()
spx_engine = SPXOpeningEngine()
strategy_copilot = StrategyCopilot(hist_mgr)

# Active WebSocket connections pool
active_connections: Set[WebSocket] = set()

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("=" * 60)
    logger.info("🚀 Sahm Trading Copilot Server Started Successfully!")
    logger.info(f"📡 WebSocket Endpoint: ws://localhost:{settings.PORT}/ws")
    logger.info(f"📘 API Documentation: http://localhost:{settings.PORT}/docs")
    logger.info("=" * 60)
    yield
    logger.info("Shutting down Sahm Trading Copilot Server...")

app = FastAPI(
    title="Sahm Trading Copilot API",
    description="Real-time Quantitative DOM Engine & WebSocket Bridge for Sahm Platform",
    version="2.0.0",
    lifespan=lifespan
)

# Enable CORS for Chrome Extension & local simulator
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

async def broadcast_payload(payload: Dict[str, Any]):
    """Broadcast JSON payload to all connected Chrome Extension tabs"""
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

def compute_full_signal(
    dom_data: Optional[Dict[str, Any]] = None,
    active_market: Optional[str] = None,
    strategy_override: Optional[str] = None
) -> Dict[str, Any]:
    """
    Run quant engine on latest DOM data and generate full signal payload for the Floating Sidebar.
    Supports Market Switching (SA vs US), Multi-Strategy Engine, Next-Session AI Predictor, and 4D Analysis.
    """
    market = active_market or market_state.active_market or "SA"
    strategy = strategy_override or market_state.active_strategy or "AUTO"

    # 1. Market Overview & Regime
    stocks = market_state.last_market_overview
    market_regime = strategy_copilot.evaluate_market_regime(
        stocks,
        market_type=market,
        strategy_override=strategy
    )

    # 2. Opportunities (1-3 sessions)
    opportunities = strategy_copilot.generate_opportunities(
        stocks,
        market_type=market,
        strategy_code=market_regime.get("activeStrategy", strategy)
    )

    # 3. Next-Session AI Predictor ("رادار الجلسة القادمة")
    next_session_predictions = strategy_copilot.predict_next_session(stocks)

    # 4. Order Flow Analysis (Single Stock if active)
    active_stock_payload = market_state.last_stock_detail
    symbol = "1120" if market == "SA" else "SPX"
    order_flow_result = {
        "symbol": symbol,
        "buyRatio": 54.0,
        "sellRatio": 46.0,
        "netDelta": 15400,
        "sentiment": "BALANCED",
        "sentimentArabic": "توازن نسبي وترقب",
        "totalBuyVolume": 2450000,
        "totalSellVolume": 2085000,
        "bidRatio": 53,
        "askRatio": 47,
        "absorptionAlert": None
    }

    if active_stock_payload:
        symbol = active_stock_payload.get("stock", {}).get("symbol", symbol)
        ts = active_stock_payload.get("timeAndSales", {})
        ob = active_stock_payload.get("orderBook", {})
        order_flow_result = order_flow_analyzer.analyze(ts, ob, symbol=symbol)

    # 5. 4-Dimensional Stock Analysis (Technical + Fundamental + News + Order Flow)
    stock_header = active_stock_payload.get("stock", {
        "symbol": symbol,
        "name": "مصرف الراجحي" if market == "SA" else "NVIDIA Corp",
        "price": 87.50 if market == "SA" else 138.20,
        "changePercent": 1.65
    })
    fundamentals = active_stock_payload.get("fundamentals", {
        "marketCapFormatted": "350 مليار ر.س" if market == "SA" else "$3.4T",
        "volumeFormatted": "4.85M",
        "open": 86.80 if market == "SA" else 136.50,
        "dayRange": "86.80 - 88.20" if market == "SA" else "135.20 - 139.10"
    })
    news_sentiment = active_stock_payload.get("newsSentiment", {
        "sentimentScore": 35,
        "overallSentiment": "BULLISH",
        "headlines": [
          {"title": "نمو ملحوظ في الأرباح التشغيلية وصافي الدخل", "time": "اليوم", "sentiment": "BULLISH"},
          {"title": "استقرار نسبي في تداولات القطاع المالي والمصرفي", "time": "اليوم", "sentiment": "NEUTRAL"}
        ]
    })
    analysis_4d = strategy_copilot.compute_4d_analysis(
        stock_header=stock_header,
        fundamentals=fundamentals,
        news_sentiment=news_sentiment,
        order_flow=order_flow_result
    )

    # 6. Portfolio Advisory
    portfolio_advice = strategy_copilot.analyze_portfolio(
        order_flow=order_flow_result,
        market_type=market
    )

    # 7. SPX Opening Engine (with Strategy Override)
    spx_data = market_state.last_spx_options
    underlying = float(spx_data.get("underlyingPrice", 0.0))
    spx_result = spx_engine.evaluate_opening(
        underlying,
        spx_data,
        strategy_override=strategy if market == "US" else None
    )

    return {
        "type": "ANALYSIS_UPDATE",
        "timestamp": int(time.time() * 1000),
        "data": {
            "activeMarket": market,
            "marketStatus": market_state.market_status,
            "activeStrategy": market_regime.get("activeStrategy", strategy),
            "marketState": market_regime,
            "orderFlow": order_flow_result,
            "opportunities": opportunities,
            "nextSession": next_session_predictions,
            "analysis4D": analysis_4d,
            "portfolio": portfolio_advice,
            "spxEngine": spx_result
        }
    }

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    active_connections.add(websocket)
    market_state.client_count = len(active_connections)
    logger.info(f"🟢 Client connected. Total active clients: {len(active_connections)}")

    # Send initial state snapshot
    try:
        initial_signal = compute_full_signal()
        await websocket.send_text(json.dumps(initial_signal, ensure_ascii=False))
    except Exception as e:
        logger.warning(f"Error sending initial signal: {e}")

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
                    logger.info(f"🤝 Handshake from: {msg.get('client')} | URL: {msg.get('url')}")
                    await websocket.send_text(json.dumps({
                        "type": "HANDSHAKE_ACK",
                        "status": "READY",
                        "server": "SahmCopilot-FastAPI-v2"
                    }))

                elif msg_type == "SET_MARKET":
                    market_state.active_market = msg.get("market", "SA")
                    fresh_signal = compute_full_signal(active_market=market_state.active_market)
                    await broadcast_payload(fresh_signal)

                elif msg_type == "SET_STRATEGY":
                    market_state.active_strategy = msg.get("strategy", "AUTO")
                    fresh_signal = compute_full_signal(strategy_override=market_state.active_strategy)
                    await broadcast_payload(fresh_signal)

                elif msg_type == "DOM_UPDATE":
                    market_state.update_from_dom(msg)
                    logger.info(f"📥 Received DOM Update: {msg.get('pageType')} | Market: {market_state.active_market}")

                    fresh_signal = compute_full_signal(msg.get("data"))
                    await broadcast_payload(fresh_signal)

                elif msg_type in ["TRADE_ALERT", "TRADE_EXECUTED"]:
                    logger.info(f"🔔 Received Trade Alert: {msg.get('tradeId')} - {msg.get('alertType')}")
                    await telegram_notifier.send_trade_execution_alert(
                        trade_id=str(msg.get("tradeId", "")),
                        alert_type=str(msg.get("alertType", "EXECUTION")),
                        symbol=str(msg.get("symbol", "")),
                        locked_entry=float(msg.get("lockedEntry", 0.0)),
                        current_price=float(msg.get("currentPrice", 0.0)),
                        target_1=float(msg.get("target1", 0.0)),
                        target_2=float(msg.get("target2", 0.0)),
                        stop_loss=float(msg.get("stopLoss", 0.0)),
                        pnl_pct=float(msg.get("pnlPct")) if msg.get("pnlPct") is not None else None,
                        notes=str(msg.get("notes", ""))
                    )

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
        "service": "Sahm Trading Copilot Backend",
        "version": "2.0.0",
        "status": "ONLINE",
        "activeMarket": market_state.active_market,
        "marketStatus": market_state.market_status,
        "websocket": f"ws://localhost:{settings.PORT}/ws",
        "activeClients": market_state.client_count,
        "telegramNotifications": telegram_notifier.is_configured()
    }

@app.post("/analyze")
async def analyze_endpoint(payload: Dict[str, Any]):
    """
    HTTP fallback endpoint for Chrome Extension background service worker.
    Processes DOM payload and returns compute_full_signal analysis without mixed-content restrictions.
    """
    try:
        # Check if payload contains an immediate trade alert
        if payload.get("tradeAlert"):
            ta = payload.get("tradeAlert")
            await telegram_notifier.send_trade_execution_alert(
                trade_id=str(ta.get("tradeId", "")),
                alert_type=str(ta.get("alertType", "EXECUTION")),
                symbol=str(ta.get("symbol", "")),
                locked_entry=float(ta.get("lockedEntry", 0.0)),
                current_price=float(ta.get("currentPrice", 0.0)),
                target_1=float(ta.get("target1", 0.0)),
                target_2=float(ta.get("target2", 0.0)),
                stop_loss=float(ta.get("stopLoss", 0.0)),
                pnl_pct=float(ta.get("pnlPct")) if ta.get("pnlPct") is not None else None,
                notes=str(ta.get("notes", ""))
            )

        market_state.update_from_dom(payload)
        active_mkt = payload.get("activeMarket") or market_state.active_market
        strategy_override = payload.get("activeStrategy") or market_state.active_strategy
        fresh_signal = compute_full_signal(payload.get("data"), active_market=active_mkt, strategy_override=strategy_override)
        await broadcast_payload(fresh_signal)
        return fresh_signal
    except Exception as e:
        logger.error(f"Error in /analyze endpoint: {e}")
        return compute_full_signal()

@app.post("/api/telegram/trade_alert")
async def telegram_trade_alert_endpoint(payload: Dict[str, Any]):
    """
    Receive trade alerts (Target reached, Stop-loss hit, Trade locked) and notify Telegram.
    """
    trade_id = str(payload.get("tradeId") or payload.get("id") or "TRADE")
    alert_type = str(payload.get("alertType") or payload.get("type") or "TP1_REACHED")
    symbol = str(payload.get("symbol") or "SPX Option")
    locked_entry = float(payload.get("lockedEntry") or payload.get("entry") or 0.0)
    current_price = float(payload.get("currentPrice") or payload.get("price") or 0.0)
    target_1 = float(payload.get("target1") or payload.get("tp1") or 0.0)
    target_2 = float(payload.get("target2") or payload.get("tp2") or 0.0)
    stop_loss = float(payload.get("stopLoss") or payload.get("sl") or 0.0)
    pnl_pct = float(payload.get("pnlPct")) if payload.get("pnlPct") is not None else None
    notes = str(payload.get("notes", ""))

    success = await telegram_notifier.send_trade_execution_alert(
        trade_id=trade_id,
        alert_type=alert_type,
        symbol=symbol,
        locked_entry=locked_entry,
        current_price=current_price,
        target_1=target_1,
        target_2=target_2,
        stop_loss=stop_loss,
        pnl_pct=pnl_pct,
        notes=notes
    )
    return {"success": success, "tradeId": trade_id, "alertType": alert_type}

@app.post("/api/telegram/send_recommendations")
async def telegram_send_recommendations_endpoint(force: bool = False):
    """
    Trigger immediate Telegram dispatch of all currently recommended contracts.
    """
    spx_data = market_state.last_spx_options
    underlying = float(spx_data.get("underlyingPrice", 0.0))
    spx_result = spx_engine.evaluate_opening(underlying, spx_data, notify_telegram=False)
    success = await telegram_notifier.send_recommended_contracts_alert(spx_result, force=force)
    return {
        "success": success,
        "contractsCount": len(spx_result.get("topCalls", []) + spx_result.get("topPuts", []))
    }

@app.get("/api/state")
def get_state():
    return market_state.get_summary()

@app.get("/api/signal")
def get_signal(market: Optional[str] = None, strategy: Optional[str] = None):
    return compute_full_signal(active_market=market, strategy_override=strategy)

@app.get("/api/opportunities")
def get_opportunities(market: str = "SA", strategy: str = "AUTO"):
    stocks = market_state.last_market_overview
    return strategy_copilot.generate_opportunities(stocks, market_type=market, strategy_code=strategy)

@app.get("/api/next_session")
def get_next_session():
    stocks = market_state.last_market_overview
    return strategy_copilot.predict_next_session(stocks)

@app.get("/api/spx")
def get_spx(strategy: Optional[str] = None):
    spx_data = market_state.last_spx_options
    underlying = float(spx_data.get("underlyingPrice", 0.0))
    return spx_engine.evaluate_opening(underlying, spx_data, strategy_override=strategy)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=settings.HOST, port=settings.PORT, reload=settings.DEBUG)
