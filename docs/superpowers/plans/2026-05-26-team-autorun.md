# 团队协作自动执行 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 去掉团队协作的"执行计划审核"环节，Mike 分析后直接自动分配并执行任务

**架构：** 将 `team_plan_stream` + `team_execute_stream` 两阶段合并为单次 `team_chat_stream` 调用。Mike 分析 → 判断是否追问 → 若明确则直接串行执行（Emma 在前 Alex 在后）→ Mike 汇总

**技术栈：** Python FastAPI (SSE streaming), TypeScript React

---

### 任务 1：删除前端 PlanReview 组件及相关引用

**文件：**
- 删除：`app/frontend/src/components/PlanReview.tsx`
- 修改：`app/frontend/src/components/ChatPanel.tsx`

- [ ] **步骤 1：删除 PlanReview.tsx 文件**

- [ ] **步骤 2：删除 ChatPanel.tsx 中的 PlanReview import**

- [ ] **步骤 3：删除 PlanReview 渲染和 planData 相关状态**

- [ ] **步骤 4：删除 handleTeamExecute 方法**

- [ ] **步骤 5：删除 planExecutedRef 相关逻辑（planData 相关状态后续任务用新方式处理）**

---

### 任务 2：更新后端 Mike Prompt（支持 needs_clarification）

**文件：**
- 修改：`app/backend/services/agent_orchestrator.py` (lines 451-506)

- [ ] **步骤 1：重写 `_team_mike_prompt` 方法**

将现有 prompt 替换为支持 `needs_clarification` 的版本：

```python
def _team_mike_prompt(self) -> str:
    agent_list = "\n".join(
        f'  - {a["id"]}: {a["role"]}（{", ".join(a["skills"])}）'
        for a in BUILTIN_AGENTS if a["id"] != "mike"
    )
    return AGENT_PROMPTS["mike"] + f"""

请用通俗易懂的语言分析用户的需求，然后从以下团队成员中选择合适的人来执行。

可用团队成员：
{agent_list}

**判断规则：**
当需求不够明确（缺少具体信息、无法确定技术方案）时，先在 analysis 中追问用户，
设置 needs_clarification=true，不输出 tasks。

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
- analysis：需求分析或追问内容
- tasks：任务列表，emma 在前（如有）alex 在后
- agent_id：必须全小写 "emma" 或 "alex"
"""
```

- [ ] **步骤 2：更新 `AGENT_PROMPTS["mike"]`全局常量**

将第 51-63 行的 Mike prompt 更新为简短版，详细规则由 `_team_mike_prompt` 动态拼接：

```python
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
    # ... alex and emma prompts unchanged
}
```

---

### 任务 3：重写 `team_chat_stream` 方法（单阶段自动执行）

**文件：**
- 修改：`app/backend/services/agent_orchestrator.py` (lines 165-305)

- [ ] **步骤 1：用新版本替换整个 `team_chat_stream` 方法**

```python
async def team_chat_stream(self, messages: List[Dict[str, str]], user_id: str):
    """
    Single-phase team chat: Mike analyzes, then auto-executes tasks.
    
    Flow: Analyze → (NeedClarify → Done) | (Execute tasks → Summary → Done)
    """
    # ── Phase 1: Mike analyzes ──
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
        logger.error(f"Mike analysis stream error: {e}")
        yield {"type": "error", "error": "生成失败，请稍后重试！"}
        yield {"type": "done"}
        return

    # ── Phase 2: Parse plan ──
    plan = self._extract_json_plan(mike_full_response)

    # Needs clarification — Mike just asked a question, stop here
    if plan and plan.get("needs_clarification"):
        yield {"type": "need_clarify", "agent_id": "mike"}
        yield {"type": "done"}
        return

    # Fallback: no valid plan or no tasks → synthesize Alex-only plan
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

    # Yield plan to frontend
    yield {"type": "plan", "analysis": plan.get("analysis", ""), "tasks": [
        {"agent_id": t.get("agent_id", "alex").lower(), "title": t.get("title", "未知任务"), "task_id": i + 1}
        for i, t in enumerate(tasks)
    ]}

    # ── Phase 3: Execute tasks (Emma first, then Alex) ──
    global_task_id = 0
    all_results = []

    for task in tasks:
        global_task_id += 1
        agent_id = task.get("agent_id", "alex").lower()
        task_title = task.get("title", "未知任务")

        yield {"type": "task_start", "agent_id": agent_id, "task_id": global_task_id,
               "title": task_title}

        # Build task context with Mike's analysis + previous results
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
            logger.error(f"Agent {agent_id} stream error: {e}")
            yield {"type": "error", "error": f"{agent_id} task failed: {_safe_str(e)}"}

        all_results.append({
            "agent_id": agent_id,
            "title": task_title,
            "result": agent_content,
            "task_id": global_task_id,
        })
        yield {"type": "task_complete", "agent_id": agent_id,
               "task_id": global_task_id, "title": task_title}

    # ── Phase 4: Summary ──
    yield {"type": "phase", "agent_id": "mike", "status": "summarizing"}
    task_items = "\n".join(f"- **{r['agent_id']}**: {r['title']}" for r in all_results)
    summary = f"## 执行完成\n已完成以下任务：\n{task_items}"
    yield {"type": "summary", "agent_id": "mike", "content": summary, "tasks": all_results}
    yield {"type": "done"}
```

