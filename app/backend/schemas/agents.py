from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field
from pydantic.alias_generators import to_camel


class AgentResponse(BaseModel):
    id: str
    name: str
    role: str
    avatar_color: str = Field(validation_alias="avatar_color", serialization_alias="avatarColor")
    avatar_url: Optional[str] = Field(None, validation_alias="avatar_url", serialization_alias="avatarUrl")
    skills: List[str]
    is_builtin: bool = Field(validation_alias="is_builtin", serialization_alias="isBuiltin")

    class Config:
        from_attributes = True


class AgentListResponse(BaseModel):
    agents: List[AgentResponse]


class CustomAgentCreate(BaseModel):
    agent_id: str
    name: str
    role: str
    avatar_color: Optional[str] = "from-gray-500 to-gray-600"
    system_prompt: str
    skills: Optional[List[str]] = []


class CustomAgentUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    avatar_color: Optional[str] = None
    system_prompt: Optional[str] = None
    skills: Optional[List[str]] = None


class AgentChatRequest(BaseModel):
    """Send message to a single agent"""
    agent_id: str
    messages: List[Dict[str, str]]
    conversation_id: Optional[int] = None


class TeamChatRequest(BaseModel):
    """Team Mode: Mike coordinates"""
    messages: List[Dict[str, str]]
    conversation_id: Optional[int] = None


class AgentChatResponse(BaseModel):
    content: str
    agent_id: str
    tasks: Optional[List[Dict[str, Any]]] = None


class TaskCreate(BaseModel):
    conversation_id: int
    agent_id: str
    title: str
    description: Optional[str] = None
    dependent_task_ids: Optional[List[int]] = []


class TaskStatusUpdate(BaseModel):
    status: str  # pending | thinking | working | completed | failed


class TaskResponse(BaseModel):
    id: int
    conversation_id: int
    agent_id: str
    title: str
    description: Optional[str] = None
    status: str
    result: Optional[str] = None
    dependent_task_ids: List[int] = []
    sort_order: int = 0
    created_at: str

    class Config:
        from_attributes = True
