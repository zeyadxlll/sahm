"""
Configuration and settings for Derayah Global SPX Options Python Backend
Dedicated Standalone Edition - Port 8002
"""

import os
from pydantic import BaseModel

class Settings(BaseModel):
    # Server network settings
    HOST: str = "0.0.0.0"
    PORT: int = 8002
    DEBUG: bool = True

    PLATFORM_NAME: str = "Derayah Global"
    DEFAULT_MARKET: str = "US"
    
    # SPX 0DTE Options Engine Settings
    SPX_TICKER: str = "^SPX"
    SPY_TICKER: str = "SPY"
    MAX_OPTION_SPREAD: float = 0.80           # Filter out wide spread illiquid contracts
    MIN_OPTION_VOLUME: int = 500              # Minimum volume for viable 0DTE execution
    
    # Quantitative Risk Parameters
    ATM_TP1_MULTIPLIER: float = 1.15
    ATM_TP2_MULTIPLIER: float = 1.30
    ATM_SL_MULTIPLIER: float = 0.88

    # Telegram Notification Settings
    TELEGRAM_BOT_TOKEN: str = "8916261182:AAFCG4I_5KxJqhO8VCk3ABjblUa81jiZQn4"
    TELEGRAM_CHAT_ID: str = "6363609406"
    TELEGRAM_NOTIFICATIONS_ENABLED: bool = True

settings = Settings()

# Module-level convenience exports
TELEGRAM_BOT_TOKEN = settings.TELEGRAM_BOT_TOKEN
TELEGRAM_CHAT_ID = settings.TELEGRAM_CHAT_ID
TELEGRAM_NOTIFICATIONS_ENABLED = settings.TELEGRAM_NOTIFICATIONS_ENABLED
