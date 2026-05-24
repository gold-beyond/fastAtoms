"""Task management routes — CRUD for agent tasks within conversations."""
import json
import logging
from datetime import datetime, timezone

from core.database import get_db
from dependencies.auth import get_current_user
from fastapi import APIRouter, Depends, HTTPException, Query
from schemas.agents import (
    TaskCreate,
    TaskResponse,
    TaskStatusUpdate,
)
from schemas.auth import UserResponse
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from models.tasks import Task

router = APIRouter(prefix="/api/v1/tasks", tags=["tasks"])
logger = logging.getLogger(__name__)


def _serialize_task(task: Task) -> dict:
    """Convert a Task ORM object to a response dict."""
    dep_ids = []
    if task.dependent_task_ids:
        try:
            dep_ids = json.loads(task.dependent_task_ids)
        except (json.JSONDecodeError, TypeError):
            dep_ids = []
    return {
        "id": task.id,
        "conversation_id": task.conversation_id,
        "agent_id": task.agent_id,
        "title": task.title,
        "description": task.description,
        "status": task.status,
        "result": task.result,
        "dependent_task_ids": dep_ids,
        "sort_order": task.sort_order,
        "created_at": task.created_at.isoformat() if task.created_at else "",
    }


@router.get("", response_model=list[TaskResponse])
async def list_tasks(
    conversation_id: int = Query(..., description="Filter tasks by conversation"),
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all tasks for a given conversation."""
    result = await db.execute(
        select(Task)
        .where(Task.conversation_id == conversation_id)
        .where(Task.user_id == str(current_user.id))
        .order_by(Task.sort_order, Task.id)
    )
    tasks = result.scalars().all()
    return [_serialize_task(t) for t in tasks]


@router.post("", response_model=TaskResponse, status_code=201)
async def create_task(
    body: TaskCreate,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new task for an agent in a conversation."""
    task = Task(
        conversation_id=body.conversation_id,
        user_id=str(current_user.id),
        agent_id=body.agent_id,
        title=body.title,
        description=body.description,
        status="pending",
        dependent_task_ids=json.dumps(body.dependent_task_ids or []),
        sort_order=0,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)
    return _serialize_task(task)


@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(
    task_id: int,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a single task by ID."""
    result = await db.execute(
        select(Task).where(Task.id == task_id).where(Task.user_id == str(current_user.id))
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return _serialize_task(task)


@router.put("/{task_id}/status", response_model=TaskResponse)
async def update_task_status(
    task_id: int,
    body: TaskStatusUpdate,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update the status of a task (e.g. pending → thinking → working → completed / failed)."""
    valid_statuses = {"pending", "thinking", "working", "completed", "failed"}
    if body.status not in valid_statuses:
        raise HTTPException(status_code=422, detail=f"Invalid status '{body.status}'. Must be one of: {', '.join(sorted(valid_statuses))}")

    result = await db.execute(
        select(Task).where(Task.id == task_id).where(Task.user_id == str(current_user.id))
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    task.status = body.status
    task.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(task)
    return _serialize_task(task)


@router.put("/{task_id}/result", response_model=TaskResponse)
async def update_task_result(
    task_id: int,
    body: dict,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update the result/output of a task."""
    result_text = body.get("result", "")
    if not isinstance(result_text, str):
        raise HTTPException(status_code=422, detail="'result' must be a string")

    result = await db.execute(
        select(Task).where(Task.id == task_id).where(Task.user_id == str(current_user.id))
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    task.result = result_text
    task.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(task)
    return _serialize_task(task)


@router.delete("/{task_id}", status_code=204)
async def delete_task(
    task_id: int,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a task."""
    result = await db.execute(
        select(Task).where(Task.id == task_id).where(Task.user_id == str(current_user.id))
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    await db.delete(task)
    await db.commit()
