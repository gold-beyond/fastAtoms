from core.database import Base
from datetime import datetime, timezone
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text


class Task(Base):
    """Agent task"""
    __tablename__ = "tasks"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, autoincrement=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), index=True, nullable=False)
    user_id = Column(String(255), ForeignKey("users.id"), index=True, nullable=False)
    agent_id = Column(String(50), nullable=False)  # assigned to which agent
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String(20), default="pending")  # pending | thinking | working | completed | failed
    result = Column(Text, nullable=True)
    dependent_task_ids = Column(Text, nullable=True)  # JSON list of dependent task IDs
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
