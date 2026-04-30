"""
Wrapper module for the FastAPI application.
This allows running: uvicorn main:app --reload
"""

from app.main import app

__all__ = ["app"]
