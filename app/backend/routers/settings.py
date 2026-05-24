from datetime import datetime, timezone
from pathlib import Path
from typing import Dict

from core.database import get_db
from dependencies.auth import get_admin_user, get_current_user
from fastapi import APIRouter, Depends, HTTPException
from models.shared_key import SharedKey
from pydantic import BaseModel
from schemas.auth import UserResponse
from services.ai_proxy import set_shared_key_cache
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


class SharedKeyUpdate(BaseModel):
    provider: str
    api_key: str


router = APIRouter(prefix="/api/v1/admin/settings", tags=["admin-settings"])


@router.get("/shared-key/{provider}")
async def get_shared_key(
    provider: str,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the shared API key for a provider (returns masked)."""
    try:
        result = await db.execute(select(SharedKey).where(SharedKey.provider == provider))
        entry = result.scalar_one_or_none()
        key = entry.api_key if entry and entry.api_key else ""
        # Populate cache so AI proxy can use it without a DB query
        if key:
            set_shared_key_cache(provider, key)
        return {"configured": bool(key), "key_preview": key[:8] + "..." if len(key) > 8 else ""}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/shared-key/{provider}")
async def set_shared_key(
    provider: str,
    update: SharedKeyUpdate,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Set the shared API key for a provider (any logged-in user can set)."""
    try:
        result = await db.execute(select(SharedKey).where(SharedKey.provider == provider))
        entry = result.scalar_one_or_none()
        if entry:
            entry.api_key = update.api_key
            entry.updated_by = str(current_user.id)
            entry.updated_at = datetime.now(timezone.utc)
        else:
            entry = SharedKey(
                provider=provider,
                api_key=update.api_key,
                updated_by=str(current_user.id),
            )
            db.add(entry)
        await db.commit()
        # Update in-memory cache for immediate use (no restart needed)
        set_shared_key_cache(provider, update.api_key)
        return {"message": f"{provider} API key saved successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class EnvVariable(BaseModel):
    key: str
    value: str
    description: str = ""


class EnvConfig(BaseModel):
    backend_vars: Dict[str, EnvVariable]
    frontend_vars: Dict[str, EnvVariable]


class EnvVariableUpdate(BaseModel):
    value: str


def get_env_file_path(env_type: str) -> Path:
    """Get the path to the environment variable file."""
    base_path = Path(__file__).parent.parent
    if env_type == "backend":
        return base_path / ".env"
    elif env_type == "frontend":
        return base_path.parent / "frontend" / ".env"
    else:
        raise ValueError("Invalid env_type")


def read_env_file(env_type: str) -> Dict[str, str]:
    """Read an environment variable file."""
    env_file = get_env_file_path(env_type)
    if not env_file.exists():
        return {}

    env_vars = {}
    with open(env_file, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, value = line.split("=", 1)
                env_vars[key.strip()] = value.strip()
    return env_vars


def write_env_file(env_type: str, env_vars: Dict[str, str]):
    """Write to an environment variable file."""
    env_file = get_env_file_path(env_type)

    # Ensure the directory exists
    env_file.parent.mkdir(parents=True, exist_ok=True)

    with open(env_file, "w", encoding="utf-8") as f:
        for key, value in env_vars.items():
            f.write(f"{key}={value}\n")


@router.get("", response_model=EnvConfig)
async def get_settings(current_user: UserResponse = Depends(get_admin_user)):
    """Retrieve environment variable configuration."""
    try:
        backend_vars = read_env_file("backend")
        frontend_vars = read_env_file("frontend")

        # Define descriptions for configuration items
        backend_descriptions = {
            "DATABASE_URL": "Database connection string",
            "STRIPE_SECRET_KEY": "Stripe secret key",
            "STRIPE_SUCCESS_URL": "Payment success callback URL",
            "STRIPE_CANCEL_URL": "Payment cancellation callback URL",
            "ALLOWED_DOMAINS": "Allowed domains",
            "OIDC_ISSUER_URL": "OIDC issuer URL",
            "OIDC_CLIENT_ID": "OIDC client ID",
            "OIDC_CLIENT_SECRET": "OIDC client secret",
            "OIDC_SCOPE": "OIDC scopes",
            "HOST": "Server host address",
            "PORT": "Server port",
            "FRONTEND_URL": "Frontend URL",
            "JWT_SECRET_KEY": "JWT signing secret key",
            "JWT_ALGORITHM": "JWT signing algorithm",
            "JWT_EXPIRE_MINUTES": "JWT expiration time (minutes)",
            "ADMIN_USER_ID": "Admin user ID",
            "ADMIN_USER_EMAIL": "Admin user email",
        }

        frontend_descriptions = {"VITE_API_BASE_URL": "Base API URL", "VITE_FRONTEND_URL": "Frontend URL"}

        # Build response data
        backend_config = {}
        for key, value in backend_vars.items():
            backend_config[key] = EnvVariable(key=key, value=value, description=backend_descriptions.get(key, ""))

        frontend_config = {}
        for key, value in frontend_vars.items():
            frontend_config[key] = EnvVariable(key=key, value=value, description=frontend_descriptions.get(key, ""))

        return EnvConfig(backend_vars=backend_config, frontend_vars=frontend_config)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read configuration: {str(e)}")


@router.put("/backend/{key}")
async def update_backend_setting(
    key: str, update: EnvVariableUpdate, current_user: UserResponse = Depends(get_admin_user)
):
    """Update a backend environment variable."""
    try:
        env_vars = read_env_file("backend")
        env_vars[key] = update.value
        write_env_file("backend", env_vars)
        return {"message": f"Backend configuration '{key}' updated successfully; restart required to take effect."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update configuration: {str(e)}")


@router.put("/frontend/{key}")
async def update_frontend_setting(
    key: str, update: EnvVariableUpdate, current_user: UserResponse = Depends(get_admin_user)
):
    """Update a frontend environment variable."""
    try:
        env_vars = read_env_file("frontend")
        env_vars[key] = update.value
        write_env_file("frontend", env_vars)
        return {"message": f"Frontend configuration '{key}' updated successfully; restart required to take effect."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update configuration: {str(e)}")


@router.post("/backend/{key}")
async def add_backend_setting(
    key: str, update: EnvVariableUpdate, current_user: UserResponse = Depends(get_admin_user)
):
    """Add a backend environment variable."""
    try:
        env_vars = read_env_file("backend")
        env_vars[key] = update.value
        write_env_file("backend", env_vars)
        return {"message": f"Backend configuration '{key}' added successfully; restart required to take effect."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to add configuration: {str(e)}")


@router.post("/frontend/{key}")
async def add_frontend_setting(
    key: str, update: EnvVariableUpdate, current_user: UserResponse = Depends(get_admin_user)
):
    """Add a frontend environment variable."""
    try:
        env_vars = read_env_file("frontend")
        env_vars[key] = update.value
        write_env_file("frontend", env_vars)
        return {"message": f"Frontend configuration '{key}' added successfully; restart required to take effect."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to add configuration: {str(e)}")


@router.delete("/backend/{key}")
async def delete_backend_setting(key: str, current_user: UserResponse = Depends(get_admin_user)):
    """Delete a backend environment variable."""
    try:
        env_vars = read_env_file("backend")
        if key in env_vars:
            del env_vars[key]
            write_env_file("backend", env_vars)
            return {"message": f"Backend configuration '{key}' deleted successfully; restart required to take effect."}
        else:
            raise HTTPException(status_code=404, detail=f"Configuration item '{key}' does not exist")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete configuration: {str(e)}")


@router.delete("/frontend/{key}")
async def delete_frontend_setting(key: str, current_user: UserResponse = Depends(get_admin_user)):
    """Delete a frontend environment variable."""
    try:
        env_vars = read_env_file("frontend")
        if key in env_vars:
            del env_vars[key]
            write_env_file("frontend", env_vars)
            return {"message": f"Frontend configuration '{key}' deleted successfully; restart required to take effect."}
        else:
            raise HTTPException(status_code=404, detail=f"Configuration item '{key}' does not exist")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete configuration: {str(e)}")

