# fastAtoms

一个模拟 **Atoms 平台核心工作流**的全栈 Web 应用程序——**对话(Chat) → 代码生成(Code) → 发布(Publish)**。提供类 IDE 的暗色主题界面，集成了多 Agent 协作系统、AI 能力调度、用户认证和实时代码预览。

## 功能特性

- **三面板 IDE 布局**：左侧聊天对话 + 右上代码编辑器（语法高亮）+ 右下实时预览
- **多 Agent 协作系统**：内置 Team Leader、Engineer、Product Manager 三个 Agent，支持单人模式和团队协作模式
- **AI 多供应商支持**：兼容 OpenAI、Anthropic Claude、DeepSeek，支持流式/非流式输出
- **AI Hub 能力集**：文本生成、图片生成、视频生成、TTS 语音合成、语音转文字、PDF 分析
- **用户认证**：OIDC（PKCE）认证 + 简单用户名密码登录，JWT 令牌管理
- **数据持久化**：对话历史、项目代码、Agent 任务状态完整 CRUD
- **发布部署**：一键部署流程，含动画效果
- **对象存储**：S3 兼容存储，Bucket/对象管理
- **博客系统**：Markdown 渲染、SEO 预渲染、Sitemap 自动生成

## 技术栈

### 后端

| 技术 | 用途 |
|------|------|
| FastAPI | Web 框架 |
| SQLAlchemy 2.0+ (async) | 异步 ORM |
| PostgreSQL + asyncpg | 数据库 |
| Alembic | 数据库迁移 |
| Pydantic v2 | 数据验证 |
| python-jose + bcrypt | JWT 认证 |
| SSE-Starlette | 流式输出 |
| Mangum | AWS Lambda 适配 |

### 前端

| 技术 | 用途 |
|------|------|
| React 18 + TypeScript | UI 框架 |
| Vite 5 | 构建工具 |
| Tailwind CSS 3.4 | 样式 |
| shadcn/ui (Radix UI) | 组件库 |
| React Router v6 | 路由 |
| @tanstack/react-query | 数据请求 |
| pnpm | 包管理 |

## 项目结构

```
fastAtoms/
├── app/
│   ├── start_app_v2.sh               # 一键启动脚本
│   ├── backend/                       # FastAPI 后端
│   │   ├── main.py                    # 入口文件
│   │   ├── core/                      # 核心配置（Settings、数据库、JWT）
│   │   ├── models/                    # ORM 数据模型
│   │   ├── schemas/                   # Pydantic 请求/响应模型
│   │   ├── services/                  # 业务逻辑层
│   │   │   ├── agent_orchestrator.py  # 多 Agent 协作调度器
│   │   │   ├── ai_proxy.py            # AI 代理（多供应商）
│   │   │   ├── auth.py                # 认证服务
│   │   │   └── ...
│   │   ├── routers/                   # API 路由（自动发现）
│   │   ├── dependencies/              # FastAPI 依赖注入
│   │   └── alembic/                   # 数据库迁移
│   └── frontend/                      # Vite + React 前端
│       ├── src/
│       │   ├── pages/                 # 页面组件
│       │   ├── components/            # UI 组件（ChatPanel、CodeEditor 等）
│       │   ├── contexts/              # 全局状态（AgentContext）
│       │   ├── hooks/                 # 自定义 Hooks
│       │   └── lib/                   # 工具库
│       └── public/avatars/            # Agent 头像
├── docs/                              # 设计文档
├── scripts/                           # 工具脚本
├── .atoms/                            # 开发工作流与技能定义
└── REASONIX.md                        # 项目知识总览
```

## 快速开始

### 前置要求

- Python 3.10+
- Node.js 18+ & pnpm
- PostgreSQL（或使用 S2S 环境变量连接远程实例）

### 一键启动（推荐）

```bash
# 克隆项目
git clone https://github.com/gold-beyond/fastAtoms.git
cd fastAtoms

# 启动（自动安装依赖、分配端口、检查健康状态）
bash app/start_app_v2.sh
```

启动脚本会自动：
1. 创建 Python 虚拟环境
2. 安装后端依赖
3. 安装前端依赖
4. 启动后端（uvicorn + hot reload）和前端（Vite dev server）

### 手动启动

**后端：**

```bash
cd app/backend

# 创建虚拟环境
python -m venv .venv
source .venv/bin/activate   # Linux/Mac
# .venv\Scripts\activate    # Windows

# 安装依赖
pip install -r requirements.txt
pip install -r requirements.default

# 配置环境变量（复制 .env.example 为 .env 并填写）
cp .env.example .env

# 启动服务
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

**前端：**

```bash
cd app/frontend
pnpm install
pnpm run dev
```

### 访问地址

- 前端：`http://localhost:3000`
- 后端 API 文档：`http://localhost:8000/docs`
- 健康检查：`http://localhost:8000/health`

## 环境变量

主要环境变量配置（在 `app/backend/.env` 中设置）：

```ini
# 数据库
DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/dbname

# JWT
JWT_SECRET_KEY=your-secret-key
JWT_EXPIRE_MINUTES=60

# AI 供应商 API Keys
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
DEEPSEEK_API_KEY=sk-...

# OIDC 认证（可选）
OIDC_ISSUER_URL=
OIDC_CLIENT_ID=
FRONTEND_URL=http://localhost:3000
```

## 多 Agent 系统

内置三个协作 Agent：

| Agent | 角色 | 能力 |
|-------|------|------|
| **Mike** | Team Leader | 任务分解、团队协调、需求分析 |
| **Alex** | Engineer | 代码生成、Bug 修复、功能实现 |
| **Emma** | Product Manager | PRD 编写、竞品分析、用户研究 |

支持两种工作模式：

- **Engineer Mode**：直接与 Alex 对话，快速生成代码
- **Team Mode**：Mike 协调 → 分配任务 → 各 Agent 执行 → 汇总结果，完整 SSE 流式协作

详细设计见 [多 Agent 系统设计文档](docs/multi-agent-design.md)。

## API 概览

| 路由前缀 | 功能 |
|----------|------|
| `/api/v1/auth` | 认证（OIDC、登录、注册、Token） |
| `/api/v1/agents` | Agent 管理、单 Agent / 团队聊天 |
| `/api/v1/chat` | AI 代理聊天 |
| `/api/v1/aihub` | AI 能力（文本/图片/视频/音频/PDF） |
| `/api/v1/entities/conversations` | 对话 CRUD |
| `/api/v1/entities/projects` | 项目 CRUD |
| `/api/v1/tasks` | 任务管理 |
| `/api/v1/storage` | 对象存储 |

## 更多文档

- [REASONIX.md](REASONIX.md) - 项目知识总览
- [后端开发指南](app/backend/README.md)
- [前端开发指南](app/frontend/README.md)
- [架构设计](.atoms/ARCHITECTURE.md)
- [进度跟踪](.atoms/PROGRESS.md)

## License

MIT
