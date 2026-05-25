"""Agent Orchestrator — multi-agent collaboration coordinator."""
import json
import logging
from typing import Any, Dict, List, Optional

from services.ai_proxy import proxy_chat, proxy_chat_stream
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


def _safe_str(obj: Any) -> str:
    """Convert any object to an ASCII-safe string, replacing non-ASCII characters."""
    return str(obj).encode("ascii", errors="replace").decode("ascii")

# Built-in Agent definitions
# avatar_url values must be absolute CDN URLs matching the frontend AVATAR_URLS
# in app/frontend/src/types/agent.ts to prevent broken avatars
BUILTIN_AGENTS = [
    {
        "id": "mike",
        "name": "Mike",
        "role": "Team Leader",
        "avatar_color": "from-orange-400 to-amber-500",
        "avatar_url": "https://mgx-backend-cdn.metadl.com/generate/images/1263427/2026-05-24/pfidnuqaagta/avatar-mike-team-leader.png",
        "skills": ["任务分解", "团队协调", "需求分析"],
        "is_builtin": True,
    },
    {
        "id": "alex",
        "name": "Alex",
        "role": "Engineer",
        "avatar_color": "from-blue-500 to-blue-600",
        "avatar_url": "https://mgx-backend-cdn.metadl.com/generate/images/1263427/2026-05-24/pfidoxqaagra/avatar-alex-engineer.png",
        "skills": ["代码开发", "Bug修复", "部署"],
        "is_builtin": True,
    },
    {
        "id": "emma",
        "name": "Emma",
        "role": "Product Manager",
        "avatar_color": "from-pink-400 to-rose-500",
        "avatar_url": "https://mgx-backend-cdn.metadl.com/generate/images/1263427/2026-05-24/pfidmfqaagsq/avatar-emma-product-manager.png",
        "skills": ["PRD", "竞品分析", "用户研究"],
        "is_builtin": True,
    },
]

AGENT_PROMPTS = {
    "mike": """你是 Mike，一个帮用户实现想法的助手。
你的工作方式：
1. 听明白用户想要什么
2. 判断需求是否明确：不明确就追问，明确了就分配任务
3. 把任务分给合适的团队成员
4. 大家完成后，把结果整理给用户

团队里有 Alex（写代码）、Emma（规划功能）。
跟你沟通的是普通用户，请用大白话。

注意：每次用户发来新消息，都是一个独立的新需求，你需要重新分析并分配任务。""",

    "alex": """你是 Alex，Atoms 团队的全栈工程师。
你的职责是：
1. 根据需求编写高质量代码（HTML/CSS/JS/React/Python）
2. 修复 Bug 和优化性能
3. 部署应用

输出代码时使用 markdown 代码块（```html、```css、```javascript）。
请确保代码完整、可运行、有良好的注释。

注意：最终必须输出一个完整的 HTML 文件（```html ... ```），
因为系统需要通过 HTML 文件来预览你的成果。""",

    "emma": """你是 Emma，Atoms 团队的产品经理。
你的职责是：
1. 分析用户需求，输出 PRD
2. 进行竞品分析和市场调研
3. 定义产品功能和优先级
4. 设计用户流程和交互方案""",
}

