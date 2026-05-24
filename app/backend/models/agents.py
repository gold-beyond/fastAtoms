from core.database import Base
from datetime import datetime, timezone
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, Boolean


class Agent(Base):
    """System built-in Agent definition"""
    __tablename__ = "agents"
    __table_args__ = {"extend_existing": True}

    id = Column(String(50), primary_key=True)  # e.g. "mike", "emma", "alex"
    name = Column(String(100), nullable=False)  # display name
    role = Column(String(100), nullable=False)  # role title
    avatar_color = Column(String(20), nullable=False)  # avatar gradient class
    system_prompt = Column(Text, nullable=False)  # agent system prompt
    skills = Column(Text, nullable=True)  # JSON list of skill tags
    is_builtin = Column(Boolean, default=True)
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class CustomAgent(Base):
    """User-defined custom Agent"""
    __tablename__ = "custom_agents"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(255), ForeignKey("users.id"), index=True, nullable=False)
    agent_id = Column(String(50), unique=True, nullable=False)
    name = Column(String(100), nullable=False)
    role = Column(String(100), nullable=False)
    avatar_color = Column(String(20), default="from-gray-500 to-gray-600")
    system_prompt = Column(Text, nullable=False)
    skills = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
