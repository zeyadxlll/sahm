"""
Service alias forwarding to core.strategy_copilot
Satisfies import path 'python-backend/app/services/strategy_copilot.py'.
"""
import sys
import os

# Add parent path to sys.path so core can be imported
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_root = os.path.abspath(os.path.join(current_dir, "..", ".."))
if backend_root not in sys.path:
    sys.path.insert(0, backend_root)

from core.strategy_copilot import StrategyCopilot

__all__ = ["StrategyCopilot"]