class AgentOrchestrator:
    """Multi-Agent collaboration coordinator."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_available_agents(self, user_id: str) -> List[Dict[str, Any]]:
        """Get built-in + user-defined custom agents."""
        agents = list(BUILTIN_AGENTS)
        # TODO: Query custom_agents table for user-defined agents and append
        return agents

    async def chat_with_agent(
        self,
        agent_id: str,
        messages: List[Dict[str, str]],
        user_id: str,
    ) -> str:
        """Send message to a specific agent and get response."""
        agent = self._get_agent(agent_id)
        if not agent:
            raise ValueError(f"Agent '{agent_id}' not found")

        system_prompt = AGENT_PROMPTS.get(agent_id, f"你是 {agent['name']}，{agent['role']}。")
        full_messages = [
            {"role": "system", "content": system_prompt},
            *messages,
        ]

        return await proxy_chat(
            messages=full_messages,
            model="deepseek-chat",
        )

    async def chat_with_agent_stream(
        self,
        agent_id: str,
        messages: List[Dict[str, str]],
        user_id: str,
    ):
        """Send message to a specific agent and stream the response."""
        agent = self._get_agent(agent_id)
        if not agent:
            raise ValueError(f"Agent '{agent_id}' not found")

        system_prompt = AGENT_PROMPTS.get(agent_id, f"你是 {agent['name']}，{agent['role']}。")
        full_messages = [
            {"role": "system", "content": system_prompt},
            *messages,
        ]

        async for token in proxy_chat_stream(
            messages=full_messages,
            model="deepseek-chat",
        ):
            yield token

    async def team_chat_stream(self, messages: List[Dict[str, str]], user_id: str):
        """
        Single-phase team chat: Mike analyzes, then auto-executes tasks.

        Flow: Analyze → (NeedClarify → Done) | (Execute tasks → Summary → Done)
        """
        try:
            yield {"type": "phase", "agent_id": "mike", "status": "analyzing"}

            mike_prompt = self._team_mike_prompt()
            mike_messages = [
                {"role": "system", "content": mike_prompt},
                *messages,
            ]

            mike_full_response = ""
            try:
                async for token in proxy_chat_stream(messages=mike_messages, model="deepseek-chat"):
                    yield {"type": "token", "agent_id": "mike", "token": token}
                    mike_full_response += token
            except Exception as e:
                logger.error(f"Mike analysis stream error: {_safe_str(e)}")
                yield {"type": "error", "error": "生成失败，请稍后重试！"}
                yield {"type": "done"}
                return

            plan = self._extract_json_plan(mike_full_response)

            if plan and plan.get("needs_clarification"):
                yield {"type": "need_clarify", "agent_id": "mike"}
                yield {"type": "done"}
                return

            last_user_msg = messages[-1].get("content", "") if messages else ""
            if not plan or not plan.get("tasks"):
                plan = {
                    "analysis": mike_full_response[:500] if mike_full_response else "",
                    "tasks": [{
                        "agent_id": "alex",
                        "title": "回答用户",
                        "description": last_user_msg,
                    }],
                }

            tasks = plan.get("tasks", [])
            if not isinstance(tasks, list) or len(tasks) == 0:
                tasks = [{
                    "agent_id": "alex",
                    "title": "回答用户",
                    "description": last_user_msg,
                }]

            yield {"type": "plan", "analysis": plan.get("analysis", ""), "tasks": [
                {"agent_id": t.get("agent_id", "alex").lower(), "title": t.get("title", "未知任务"), "task_id": i + 1}
                for i, t in enumerate(tasks)
            ]}

            global_task_id = 0
            all_results = []

            for task in tasks:
                global_task_id += 1
                agent_id = task.get("agent_id", "alex").lower()
                task_title = task.get("title", "未知任务")

                yield {"type": "task_start", "agent_id": agent_id, "task_id": global_task_id,
                       "title": task_title}

                mike_context = plan.get("analysis", "") or mike_full_response[:500]
                task_messages = [
                    *messages,
                    {
                        "role": "user",
                        "content": (
                            f"【团队领导 Mike 的需求分析】\n{mike_context}\n\n"
                            f"【分配给你的任务】\n{task_title}\n{task.get('description', '')}\n\n"
                            f"请根据以上分析，完成你的任务。"
                        ),
                    },
                ]

                agent = self._get_agent(agent_id)
                if not agent:
                    logger.warning(f"Agent '{agent_id}' not found, falling back to 'alex'")
                    agent = self._get_agent("alex")
                    if not agent:
                        yield {"type": "error", "error": f"Agent '{agent_id}' not found and no fallback agent"}
                        continue

                system_prompt = AGENT_PROMPTS.get(agent_id, f"你是 {agent['name']}，{agent['role']}。")
                full_messages = [
                    {"role": "system", "content": system_prompt},
                    *task_messages,
                ]

                agent_content = ""
                try:
                    async for token in proxy_chat_stream(messages=full_messages, model="deepseek-chat"):
                        yield {"type": "token", "agent_id": agent_id, "token": token, "task_id": global_task_id}
                        agent_content += token
                except Exception as e:
                    logger.error(f"Agent {agent_id} stream error: {_safe_str(e)}")
                    yield {"type": "error", "error": f"{agent_id} task failed: {_safe_str(e)}"}

                all_results.append({
                    "agent_id": agent_id,
                    "title": task_title,
                    "result": agent_content,
                    "task_id": global_task_id,
                })
                yield {"type": "task_complete", "agent_id": agent_id,
                       "task_id": global_task_id, "title": task_title}

            yield {"type": "phase", "agent_id": "mike", "status": "summarizing"}
            task_items = "\n".join(f"- **{r['agent_id']}**: {r['title']}" for r in all_results)
            summary = f"## 执行完成\n\n已完成以下任务：\n{task_items}"
            yield {"type": "summary", "agent_id": "mike", "content": summary, "tasks": all_results}
            yield {"type": "done"}
        except Exception as e:
            logger.error(f"Team chat stream unexpected error: {_safe_str(e)}", exc_info=True)
            yield {"type": "error", "error": "团队协作遇到意外错误，请重试"}
            yield {"type": "done"}

    def _team_mike_prompt(self) -> str:
        """Build the team-mode prompt for Mike with JSON output instruction."""
        agent_list = "\n".join(
            f'  - {a["id"]}: {a["role"]}（{", ".join(a["skills"])}）'
            for a in BUILTIN_AGENTS if a["id"] != "mike"
        )
        return AGENT_PROMPTS["mike"] + f"""