---

### 任务 4：删除废弃的后端方法

**文件：**
- 修改：`app/backend/services/agent_orchestrator.py`

- [ ] **步骤 1：删除 `team_plan_stream` 方法 (lines 307-361)**

- [ ] **步骤 2：删除 `team_execute_stream` 方法 (lines 363-449)**

- [ ] **步骤 3：删除 `_ensure_plan` 方法 (lines 541-580)**

- [ ] **步骤 4：删除 `_build_team_result` 方法 (lines 508-539)** — 仅被非流式 `team_chat` 使用

- [ ] **步骤 5：删除 `team_chat` 非流式方法 (lines 142-163)** — 非流式 team chat 不再需要

---

### 任务 5：清理后端路由

**文件：**
- 修改：`app/backend/routers/agents.py`

- [ ] **步骤 1：删除 `POST /team/chat` 非流式端点 (lines 120-140)**

- [ ] **步骤 2：删除 `POST /team/plan/stream` 端点 (lines 185-223)**

- [ ] **步骤 3：删除 `POST /team/execute/stream` 端点 (lines 226-265)**

- [ ] **步骤 4：删除 `TeamExecuteRequest` 模型 (lines 24-27)**

- [ ] **步骤 5：移除未使用的 import**

```python
# 删除 TeamChatRequest（仅被已删除的端点使用，team/chat/stream 仍需要它）
# 实际上 team/chat/stream 还使用 TeamChatRequest，所以保留它
# 只删除 TeamExecuteRequest

# 移除 unused import:
# 原 lines 11-15:
from schemas.agents import (
    AgentChatRequest,
    AgentChatResponse,
    AgentListResponse,
    AgentResponse,
    TeamChatRequest,
)
# TeamChatRequest 仍被 team_chat_stream 端点使用，保留
```

检查：`TeamChatRequest` 仍被 `POST /team/chat/stream` 使用，保留。
`TeamExecuteRequest` 和其 import `from pydantic import BaseModel` 中的 `BaseModel` 检查是否仍用于别处。

删除独立 import：
```python
# 删除 line 22-27:
from pydantic import BaseModel

class TeamExecuteRequest(BaseModel):
    """Execute a user-confirmed plan."""
    messages: List[Dict[str, str]]
    plan: Dict[str, Any]
```

---

### 任务 6：重写前端 ChatPanel Team Mode（自动执行）

**文件：**
- 修改：`app/frontend/src/components/ChatPanel.tsx`
- 修改：`app/frontend/src/types/agent.ts`

- [ ] **步骤 1：添加 `need_clarify` 到 `TeamStreamEvent` 类型**

```typescript
// agent.ts, 在 TeamStreamEvent 联合类型中添加:
  | { type: 'need_clarify'; agent_id: string }
```

- [ ] **步骤 2：清理 ChatPanel.tsx — 删除 PlanReview import**

删除 line 13:
```typescript
import PlanReview, { PlanTask } from '@/components/PlanReview';
```

- [ ] **步骤 3：清理 ChatPanel.tsx — 删除 planData、planDataRef 相关状态**

删除 lines 237-243:
```typescript
const [planData, setPlanDataState] = useState<{ analysis: string; tasks: PlanTask[] } | null>(null);
const planDataRef = useRef(planData);
const setPlanData = (data: { analysis: string; tasks: PlanTask[] } | null) => {
    planDataRef.current = data;
    setPlanDataState(data);
};
planDataRef.current = planData;
```

