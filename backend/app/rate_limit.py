"""Centralized rate limiter instance.

Avoids circular imports between main.py and router modules by placing
the Limiter in a standalone module that both can safely import.
"""
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
