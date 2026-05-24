import logging
import os
import time

from core.database import db_manager
from sqlalchemy import text

logger = logging.getLogger(__name__)


async def check_database_health() -> bool:
    """Check if database is healthy"""
    start_time = time.time()
    logger.debug("[DB_OP] Starting database health check")
    try:
        if not db_manager.async_session_maker:
            return False

        async with db_manager.async_session_maker() as session:
            await session.execute(text("SELECT 1"))
            logger.debug(f"[DB_OP] Database health check completed in {time.time() - start_time:.4f}s - healthy: True")
            return True
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        logger.debug(f"[DB_OP] Database health check failed in {time.time() - start_time:.4f}s - healthy: False")
        return False


async def _ensure_column_exists(column_name: str, column_def: str, table_name: str = "users"):
    """Add a column to an existing table if it doesn't exist (idempotent)."""
    try:
        async with db_manager.async_session_maker() as session:
            if db_manager.engine and db_manager.engine.dialect.name == "postgresql":
                check_sql = text(
                    "SELECT 1 FROM information_schema.columns "
                    "WHERE table_name = :table AND column_name = :col"
                )
                result = await session.execute(check_sql, {"table": table_name, "col": column_name})
                if result.scalar_one_or_none():
                    return  # Column already exists
                await session.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {column_def}"))
            else:
                # SQLite fallback: PRAGMA-based check
                result = await session.execute(text(f"PRAGMA table_info({table_name})"))
                columns = [row[1] for row in result.fetchall()]
                if column_name in columns:
                    return
                await session.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {column_def}"))
            await session.commit()
            logger.info(f"Added missing column '{column_name}' to table '{table_name}'")
    except Exception as e:
        logger.warning(f"Could not add column '{column_name}' to '{table_name}': {e}")


async def initialize_database():
    """Initialize database and create tables"""
    if "MGX_IGNORE_INIT_DB" in os.environ:
        logger.info("Ignore creating tables")
        return
    start_time = time.time()
    logger.debug("[DB_OP] Starting database initialization")
    try:
        logger.info("🔧 Starting database initialization...")
        await db_manager.init_db()
        logger.info("🔧 Database connection initialized, now creating tables if tables not exist...")
        await db_manager.create_tables()
        logger.info("🔧 Checking for missing schema migrations...")
        await _ensure_column_exists("password_hash", "password_hash VARCHAR(255)")
        logger.info("🔧 Schema check completed")
        logger.info("Database initialized successfully")
        logger.debug(f"[DB_OP] Database initialization completed in {time.time() - start_time:.4f}s")
    except Exception as e:
        logger.error(f"Failed to initialize database: {e}")
        raise


async def close_database():
    """Close database connections"""
    start_time = time.time()
    logger.debug("[DB_OP] Starting database close")
    try:
        await db_manager.close_db()
        logger.info("Database connections closed")
        logger.debug(f"[DB_OP] Database close completed in {time.time() - start_time:.4f}s")
    except Exception as e:
        logger.error(f"Error closing database: {e}")
        logger.debug(f"[DB_OP] Database close failed in {time.time() - start_time:.4f}s")
