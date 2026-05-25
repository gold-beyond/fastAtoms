# 团队协作自动执行 — 设计规格

**日期**: 2026-05-26  
**状态**: 已确认  
**关联**: 去掉执行计划审核环节，Mike 分配任务后直接自动执行

---

## 目标

将团队协作模式从"Mike 计划 → 用户审核确认 → 执行"改为"Mike 计划 → 自动执行"。需求不明确时 Mike 单轮追问后再自动执行。

## 核心流程

```
用户输入 → Mike 分析 →
  ├─ 需求明确 + 需要 Emma → Emma 需求分析 → Alex 代码实现 → Mike 汇总
  ├─ 需求明确 + 仅需 Alex  → 直接 Alex 代码实现 → Mike 汇总
  └─ 需求不明确 → Mike 追问 → 等待用户回复 → 下一轮重新分析（单轮）
```

**Emma 按需召唤，永远排在 Alex 前执行。**

### SSE 事件流

```
# 需要 Emma 时：
  plan_start → token (Mike 分析摘要)
  → task_start (Emma) → token... → task_complete (Emma)
  → task_start (Alex) → token... → task_complete (Alex)
  → summary (Mike) → done

# 仅需 Alex 时：
  plan_start → token (Mike 分析摘要)
  → task_start (Alex) → token... → task_complete (Alex)
  → summary (Mike) → done

# 需求不明确时：
  plan_start → token (Mike 追问) → need_clarify → done
```

---

## 后端改动

### 文件：`app/backend/services/agent_orchestrator.py`

**改造 `team_chat_stream` 方法**为新状态机：

```
Analyze → NeedClarify → Done
Analyze → Execute (Emma → Alex) → Summary → Done
```

关键逻辑：
1. Mike 分析阶段流式输出 token
2. 解析 JSON plan 中的 `needs_clarification` 字段
3. `needs_clarification: true` → 发出 `need_clarify` 事件后结束
4. `needs_clarification: false` → 展示分析摘要 → 遍历 `tasks[]` 串行执行 → Mike 汇总

**Mike 输出 JSON 格式**：
```json
{
  "needs_clarification": true,
  "analysis": "需求不够明确，需要追问的内容..."
}
```
或：
```json
{
  "needs_clarification": false,
  "analysis": "需求分析摘要",
  "tasks": [
    { "agent_id": "emma", "title": "需求分析", "description": "..." },
    { "agent_id": "alex", "title": "实现代码", "description": "..." }
  ]
}
```

### 删除项

| 删除项 | 位置 |
|--------|------|
| `team_plan_stream()` 方法 | `agent_orchestrator.py` |
| `team_execute_stream()` 方法 | `agent_orchestrator.py` |
| `_ensure_plan()` 方法 | `agent_orchestrator.py` |
| `POST /team/plan/stream` 端点 | `routers/agents.py` |
| `POST /team/execute/stream` 端点 | `routers/agents.py` |
| `TeamExecuteRequest` schema | `schemas/agents.py` |

### Mike Prompt 更新

```
你是 Mike，Team Leader，通过 JSON 输出控制团队协作流程。

规则：
1. 需求不明确 → needs_clarification=true，analysis 中写追问内容，不输出 tasks
2. 需求明确 → needs_clarification=false，analysis 写分析摘要，tasks 列出任务
   - 需要需求分析时 emma 在前、alex 在后
   - 仅需编码时只放 alex
```

---

## 前端改动

### 文件：`app/frontend/src/components/PlanReview.tsx`

**整文件删除。**

### 文件：`app/frontend/src/components/ChatPanel.tsx`

**核心变化**：Team Mode 下 `handleSend` 改为单次 SSE 调用：

- 之前：`POST /team/plan/stream` → 收到 plan → 弹 PlanReview → 用户确认 → `POST /team/execute/stream`
- 之后：`POST /team/chat/stream` → 收到 SSE 事件直接渲染 → 自动完成

**SSE 事件处理表**：

| 事件 | 前端行为 |
|------|----------|
| `plan_start` | 创建 Mike 的 plan 消息气泡 |
| `token` (Mike) | 追加到 plan 消息 |
| `need_clarify` | 结束当前轮（Mike 追问已在 token 中展示） |
| `task_start` | 创建对应 Agent 消息气泡 |
| `token` (Agent) | 追加到对应 Agent 消息 |
| `task_complete` | 标记完成，提取代码块推送预览/编辑器 |
| `summary` | 创建 Mike 汇总消息气泡 |
| `done` | 结束流 |

**删除的代码**：
- PlanReview 组件的 import 和渲染
- `handleTeamExecute()` 方法
- PlanReview 的 `planMsgId` 关联逻辑
- 用户确认后的旧 plan 消息过滤逻辑

### 文件：`app/frontend/src/types/agent.ts`

- 新增 `need_clarify` 到 `TeamStreamEvent` 联合类型
- 移除 `TeamExecuteRequest` 前端类型（如有定义）

---

## 不涉及改动的部分

以下模块不受影响：
- `AgentBar.tsx` — 团队成员列表无变化
- `AgentMessageBubble.tsx` — 消息气泡渲染无变化
- `AgentCard.tsx` — Agent 卡片无变化
- `AgentContext.tsx` — 全局状态 workMode 等保持不变
- `routers/tasks.py` — 任务 CRUD API 保持不变
- `models/tasks.py` — Task ORM 模型保持不变
- `routers/agents.py` 中 `POST /team/chat/stream` 路由 — 保留，调用 `team_chat_stream`
