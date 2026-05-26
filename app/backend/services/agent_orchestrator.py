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
    "mike": """你是 Mike，团队协调者。你只负责分析和分配任务，绝不自己写代码。

你的唯一职责：
1. 理解用户的需求
2. 判断需求是否明确：不明确就追问，明确了就分配任务给团队成员
3. 任务分配给团队成员后，由他们去执行，你不要插手
4. 团队成员完成后，你把结果整理汇总给用户

团队成员分工：
- Emma：产品经理，负责需求分析、功能规划、PRD
- Alex：全栈工程师，负责写代码、Bug修复、部署

重要约束：
- 你绝对不能自己写代码，写代码是 Alex 的工作
- 你绝对不能自己设计功能，设计功能是 Emma 的工作
- 你的输出必须是纯 JSON，不要输出任何其他内容
- 分析内容写在 JSON 的 analysis 字段里

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
4. 设计用户流程和交互方案

重要约束：
- 请使用 Markdown 格式输出你的分析内容，不要生成任何代码块
- 你的输出应该是自然语言的产品需求说明，包含：需求理解、目标用户、功能列表、用户流程、建议
- 不要写任何代码，代码是 Alex 的工作""",
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
            model="deepseek-v4-flash",
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
            model="deepseek-v4-flash",
        ):
            yield token

    async def team_chat_stream(self, messages: List[Dict[str, str]], user_id: str):
        """
        Two-phase team chat: Mike thinks in natural language (streamed),
        then distills into JSON plan (non-streamed), then auto-executes tasks.

        Flow: Think → Plan → (NeedClarify → Done) | (Execute tasks → Done)
        """
        try:
            yield {"type": "phase", "agent_id": "mike", "status": "thinking"}
            all_results = []
            thinking_prompt = self._team_mike_thinking_prompt()
            thinking_messages = [
                {"role": "system", "content": thinking_prompt},
                *messages,
            ]

            mike_thinking = ""
            try:
                async for token in proxy_chat_stream(
                    messages=thinking_messages,
                    model="deepseek-v4-flash",
                ):
                    yield {"type": "token", "agent_id": "mike", "token": token}
                    mike_thinking += token
            except Exception as e:
                logger.error(f"Mike thinking stream error: {_safe_str(e)}")
                yield {"type": "error", "error": "系统异常，请稍后重试。"}
                yield {"type": "done"}
                return

            yield {"type": "phase", "agent_id": "mike", "status": "planning"}

            plan_prompt = self._team_mike_prompt()
            plan_messages = [
                {"role": "system", "content": plan_prompt},
                *messages,
                {"role": "user", "content": f"你刚才的分析如下，请据此生成 JSON 计划：\n\n{mike_thinking}"},
            ]

            mike_full_response = ""
            try:
                mike_full_response = await proxy_chat(
                    messages=plan_messages,
                    model="deepseek-v4-flash",
                    response_format={"type": "json_object"},
                )
                if not mike_full_response or not mike_full_response.strip():
                    logger.warning("Mike plan generation returned empty, retrying once")
                    mike_full_response = await proxy_chat(
                        messages=plan_messages,
                        model="deepseek-v4-flash",
                        response_format={"type": "json_object"},
                    )
            except Exception as e:
                logger.error(f"Mike plan generation error: {_safe_str(e)}")
                yield {"type": "error", "error": "系统异常，请稍后重试。"}
                yield {"type": "done"}
                return

            plan = self._extract_json_plan(mike_full_response)
            if not plan:
                logger.warning(f"Mike JSON extraction failed, raw response (first 300 chars): {_safe_str(mike_full_response[:300])}")

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

            seen_agents: set = set()
            deduped_tasks = []
            default_titles = {"emma": "需求分析", "alex": "实现代码"}
            for t in tasks:
                agent_id = t.get("agent_id", "alex").lower()
                if agent_id not in ["emma", "alex"]:
                    logger.warning(f"Unknown agent_id '{agent_id}' in plan, skipping task")
                    continue
                title = t.get("title", "") or ""
                # 如果标题为空，使用默认标题
                if not title.strip():
                    title = default_titles.get(agent_id, "执行任务")
                    t["title"] = title
                if agent_id in seen_agents:
                    continue
                seen_agents.add(agent_id)
                deduped_tasks.append(t)

            # 强制确保有 Emma 和 Alex，顺序固定 Emma → Alex
            required_agents = ["emma", "alex"]
            final_tasks = []
            for agent_id in required_agents:
                existing_task = next((t for t in deduped_tasks if t.get("agent_id", "").lower() == agent_id), None)
                if existing_task:
                    final_tasks.append(existing_task)
                else:
                    # 如果缺失，添加默认任务
                    final_tasks.append({
                        "agent_id": agent_id,
                        "title": default_titles[agent_id],
                        "description": last_user_msg
                    })
            tasks = final_tasks

            yield {"type": "plan", "analysis": plan.get("analysis", ""), "tasks": [
                {"agent_id": t.get("agent_id", "alex").lower(), "title": t.get("title", "未知任务"), "task_id": i + 1}
                for i, t in enumerate(tasks)
            ]}

            global_task_id = 0

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
                    async for token in proxy_chat_stream(messages=full_messages, model="deepseek-v4-flash"):
                        yield {"type": "token", "agent_id": agent_id, "token": token, "task_id": global_task_id}
                        agent_content += token
                except Exception as e:
                    logger.error(f"Agent {agent_id} stream error: {_safe_str(e)}")
                    yield {"type": "error", "error": "系统异常，请稍后重试。"}

                all_results.append({
                    "agent_id": agent_id,
                    "title": task_title,
                    "result": agent_content,
                    "task_id": global_task_id,
                })
                yield {"type": "task_complete", "agent_id": agent_id,
                       "task_id": global_task_id, "title": task_title}

            yield {"type": "done"}
        except Exception as e:
            completed_agents = [r["agent_id"] for r in all_results]
            logger.error(
                f"Team chat stream unexpected error: {_safe_str(e)} | "
                f"completed_tasks={len(all_results)} agents={completed_agents}",
                exc_info=True,
            )
            yield {"type": "error", "error": "系统异常，请稍后重试。"}
            yield {"type": "done"}

    def _team_mike_thinking_prompt(self) -> str:
        """Build the thinking prompt for Mike - natural language analysis."""
        return """你是 Mike，团队协调者。现在用户向你提出了一个需求，请你先仔细思考分析：

1. 用户到底想要什么？用简单的话复述一下
2. 这个需求有哪些关键点需要注意？
3. Emma 需要分析哪些方面？Alex 需要实现什么？

记住：每个需求都需要 Emma 先做需求分析，Alex 再根据 Emma 的分析实现代码。

请用简短的自然语言输出你的思考过程，就像你在自言自语梳理问题。
不要写代码，不要用 JSON 格式，不要长篇大论。"""

    def _team_mike_prompt(self) -> str:
        """Build the team-mode prompt for Mike with JSON output instruction."""
        agent_list = "\n".join(
            f'  - {a["id"]}: {a["role"]}（{", ".join(a["skills"])}）'
            for a in BUILTIN_AGENTS if a["id"] != "mike"
        )
        return AGENT_PROMPTS["mike"] + f"""

**你必须严格按照以下 JSON 格式输出，不要输出任何 JSON 以外的内容，不要写代码：**

需求明确时：
{{
  "needs_clarification": false,
  "analysis": "用通俗易懂的大白话分析用户需求",
  "tasks": [
    {{ "agent_id": "emma", "title": "需求分析", "description": "分析需求，梳理功能和交互流程" }},
    {{ "agent_id": "alex", "title": "实现代码", "description": "根据 Emma 的分析结果编写完整代码" }}
  ]
}}

需求不明确时（缺少具体信息、无法确定技术方案）：
{{
  "needs_clarification": true,
  "analysis": "向用户追问的具体问题..."
}}

可用团队成员：
{agent_list}

任务分配规则：
- 每个需求都必须先分配 Emma（agent_id="emma"）做需求分析，再分配 Alex（agent_id="alex"）实现代码
- 顺序固定：Emma 在前，Alex 在后，必须两个都有
- agent_id 必须全小写 "emma" 或 "alex"
- 每个 agent 最多出现一次，不要重复分配同一个 agent 的多个任务
- title 必须填写，控制在 10 字以内，不能为空
- Alex 的 description 要包含 Emma 的分析结果

再次强调：你的输出只能是上述 JSON 格式，不要写任何代码或额外文字。
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
                title = task.get("title") or task.get("name") or task.get("task") or task.get("task_name") or ""
                _agent_id_raw = (
                    task.get("agent_id")
                    or task.get("agentId")
                    or task.get("agent")
                    or task.get("assignee")
                    or task.get("member")
                    or "alex"
                )
                agent_id = str(_agent_id_raw).lower() if _agent_id_raw else "alex"
                if not title.strip():
                    default_titles = {"emma": "需求分析", "alex": "实现代码"}
                    title = default_titles.get(agent_id, "执行任务")
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
