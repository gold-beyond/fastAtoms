# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

fastAtoms 是一个全栈 Web 应用，模拟 **Atoms 平台核心工作流（Chat → Code → Publish）**。三面板 IDE 布局 + 多 Agent 协作系统 + AI 多供应商支持。

## Commands

| Context | Command | Notes |
|---------|---------|-------|
| Quick start | `bash app/start_app_v2.sh` | 一键安装依赖 + 启动前后端 |
| Frontend dev | `cd app/frontend && pnpm run dev` | Vite dev server, 默认 :3000 |
| Frontend build | `cd app/frontend && pnpm run build` | 生产构建 |
| Frontend lint | `cd app/frontend && pnpm run lint` | ESLint (`--quiet ./src`) |
| Backend dev | `cd app/backend && uvicorn main:app --host 0.0.0.0 --port 8000 --reload` | |
| Backend test | `cd app/backend && pytest` | |
| Docker build | `docker build -t fastatoms .` | 多阶段构建: Node 构建前端 → Python 运行 |

**重要：前端必须用 `pnpm`，不能用 npm。**

## Architecture

### 后端 (`app/backend/`)

- **入口**: `main.py` — FastAPI app 创建、lifespan 管理、router 自动发现、CORS 配置、全局异常处理。支持 Lambda (Mangum) 和普通部署。
- **Router 自动发现**: `routers/` 目录下的所有模块被 `pkgutil.walk_packages` 自动扫描，任何 `APIRouter` 实例（`router` 或 `admin_router`）会被自动 `include_router`。**不需要手动注册路由。** 所有路由统一使用前缀 `/api/v1/`。
- **依赖注入**: `dependencies/auth.py` — `get_current_user`（JWT Bearer Token → UserResponse）和 `get_admin_user`。
- **服务层**: `services/` — 业务逻辑，各模块独立（auth、conversations、projects、ai_proxy、aihub、storage 等）。`services/base.py` 提供泛型 `BaseService[ModelType]` CRUD 基类。
- **AI 代理**: `services/ai_proxy.py` — 统一代理层，支持 OpenAI、Anthropic、DeepSeek 供应商。自动从 model 名推断 provider。流式和非流式双模式。API key 解析优先级：请求参数 → 共享密钥缓存（DB）→ 环境变量。
- **多 Agent 协作**: `services/agent_orchestrator.py` — 内置三个 Agent（Mike/Team Leader、Alex/Engineer、Emma/PM）。Team 模式：Mike Think（流式自然语言）→ Mike Plan（JSON 任务分配）→ 强制 Emma 先需求分析 → Alex 实现代码。每轮对话重新分析。
- **数据库**: `core/database.py` — `DatabaseManager` 单例，支持 PostgreSQL（asyncpg）、SQLite（aiosqlite）、MySQL。Lambda 环境自动切 NullPool。`get_db` 依赖支持懒初始化。
- **配置**: `core/config.py` — `Settings(BaseSettings)`，从 `.env` 自动加载。JWT、OIDC、AI API keys 等全部在此集中管理。

### 前端 (`app/frontend/`)

- **技术栈**: Vite 5 + React 18 + TypeScript + Tailwind CSS 3.4 + shadcn/ui (Radix UI)
- **路由**: React Router v6，4 个页面 — `Index`（主 IDE）、`LoginPage`、`AuthCallback`、`AuthError`
- **状态管理**: React Context（`AgentContext`）+ `@tanstack/react-query`
- **核心组件**: `ChatPanel`（对话界面）、`CodeEditor`（代码展示/语法高亮）、`PreviewPanel`（iframe 实时预览）、`PublishDialog`（发布流程）
- **`@/` 别名**: 映射到 `src/`，统一用 `@/components/ui/button` 形式导入
- **Vite 代理**: dev server 将 `/api` 请求代理到 `http://localhost:8000`
- **构建优化**: 手动分包（react-vendor、ui-vendor、form-vendor 等），chunk 大小警告线 1000KB
- **SEO/预渲染**: 博客系统支持 `vite-prerender-plugin` + `vite-plugin-sitemap`

### Docker 部署

多阶段构建：Stage 1 用 `node:20-alpine` 构建前端 → Stage 2 用 `python:3.11-slim` 运行后端 + 挂载前端静态文件。通过 `FRONTEND_DIST` 环境变量让 FastAPI 直接 serve 前端（`StaticFiles` mount 在 `/`）。

## Key Conventions (from REASONIX.md)

- **Protected paths**: `backend/core/`、`backend/models/`、`backend/main.py`、`backend/lambda_handler.py` 不可修改。
- **Router auto-discovery**: 文件放入 `routers/` 即自动生效，无需手动注册。
- **Auto-managed timestamps**: `created_at` / `updated_at` 由 ORM 自动管理，不要在 schema/payload 中定义或赋值。
- **`index.html` is read-only**: 标题/描述/logo 通过部署环境变量 `%VITE_APP_TITLE%` 等注入。
- **Schema `user_id`**: 由系统自动注入，不要在 JSON schema 或 mock 数据中包含。
- **ESLint**: `no-unused-vars` off, `no-explicit-any` warn.

## AI Proxy Pattern

调用 AI 供应商时始终通过 `services/ai_proxy.py` 的 `proxy_chat` / `proxy_chat_stream`，不要直接调 `openai` 或 `anthropic` SDK。模型名用完整 ID（如 `deepseek-v4-flash`、`claude-sonnet-4-20250514`），provider 可自动推断。

## Auth Flow

两种认证方式并存：
1. **OIDC PKCE**: `/api/v1/auth/login` → 302 跳转 IDP → `/api/v1/auth/callback` → 验证 ID token → 签发 JWT → 302 回前端
2. **Simple login**: `/api/v1/auth/login-simple` + `/api/v1/auth/register`（用户名+密码，bcrypt）

所有受保护 API 通过 `get_current_user` 依赖注入验证 Bearer token。
