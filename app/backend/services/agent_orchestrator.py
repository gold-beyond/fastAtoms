"""Agent Orchestrator — multi-agent collaboration coordinator."""
import json
import logging
from typing import Any, Dict, List, Optional

from schemas.agents import AgentResponse, CustomAgentCreate
from services.ai_proxy import proxy_chat, proxy_chat_stream
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

# Built-in Agent definitions
BUILTIN_AGENTS = [
    {
        "id": "mike",
        "name": "Mike",
        "role": "Team Leader",
        "avatar_color": "from-orange-400 to-amber-500",
        "avatar_url": "/avatars/mike.svg",
        "skills": ["任务分解", "团队协调", "需求分析"],
        "is_builtin": True,
    },
    {
        "id": "alex",
        "name": "Alex",
        "role": "Engineer",
        "avatar_color": "from-blue-500 to-blue-600",
        "avatar_url": "/avatars/alex.svg?v=12",
        "skills": ["代码开发", "Bug修复", "部署"],
        "is_builtin": True,
    },
    {
        "id": "emma",
        "name": "Emma",
        "role": "Product Manager",
        "avatar_color": "from-pink-400 to-rose-500",
        "avatar_url": "/avatars/emma.svg?v=2",
        "skills": ["PRD", "竞品分析", "用户研究"],
        "is_builtin": True,
    },
]

