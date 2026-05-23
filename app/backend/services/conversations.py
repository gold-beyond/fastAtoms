"""Conversations service - uses generic BaseService."""
from sqlalchemy.ext.asyncio import AsyncSession

from models.conversations import Conversations
from services.base import BaseService


class ConversationsService(BaseService[Conversations]):
    """Service layer for Conversations operations."""

    ALLOWED_UPDATE_FIELDS = ["title", "messages"]

    def __init__(self, db: AsyncSession):
        super().__init__(db, Conversations)