- [ ] **步骤 4：删除 `planExecutedRef` 和相关 buffer 字段**

删除 `planExecutedRef` (line 261):
```typescript
const planExecutedRef = useRef(false);
```

删除 `streamBuffers` 接口中的 `planData` 和 `planExecuted` 字段 (lines 264-269 中的相关字段):
将:
```typescript
const streamBuffers = useRef<Record<string, {
    messages: Message[];
    planData: typeof planData;
    isTyping: boolean;
    teamMessages: Record<string, string>;
    timestamp: string;
    completedAgents: string[];
    planExecuted?: boolean;
}>>({});
```
改为:
```typescript
const streamBuffers = useRef<Record<string, {
    messages: Message[];
    isTyping: boolean;
    teamMessages: Record<string, string>;
    timestamp: string;
    completedAgents: string[];
}>>({});
```

- [ ] **步骤 5：删除 `handleTeamExecute` 方法 (lines 580-744)**

- [ ] **步骤 6：重写 `handleSend` 中 Team Mode 分支 (lines 868-980)**

将整段 Team Mode 代码替换为新的单流版本：

```typescript
      if (workMode === 'team') {
        const teamBaseId = Date.now().toString();
        const teamMessages: Record<string, string> = {};
        const planMsgId = `${teamBaseId}-plan`;

        if (abortRef.current) return;

        setMessages((prev) => [...prev, { id: planMsgId, role: 'assistant', content: '', agentId: 'mike', timestamp: now }]);

        const streamConvId = currentConvIdRef.current || `_team_${teamBaseId}`;
        streamBuffers.current[streamConvId] = {
          messages: [...updatedMessages, { id: planMsgId, role: 'assistant', content: '', agentId: 'mike', timestamp: now }],
          isTyping: true,
          teamMessages: {},
          timestamp: now,
          completedAgents: [],
        };

        let streamDoneHandled = false;

        const finishTeamStream = (finalMsgs?: Message[]) => {
          if (streamDoneHandled) return;
          streamDoneHandled = true;
          const buf = streamBuffers.current[streamConvId];
          const msgs = finalMsgs || (buf ? buf.messages : messagesRef.current);
          if (buf) buf.messages = msgs;
          saveConversation(msgs);
          setIsTyping(false);
          pendingStreamRef.current = null;
        };

        await api.postStream(
          '/api/v1/agents/team/chat/stream',
          { messages: apiMessages.slice(1) },
          {
            onEvent: (event: Record<string, any>) => {
              if (abortRef.current) return;
              const isActiveConv = currentConvIdRef.current === streamConvId;

              switch (event.type) {
                case 'phase':
                  setAgentStatus(event.agent_id || 'mike', 'thinking');
                  break;
                case 'token': {
                  const agId: string = event.agent_id || 'mike';
                  const tId: number | undefined = event.task_id;
                  const key = tId ? `task${tId}` : agId;
                  teamMessages[key] = (teamMessages[key] || '') + (event.token || '');

                  if (isActiveConv) {
                    setMessages((prev) => {
                      const u = [...prev];
                      if (tId) {
                        const idx = u.findIndex((m) => m.taskId === tId && m.role === 'assistant');
                        if (idx >= 0) u[idx] = { ...u[idx], content: teamMessages[key] };
                      } else {
                        const idx = u.findIndex((m) => m.id === planMsgId);
                        if (idx >= 0) u[idx] = { ...u[idx], content: teamMessages[key] };
                      }
                      if (streamBuffers.current[streamConvId]) streamBuffers.current[streamConvId].messages = u;
                      return u;
                    });
                  } else if (streamBuffers.current[streamConvId]) {
                    const buf = streamBuffers.current[streamConvId];
                    if (tId) {
                      const idx = buf.messages.findIndex((m: any) => m.taskId === tId && m.role === 'assistant');
                      if (idx >= 0) buf.messages[idx] = { ...buf.messages[idx], content: teamMessages[key] };
                    } else {
                      const idx = buf.messages.findIndex((m: any) => m.id === planMsgId);
                      if (idx >= 0) buf.messages[idx] = { ...buf.messages[idx], content: teamMessages[key] };
                    }
                  }
                  break;
                }
                case 'plan':
                  // Mike's analysis + task list — update the plan message
                  if (isActiveConv) {
                    const agentLabels: Record<string, string> = { alex: '👨‍💻 Alex(工程师)', emma: '📋 Emma(产品)' };
                    const taskFlow = (event.tasks || []).map((t: any, i: number) => {
                      const who = agentLabels[t.agent_id] || t.agent_id;
                      return `${i + 1}. ${who} — ${t.title}`;
                    }).join('\n');
                    setMessages((prev) => {
                      const u = [...prev];
                      const idx = u.findIndex((m) => m.id === planMsgId);
                      if (idx >= 0) {
                        u[idx] = {
                          ...u[idx],
                          content: `📋 执行计划\n\n${event.analysis || ''}\n\n${taskFlow}`,
                          timestamp: formatTimestamp(),
                        };
                      }
                      if (streamBuffers.current[streamConvId]) streamBuffers.current[streamConvId].messages = u;
                      return u;
                    });
                  }
                  break;
                case 'task_start': {
                  setAgentStatus(event.agent_id, 'thinking');
                  const tId: number = event.task_id || Date.now();
                  teamMessages[`task${tId}`] = '';
                  const msgId = `${teamBaseId}-task${tId}`;
                  const newMsg = { id: msgId, role: 'assistant' as const, content: '', agentId: event.agent_id, taskTitle: event.title || '', taskId: tId, timestamp: formatTimestamp() };

                  if (isActiveConv) {
                    setMessages((prev) => {
                      if (prev.some((m) => m.id === msgId)) return prev;
                      const u = [...prev, newMsg];
                      if (streamBuffers.current[streamConvId]) streamBuffers.current[streamConvId].messages = u;
                      return u;
                    });
                  } else if (streamBuffers.current[streamConvId]) {
                    const buf = streamBuffers.current[streamConvId];
                    if (!buf.messages.some((m: any) => m.id === msgId)) buf.messages.push(newMsg);
                  }
                  break;
                }
                case 'task_complete': {
                  completedAgents.current.add(event.agent_id);
                  setAgentStatus(event.agent_id, 'completed');
                  const agentCode = teamMessages[`task${event.task_id}`] || '';
                  if (agentCode) {
                    const { files, fullHtml } = parseCodeBlocks(agentCode);
                    if (event.agent_id === 'alex') {
                      if (fullHtml) onCodeGenerated?.(files, fullHtml);
                      else if (files.length > 0) onCodeGenerated?.(files, '');
                      else onCodeGenerated?.([], `<html><body><pre>${agentCode}</pre></body></html>`);
                    } else if (files.length > 0) {
                      onCodeGenerated?.(files, '');
                    }
                  }
                  break;
                }
                case 'need_clarify':
                  // Mike asked a question — just end the stream, user will reply
                  finishTeamStream();
                  break;
                case 'summary': {
                  const summaryId = `${teamBaseId}-summary`;
                  const display = processAIResponse(event.content || '');
                  const summaryMsg = { id: summaryId, role: 'assistant' as const, content: event.content || '', displayContent: display, agentId: 'mike', timestamp: formatTimestamp() };
                  if (isActiveConv) {
                    setMessages((prev) => {
                      const filtered = prev.filter((m) => !(m.agentId === 'mike' && m.id.endsWith('-plan')));
                      return [...filtered, summaryMsg];
                    });
                  }
                  if (streamBuffers.current[streamConvId]) {
                    const buf = streamBuffers.current[streamConvId];
                    buf.messages = buf.messages.filter((m: any) => !(m.agentId === 'mike' && m.id.endsWith('-plan')));
                    buf.messages.push(summaryMsg);
                  }
                  onCodeGenerate?.();
                  break;
                }
                case 'error': {
                  const errMsg = { id: `${teamBaseId}-err`, role: 'assistant' as const, content: `⚠️ ${event.error}`, agentId: 'mike', timestamp: formatTimestamp() };
                  if (isActiveConv) setMessages((prev) => [...prev, errMsg]);
                  if (streamBuffers.current[streamConvId]) streamBuffers.current[streamConvId].messages.push(errMsg);
                  setIsTyping(false);
                  pendingStreamRef.current = null;
                  break;
                }
                case 'done': {
                  setAgentStatus('mike', 'completed');
                  if (streamBuffers.current[streamConvId]) {
                    streamBuffers.current[streamConvId].isTyping = false;
                  }
                  const buf = streamBuffers.current[streamConvId];
                  const finalMsgs = buf ? buf.messages : messagesRef.current;
                  finishTeamStream(finalMsgs);
                  break;
                }
              }
            },
            onError: (error: string) => {
              setIsTyping(false);
              pendingStreamRef.current = null;
            },
          },
          abortControllerRef.current?.signal,
        );
      } else {
```

