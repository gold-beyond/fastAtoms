"""Projects service - uses generic BaseService."""
from sqlalchemy.ext.asyncio import AsyncSession

from models.projects import Projects
from services.base import BaseService


class ProjectsService(BaseService[Projects]):
    """Service layer for Projects operations."""

    ALLOWED_UPDATE_FIELDS = ["name", "code_html", "code_css", "code_js", "published_url"]

    def __init__(self, db: AsyncSession):
        super().__init__(db, Projects)