AGENT_PROMPTS = {
    "mike": """你是 Mike，一个帮用户实现想法的助手。
你的工作方式：
1. 听明白用户想要什么
2. 想清楚需要谁来做（你是一个小团队的负责人）
3. 把任务分给合适的人
4. 等大家完成后，把结果整理给用户

团队里有 Alex（写代码）、Emma（规划功能）。
跟你沟通的是普通用户，不是什么技术人员，所以请用大白话。""",

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

    async def team_chat(
        self,
        messages: List[Dict[str, str]],
        user_id: str,
    ) -> Dict[str, Any]:
        """
        Team Mode: Mike acts as coordinator (non-streaming).
        1. Mike analyzes requirements and assigns tasks
        2. Each agent executes their task
        3. Mike summarizes results
        """
        mike_response = ""
        mike_prompt = self._team_mike_prompt()
        mike_messages = [
            {"role": "system", "content": mike_prompt},
            *messages,
        ]

        async for token in proxy_chat_stream(messages=mike_messages, model="deepseek-chat"):
            mike_response += token

        return await self._build_team_result(mike_response, messages, user_id)

    async def team_chat_stream(self, messages: List[Dict[str, str]], user_id: str):
        """
        Loop state machine: Analyze → Execute → Observe → (repeat) → Done.

        Max 3 iterations. Each iteration Mike sees original request + all previous
        results, and decides whether to assign more tasks or declare completion.

        Yields dicts with keys:
          - type: "phase" | "token" | "plan" | "task_start" | "task_complete" | "summary" | "done" | "error"
          - Plus agent_id, token, task_id, title, iteration, etc.
        """
        MAX_ITERATIONS = 3
        all_results: List[Dict] = []          # Accumulated across all iterations
        iteration_analyses: List[str] = []    # Mike's analysis per iteration
        global_task_id = 0

        for iteration in range(1, MAX_ITERATIONS + 1):
            # ── Phase 1: Analyze ──────────────────────────────────
            yield {"type": "phase", "agent_id": "mike", "status": "analyzing", "iteration": iteration}

            mike_prompt = self._team_mike_prompt()
            # Build context: original messages + previous iteration results
            context_messages = list(messages)
            if all_results:
                prev_summary_lines = []
                for r in all_results:
                    prev_summary_lines.append(
                        f"### 第 {r['iteration']} 轮 - {r['agent_id']} - {r['title']}\n{r['result']}"
                    )
                context_messages.append({
                    "role": "user",
                    "content": (
                        f"以下是之前轮次已完成的工作，请在此基础上继续分析，"
                        f"判断需求是否已全部满足。如果已完成，请输出 direct_response 表示结束。\n\n"
                        + "\n\n".join(prev_summary_lines)
                    ),
                })

            mike_messages = [
                {"role": "system", "content": mike_prompt},
                *context_messages,
            ]

            mike_full_response = ""
            try:
                async for token in proxy_chat_stream(messages=mike_messages, model="deepseek-chat"):
                    yield {"type": "token", "agent_id": "mike", "token": token}
                    mike_full_response += token
            except Exception as e:
                logger.error(f"Mike analysis stream error (iter {iteration}): {e}")
                yield {"type": "error", "error": f"Mike 分析失败: {e}"}
                yield {"type": "done"}
                return

            iteration_analyses.append(mike_full_response)

            # ── Phase 2: Parse plan ───────────────────────────────
            plan = self._extract_json_plan(mike_full_response)

            # Check termination conditions
            if plan is None:
                # Can't parse JSON — treat as final direct response
                yield {"type": "summary", "agent_id": "mike", "content": mike_full_response}
                break

            if plan.get("direct_response"):
                yield {"type": "summary", "agent_id": "mike", "content": plan["direct_response"]}
                break

            tasks = plan.get("tasks", [])
            if not tasks:
                # No tasks assigned — work is complete
                yield {"type": "summary", "agent_id": "mike", "content": mike_full_response}
                break

            # ── Phase 3: Execute tasks ────────────────────────────
            yield {"type": "plan", "analysis": plan.get("analysis", ""), "tasks": [
                {"agent_id": t["agent_id"], "title": t["title"], "task_id": i + 1}
                for i, t in enumerate(tasks)
            ], "iteration": iteration}

            iteration_results = []
            for task in tasks:
                global_task_id += 1
                agent_id = task["agent_id"]
                task_title = task["title"]

                yield {"type": "task_start", "agent_id": agent_id, "task_id": global_task_id,
                       "title": task_title, "iteration": iteration}

                # Build task context with Mike's analysis + all previous global results
                mike_context = plan.get("analysis", "") or mike_full_response[:500]
                task_messages = [
                    *messages,
                    {
                        "role": "user",
                        "content": (
                            f"【团队领导 Mike 的需求分析】\n{mike_context}\n\n"
                            f"【分配给你的任务】\n{task['title']}\n{task.get('description', '')}\n\n"
                            f"请根据以上分析，完成你的任务。"
                        ),
                    },
                ]

                agent = self._get_agent(agent_id)
                if not agent:
                    # Fallback: try to find the closest match or default to alex
                    logger.warning(f"Agent '{agent_id}' not found, falling back to 'alex'")
                    agent = self._get_agent("alex")
                    if not agent:
                        yield {"type": "error", "error": f"Agent '{agent_id}' 未找到，且无备用 Agent"}
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
                    logger.error(f"Agent {agent_id} stream error (iter {iteration}): {e}")
                    yield {"type": "error", "error": f"{agent_id} 执行任务失败: {e}"}

                result_entry = {
                    "iteration": iteration,
                    "agent_id": agent_id,
                    "title": task_title,
                    "result": agent_content,
                    "task_id": global_task_id,
                }
                iteration_results.append(result_entry)
                all_results.append(result_entry)
                yield {"type": "task_complete", "agent_id": agent_id,
                       "task_id": global_task_id, "title": task_title}

            # ── Phase 4: Observe — loop continues to next iteration ──
            yield {"type": "phase", "agent_id": "mike", "status": "observing", "iteration": iteration}

        else:
            # Loop completed all MAX_ITERATIONS without break → unfinished
            summary = "已达到最大迭代次数，请检查当前成果，如有需要可重新提问。\n\n已完成工作：\n"
            for r in all_results:
                summary += f"\n### 第 {r['iteration']} 轮 - {r['agent_id']} - {r['title']}"
            yield {"type": "summary", "agent_id": "mike", "content": summary}

        yield {"type": "done"}

    async def team_plan_stream(self, messages: List[Dict[str, str]], user_id: str):
        """
        Phase 1: Mike analyzes the request and produces a task plan.
        Yields events up to the plan, then stops — no task execution.
        User reviews the plan and may modify it before execution.
        """
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
            logger.error(f"Mike plan stream error: {e}")
            yield {"type": "error", "error": f"Mike 分析失败: {e}"}
            yield {"type": "done"}
            return

        plan = self._extract_json_plan(mike_full_response)
        if plan is None:
            # Direct response — no tasks to plan
            yield {"type": "summary", "agent_id": "mike", "content": mike_full_response}
            yield {"type": "done"}
            return

        if plan.get("direct_response"):
            yield {"type": "summary", "agent_id": "mike", "content": plan["direct_response"]}
            yield {"type": "done"}
            return

        # Yield the plan for user review
        tasks = plan.get("tasks", [])
        yield {
            "type": "plan",
            "analysis": plan.get("analysis", mike_full_response[:500]),
            "tasks": [
                {"agent_id": t["agent_id"], "title": t["title"], "description": t.get("description", ""), "task_id": i + 1}
                for i, t in enumerate(tasks)
            ],
            "requires_review": True,
        }
        yield {"type": "done"}

    async def team_execute_stream(self, messages: List[Dict[str, str]], plan: Dict[str, Any], user_id: str):
        """
        Phase 2: Execute the user-confirmed plan.
        Takes a plan dict with tasks array, streams each agent's work.
        """
        tasks = plan.get("tasks", [])
        if not tasks:
            yield {"type": "summary", "agent_id": "mike", "content": "没有需要执行的任务。"}
            yield {"type": "done"}
            return

        yield {"type": "phase", "agent_id": "mike", "status": "executing"}
        global_task_id = 0
        all_results = []

        for task in tasks:
            global_task_id += 1
            agent_id = task["agent_id"]
            task_title = task["title"]

            yield {"type": "task_start", "agent_id": agent_id, "task_id": global_task_id,
                   "title": task_title}

            # Build task context: user messages + extra instructions + previous results
            user_extra = plan.get("extra_instructions", "")
            task_messages = list(messages)
            extra_parts = [f"【分配给你的任务】\n{task_title}"]
            if task.get("description"):
                extra_parts.append(task.get("description", ""))

            # Pass summarized previous results — full content is too verbose
            if all_results:
                prev_summaries = []
                for r in all_results:
                    # Extract key info: first 200 chars + code block filenames
                    result = r['result']
                    summary = result[:200] if len(result) > 200 else result
                    # Find code block filenames (e.g., ```html → index.html)
                    code_files = []
                    import re
                    for m in re.finditer(r'```(\w+)', result):
                        lang = m.group(1).lower()
                        fname = f"{lang}" if lang in ('html','css','javascript') else f"*.{lang}"
                        code_files.append(fname)
                    files_hint = f" (包含文件: {', '.join(code_files)})" if code_files else ""
                    prev_summaries.append(
                        f"### {r['agent_id']} 已完成 - {r['title']}{files_hint}\n{summary}{'...' if len(result) > 200 else ''}"
                    )
                extra_parts.append(f"\n【其他成员完成摘要】\n" + "\n\n".join(prev_summaries))

            if user_extra:
                extra_parts.append(f"【补充说明】\n{user_extra}")
            task_messages.append({"role": "user", "content": "\n".join(extra_parts)})

            agent = self._get_agent(agent_id)
            if not agent:
                logger.warning(f"Agent '{agent_id}' not found, falling back to 'alex'")
                agent = self._get_agent("alex")
                if not agent:
                    yield {"type": "error", "error": f"Agent '{agent_id}' 未找到"}
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
                logger.error(f"Agent {agent_id} execute error: {e}")
                yield {"type": "error", "error": f"{agent_id} 执行任务失败: {e}"}

            all_results.append({"agent_id": agent_id, "title": task_title, "result": agent_content})
            yield {"type": "task_complete", "agent_id": agent_id,
                   "task_id": global_task_id, "title": task_title}

        # Summary
        yield {"type": "phase", "agent_id": "mike", "status": "summarizing"}
        task_items = "\n".join(f"- **{r['agent_id']}**: {r['title']}" for r in all_results)
        summary = f"## 执行完成\n已完成以下任务：\n{task_items}"
        yield {"type": "summary", "agent_id": "mike", "content": summary, "tasks": all_results}
        yield {"type": "done"}

    def _team_mike_prompt(self) -> str:
        """Build the team-mode prompt for Mike with JSON output instruction."""
        # List available agents for Mike to choose from
        agent_list = "\n".join(
            f'  - {a["id"]}: {a["role"]}（{", ".join(a["skills"])}）'
            for a in BUILTIN_AGENTS if a["id"] != "mike"
        )
        return AGENT_PROMPTS["mike"] + f"""

请用通俗易懂的语言分析用户的需求，然后从以下团队成员中选择合适的人来执行。

可用团队成员：
{agent_list}

**输出规则（必须遵守）：**
1. 用大白话写 analysis
2. tasks 数组里放需要执行的任务
3. tasks 中一定要有 Alex 的条目（他来写代码），放在最后
4. 如果需求很简单（如小游戏、单页面），tasks 只需要 Alex 一个人就够了，最多再加一个 Emma

注意：如果不需要分配任务（用户只是提问或需求已全部完成），用 direct_response 直接回复。
"""

    async def _build_team_result(
        self, mike_response: str, messages: List[Dict[str, str]], user_id: str
    ) -> Dict[str, Any]:
        """Non-streaming: parse Mike's JSON plan, execute tasks, return result dict."""
        plan = self._extract_json_plan(mike_response)
        if plan is None:
            return {"content": mike_response, "agent_id": "mike", "tasks": []}
        if plan.get("direct_response"):
            return {"content": plan["direct_response"], "agent_id": "mike", "tasks": []}

        results = []
        for idx, task in enumerate(plan.get("tasks", [])):
            agent_id = task["agent_id"]
            task_messages = [
                *messages,
                {
                    "role": "user",
                    "content": f"请完成以下任务：{task['title']}\n{task.get('description', '')}",
                },
            ]
            result = await self.chat_with_agent(agent_id, task_messages, user_id)
            results.append({"agent_id": agent_id, "title": task["title"], "result": result, "task_id": idx + 1})

        summary_content = f"任务分析：{plan.get('analysis', '')}\n\n各成员产出：\n"
        for r in results:
            summary_content += f"\n### {r['agent_id']} - {r['title']}\n{r['result']}\n"

        return {
            "content": summary_content,
            "agent_id": "mike",
            "tasks": results,
        }

    def _extract_json_plan(self, raw: str) -> Optional[Dict[str, Any]]:
        """Extract a JSON task plan from Mike's raw response.

        Tries, in order:
        1. Direct json.loads() on the full text
        2. Find JSON inside ```json ... ``` code blocks
        3. Find JSON between { and } at the outer level
        """
        # Strategy 1: direct parse
        raw_stripped = raw.strip()
        try:
            return json.loads(raw_stripped)
        except json.JSONDecodeError:
            pass

        # Strategy 2: extract from ```json ... ``` or ``` ... ``` blocks
        import re
        code_block = re.search(r'```(?:json)?\s*\n?(.*?)```', raw_stripped, re.DOTALL)
        if code_block:
            try:
                return json.loads(code_block.group(1).strip())
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
                            return json.loads(candidate)
                        except json.JSONDecodeError:
                            break
        return None

    def _get_agent(self, agent_id: str) -> Optional[Dict[str, Any]]:
        for agent in BUILTIN_AGENTS:
            if agent["id"] == agent_id:
                return agent
        return None