- [ ] **步骤 7：删除 saveConversation 中的 planData/planExecuted 引用**

修改 `saveConversation` (lines 476-539):
- 删除 `planPayload` 和 `plan` 保存逻辑
- 删除 `plan_executed` 字段

具体：将 line 490-500 中的 plan 相关逻辑删除:
```typescript
// 删除:
const planPayload = planData ? { analysis: planData.analysis, tasks: planData.tasks } : null;
// ... 以及所有 planPayload, plan_executed 引用

// saveBody 改为:
const saveBody: Record<string, any> = { title, messages: messagesStr };
```

本地存储 backup 改为：
```typescript
localStorage.setItem(backupKey, JSON.stringify({ title, messages: messagesStr, id: targetConvId }));
```

- [ ] **步骤 8：删除 `saveConversation` 依赖数组中的 `planData`**

将 line 539 的依赖从 `[isLoggedIn, currentConvId, onConversationSaved, onCurrentConvIdChange, planData]` 改为 `[isLoggedIn, currentConvId, onConversationSaved, onCurrentConvIdChange]`

- [ ] **步骤 9：删除 useEffect 中的 plan 恢复逻辑**

删除 lines 392-401 (tryRestorePlan 回调):
```typescript
const tryRestorePlan = (data: any) => {
    if (!signal.aborted && data?.plan && !data?.plan_executed) { ... }
};
```

