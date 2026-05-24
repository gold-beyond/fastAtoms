"""Shared API Key model — stored in database, accessible by all users."""
from core.database import Base
from datetime import datetime, timezone
from sqlalchemy import Column, DateTime, String, Text


class SharedKey(Base):
    """Shared API key for AI providers."""
    __tablename__ = "shared_keys"
    __table_args__ = {"extend_existing": True}

    provider = Column(String(50), primary_key=True)  # "deepseek", "openai", "anthropic"
    api_key = Column(Text, nullable=False, default="")
    updated_by = Column(String(255), nullable=True)
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
