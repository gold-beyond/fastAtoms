"""Generic CRUD Service base class."""
import logging
from typing import Any, Dict, Generic, List, Optional, Type, TypeVar

from sqlalchemy import select, func, inspect
from sqlalchemy.ext.asyncio import AsyncSession
from core.database import Base

logger = logging.getLogger(__name__)

ModelType = TypeVar("ModelType", bound=Base)


class BaseService(Generic[ModelType]):
    """Generic CRUD service with common database operations."""

    ALLOWED_UPDATE_FIELDS: List[str] = []

    def __init__(self, db: AsyncSession, model_class: Type[ModelType]):
        self.db = db
        self.model_class = model_class

    async def create(self, data: Dict[str, Any], user_id: Optional[str] = None) -> Optional[ModelType]:
        try:
            if user_id:
                data["user_id"] = user_id
            obj = self.model_class(**data)
            self.db.add(obj)
            await self.db.commit()
            await self.db.refresh(obj)
            logger.info("Created %s with id: %s", self.model_class.__name__, obj.id)
            return obj
        except Exception as e:
            await self.db.rollback()
            logger.error("Error creating %s: %s", self.model_class.__name__, str(e))
            raise

    async def get_by_id(self, obj_id: int, user_id: Optional[str] = None) -> Optional[ModelType]:
        try:
            query = select(self.model_class).where(self.model_class.id == obj_id)
            if user_id and hasattr(self.model_class, "user_id"):
                query = query.where(self.model_class.user_id == user_id)
            result = await self.db.execute(query)
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error("Error fetching %s %s: %s", self.model_class.__name__, obj_id, str(e))
            raise

    async def get_list(
        self,
        skip: int = 0,
        limit: int = 20,
        user_id: Optional[str] = None,
        query_dict: Optional[Dict[str, Any]] = None,
        sort: Optional[str] = None,
    ) -> Dict[str, Any]:
        try:
            query = select(self.model_class)
            count_query = select(func.count(self.model_class.id))

            if user_id and hasattr(self.model_class, "user_id"):
                query = query.where(self.model_class.user_id == user_id)
                count_query = count_query.where(self.model_class.user_id == user_id)

            if query_dict:
                mapper = inspect(self.model_class)
                for field, value in query_dict.items():
                    if field in mapper.columns:
                        query = query.where(mapper.columns[field] == value)
                        count_query = count_query.where(mapper.columns[field] == value)

            count_result = await self.db.execute(count_query)
            total = count_result.scalar()

            if sort:
                if sort.startswith("-"):
                    field_name = sort[1:]
                    if hasattr(self.model_class, field_name):
                        query = query.order_by(getattr(self.model_class, field_name).desc())
                else:
                    if hasattr(self.model_class, sort):
                        query = query.order_by(getattr(self.model_class, sort))
            else:
                if hasattr(self.model_class, "id"):
                    query = query.order_by(self.model_class.id.desc())

            result = await self.db.execute(query.offset(skip).limit(limit))
            items = result.scalars().all()

            return {
                "items": items,
                "total": total,
                "skip": skip,
                "limit": limit,
            }
        except Exception as e:
            logger.error("Error fetching %s list: %s", self.model_class.__name__, str(e))
            raise

    async def update(self, obj_id: int, update_data: Dict[str, Any], user_id: Optional[str] = None) -> Optional[ModelType]:
        try:
            obj = await self.get_by_id(obj_id, user_id=user_id)
            if not obj:
                logger.warning("%s %s not found for update", self.model_class.__name__, obj_id)
                return None
            allowed = self.ALLOWED_UPDATE_FIELDS
            for key, value in update_data.items():
                if key == "user_id":
                    continue
                if allowed and key not in allowed:
                    continue
                if hasattr(obj, key):
                    setattr(obj, key, value)

            await self.db.commit()
            await self.db.refresh(obj)
            logger.info("Updated %s %s", self.model_class.__name__, obj_id)
            return obj
        except Exception as e:
            await self.db.rollback()
            logger.error("Error updating %s %s: %s", self.model_class.__name__, obj_id, str(e))
            raise

    async def delete(self, obj_id: int, user_id: Optional[str] = None) -> bool:
        try:
            obj = await self.get_by_id(obj_id, user_id=user_id)
            if not obj:
                logger.warning("%s %s not found for deletion", self.model_class.__name__, obj_id)
                return False
            await self.db.delete(obj)
            await self.db.commit()
            logger.info("Deleted %s %s", self.model_class.__name__, obj_id)
            return True
        except Exception as e:
            await self.db.rollback()
            logger.error("Error deleting %s %s: %s", self.model_class.__name__, obj_id, str(e))
            raise

    async def check_ownership(self, obj_id: int, user_id: str) -> bool:
        try:
            obj = await self.get_by_id(obj_id, user_id=user_id)
            return obj is not None
        except Exception as e:
            logger.error("Error checking ownership for %s %s: %s", self.model_class.__name__, obj_id, str(e))
            return False

    async def get_by_field(self, field_name: str, field_value: Any) -> Optional[ModelType]:
        try:
            mapper = inspect(self.model_class)
            if field_name not in mapper.columns:
                raise ValueError(f"Field {field_name} does not exist on {self.model_class.__name__}")
            result = await self.db.execute(
                select(self.model_class).where(mapper.columns[field_name] == field_value)
            )
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error("Error fetching %s by %s: %s", self.model_class.__name__, field_name, str(e))
            raise

    async def list_by_field(
        self, field_name: str, field_value: Any, skip: int = 0, limit: int = 20
    ) -> List[ModelType]:
        try:
            mapper = inspect(self.model_class)
            if field_name not in mapper.columns:
                raise ValueError(f"Field {field_name} does not exist on {self.model_class.__name__}")
            result = await self.db.execute(
                select(self.model_class)
                .where(mapper.columns[field_name] == field_value)
                .offset(skip)
                .limit(limit)
                .order_by(self.model_class.id.desc())
            )
            return result.scalars().all()
        except Exception as e:
            logger.error("Error fetching %ss by %s: %s", self.model_class.__name__, field_name, str(e))
            raise