请用通俗易懂的语言分析用户的需求，然后从以下团队成员中选择合适的人来执行。

可用团队成员：
{agent_list}

**判断规则：**
当需求不够明确（缺少具体信息、无法确定技术方案、信息不足以分配任务）时，
先在 analysis 中追问用户，设置 needs_clarification=true，不输出 tasks。

当需求明确时，设置 needs_clarification=false，并输出 tasks。

**任务分配规则：**
- Emma 在需要需求分析/功能规划时参与（agent_id="emma"），排在 Alex 前面
- Alex 负责编码实现（agent_id="alex"），排在最后
- 简单技术问答只需 Alex

**输出 JSON 格式：**

{{
  "needs_clarification": false,
  "analysis": "需求分析（大白话）",
  "tasks": [
    {{ "agent_id": "emma", "title": "需求分析", "description": "分析需求，梳理功能和交互流程" }},
    {{ "agent_id": "alex", "title": "实现代码", "description": "根据分析编写代码" }}
  ]
}}

或（需求不明确时）：

{{
  "needs_clarification": true,
  "analysis": "追问用户的具体问题..."
}}

**字段说明：**
- needs_clarification：boolean，是否需要用户补充信息
- analysis：需求分析（需求明确时）或追问内容（需求不明确时）
- tasks：任务列表，emma 在前（如有）alex 在后
- agent_id：必须全小写 "emma" 或 "alex"
- title：任务简短标题，控制在 10 字以内
- description：任务详细描述
"""

    def _extract_json_plan(self, raw: str) -> Optional[Dict[str, Any]]:
        """Extract a JSON task plan from Mike's raw response."""
        plan = self._try_parse_json(raw)
        if plan is None or not isinstance(plan, dict):
            return None
        # Normalize tasks: ensure every task has agent_id and title
        tasks = plan.get("tasks", [])
        if isinstance(tasks, list):
            normalized = []
            for task in tasks:
                if not isinstance(task, dict):
                    continue
                # Accept common title variants
                title = task.get("title") or task.get("name") or task.get("task") or task.get("task_name") or ""
                # Accept common agent_id variants (lowercase to match BUILTIN_AGENTS)
                _agent_id_raw = (
                    task.get("agent_id")
                    or task.get("agentId")
                    or task.get("agent")
                    or task.get("assignee")
                    or task.get("member")
                    or "alex"
                )
                agent_id = str(_agent_id_raw).lower() if _agent_id_raw else "alex"
                # Accept common description variants
                description = (
                    task.get("description")
                    or task.get("desc")
                    or task.get("detail")
                    or task.get("details")
                    or task.get("content")
                    or ""
                )
                normalized.append({
                    "agent_id": agent_id,
                    "title": title,
                    "description": description,
                })
            plan["tasks"] = normalized
        return plan

    def _try_parse_json(self, raw: str) -> Optional[Dict[str, Any]]:
        """Try multiple strategies to extract a JSON dict from Mike's response."""
        raw_stripped = raw.strip()
        # Strategy 1: direct parse
        try:
            result = json.loads(raw_stripped)
            if isinstance(result, dict):
                return result
        except json.JSONDecodeError:
            pass
        # Strategy 2: extract from ```json ... ``` or ``` ... ``` blocks
        import re
        code_block = re.search(r'```(?:json)?\s*\n?(.*?)```', raw_stripped, re.DOTALL)
        if code_block:
            try:
                result = json.loads(code_block.group(1).strip())
                if isinstance(result, dict):
                    return result
            except json.JSONDecodeError:
                pass
        # Strategy 3: find first { ... } pair at the right nesting level
        brace_start = raw_stripped.find('{')
        if brace_start >= 0:
            depth = 0
            for i in range(brace_start, len(raw_stripped)):
                ch = raw_stripped[i]
                if ch == '{':
                    depth += 1
                elif ch == '}':
                    depth -= 1
                    if depth == 0:
                        candidate = raw_stripped[brace_start:i + 1]
                        try:
                            result = json.loads(candidate)
                            if isinstance(result, dict):
                                return result
                        except json.JSONDecodeError:
                            break
        return None

    def _get_agent(self, agent_id: str) -> Optional[Dict[str, Any]]:
        agent_id_lower = agent_id.lower()
        for agent in BUILTIN_AGENTS:
            if agent["id"] == agent_id_lower:
                return agent
        return None
