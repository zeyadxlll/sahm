"""
Configuration and settings for Sahm Saudi Pro (TASI / Nomu) Python Backend
Dedicated Standalone Edition - Port 8001
"""

import os
from pydantic import BaseModel

class Settings(BaseModel):
    # Server network settings
    HOST: str = "0.0.0.0"
    PORT: int = 8001
    DEBUG: bool = True

    # Market Mapping (Saudi Tadawul -> Yahoo Finance ticker format)
    TADAWUL_SUFFIX: str = ".SR"
    DEFAULT_MARKET: str = "SA"
    
    # Quantitative & Order Flow Thresholds for Saudi Stocks
    ACCUMULATION_BUY_RATIO_MIN: float = 58.0   # Buy volume > 58% indicates accumulation
    DISTRIBUTION_SELL_RATIO_MIN: float = 58.0  # Sell volume > 58% indicates distribution
    SIDEWAYS_CHOP_THRESHOLD: float = 4.0       # Low volatility / flat slope triggers sideways warning
    
    # Saudi Radar & Auction Predictor Settings
    AUCTION_VOLUME_SURGE_MULTIPLIER: float = 2.5
    OVERNIGHT_GAP_MIN_PROBABILITY: float = 65.0
    
    # Telegram Notification Settings
    TELEGRAM_BOT_TOKEN: str = "8916261182:AAFCG4I_5KxJqhO8VCk3ABjblUa81jiZQn4"
    TELEGRAM_CHAT_ID: str = "6363609406"
    TELEGRAM_NOTIFICATIONS_ENABLED: bool = True

settings = Settings()

# Module-level convenience exports
TELEGRAM_BOT_TOKEN = settings.TELEGRAM_BOT_TOKEN
TELEGRAM_CHAT_ID = settings.TELEGRAM_CHAT_ID
TELEGRAM_NOTIFICATIONS_ENABLED = settings.TELEGRAM_NOTIFICATIONS_ENABLED