删除调用 `tryRestorePlan` 的地方 (lines 415, 433, 450)

- [ ] **步骤 10：删除 Conversation 加载时 setPlanData 的调用**

删除 `setPlanData(null)` (line 352):
```typescript
// 删除: setPlanData(null);  // 不再需要
```

- [ ] **步骤 11：删除 streamBuffers 中 planData 相关迁移逻辑**

删除 lines 303-310 (plan-phase buffer 的 planData 迁移):
```typescript
// Migrate plan-phase buffers to use the real conversation ID
if (prevId && !streamBuffers.current[prevId]) {
    const planKey = Object.keys(streamBuffers.current).find(k => k.startsWith('_plan_'));
    if (planKey) { ... delete streamBuffers.current[planKey]; }
}
```

- [ ] **步骤 12：删除 PlanReview 渲染 (lines 1183-1191)**

```typescript
// 删除:
{planData && (
    <PlanReview
      analysis={planData.analysis}
      tasks={planData.tasks}
      agents={agents}
      onConfirm={handleTeamExecute}
      onRegenerate={() => setPlanData(null)}
    />
)}
```

- [ ] **步骤 13：删除 ChatPanel.tsx 中未使用的变量/引用**

确认以下不再被引用后删除：
- `planMsgId` 仅在返回 JSX 中不使用的部分标记 — 实际上它在新代码中仍用于 `id` 标记，保留

---

### 任务 7：验证 — 启动后端确认无错误

**文件：** 无新建

- [ ] **步骤 1：启动后端检查 Python 语法和导入错误**

```bash
cd app/backend
python -c "from services.agent_orchestrator import AgentOrchestrator; print('OK')"
python -c "from routers.agents import router; print('OK')"
```

- [ ] **步骤 2：启动前端构建检查 TypeScript 编译**

```bash
cd app/frontend
npx tsc --noEmit
```

- [ ] **步骤 3：验证 lint**

```bash
cd app/backend
ruff check . --select E,F --ignore E501
```

```bash
cd app/frontend
npx eslint src/components/ChatPanel.tsx --max-warnings 100
```

---

### 任务 8：Commit

**文件：** 无新建

- [ ] **步骤 1：Git add 所有改动文件并 commit**

```bash
git add app/backend/services/agent_orchestrator.py
git add app/backend/routers/agents.py
git add app/frontend/src/components/ChatPanel.tsx
git add app/frontend/src/types/agent.ts
git rm app/frontend/src/components/PlanReview.tsx
git add docs/superpowers/specs/2026-05-26-team-autorun-design.md
git add docs/superpowers/plans/2026-05-26-team-autorun.md
git commit -m "feat: 团队协作自动执行 — 去掉执行计划审核环节"
```
