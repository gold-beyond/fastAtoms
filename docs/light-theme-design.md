# Atoms 亮色风格设计文档

## 1. 概述

本文档定义 Atoms Demo 项目从暗色主题切换到 Atoms 平台官方亮色风格的完整设计规范。所有样式严格对标 Atoms 平台的视觉语言：白色背景、靛蓝紫渐变主色、清爽的层次感。

---

## 2. CSS 变量定义

### 2.1 完整 `:root` 变量（shadcn/Tailwind HSL 格式）

替换 `/workspace/app/frontend/src/index.css` 中的 `:root` 块：

```css
:root {
  /* ===== 核心颜色 ===== */
  --background: 0 0% 100%;              /* #FFFFFF 纯白主背景 */
  --foreground: 220 13% 10%;            /* #111827 主文字色 */

  --card: 0 0% 100%;                    /* #FFFFFF 卡片背景 */
  --card-foreground: 220 13% 10%;       /* #111827 卡片文字 */

  --popover: 0 0% 100%;                 /* #FFFFFF 弹出层背景 */
  --popover-foreground: 220 13% 10%;    /* #111827 弹出层文字 */

  --primary: 239 84% 67%;              /* #6366F1 靛蓝主色 */
  --primary-foreground: 0 0% 100%;     /* #FFFFFF 主色上的文字 */

  --secondary: 220 14% 96%;            /* #F3F4F6 次要背景 */
  --secondary-foreground: 220 13% 10%; /* #111827 次要文字 */

  --muted: 220 14% 96%;               /* #F3F4F6 静音背景 */
  --muted-foreground: 220 9% 46%;     /* #6B7280 静音文字 */

  --accent: 263 70% 58%;              /* #8B5CF6 紫色强调 */
  --accent-foreground: 0 0% 100%;     /* #FFFFFF 强调色上文字 */

  --destructive: 0 84% 60%;           /* #EF4444 危险色 */
  --destructive-foreground: 0 0% 100%; /* #FFFFFF */

  --border: 220 13% 91%;              /* #E5E7EB 边框色 */
  --input: 220 13% 91%;               /* #E5E7EB 输入框边框 */
  --ring: 239 84% 67%;                /* #6366F1 聚焦环 */

  --radius: 0.5rem;                   /* 8px 基础圆角 */

  /* ===== 侧边栏 ===== */
  --sidebar-background: 220 14% 97%;        /* #F7F7F8 侧边栏背景 */
  --sidebar-foreground: 220 13% 10%;        /* #111827 */
  --sidebar-primary: 239 84% 67%;           /* #6366F1 */
  --sidebar-primary-foreground: 0 0% 100%;  /* #FFFFFF */
  --sidebar-accent: 220 14% 93%;            /* #EDEDF0 hover 态 */
  --sidebar-accent-foreground: 220 13% 10%; /* #111827 */
  --sidebar-border: 220 13% 91%;            /* #E5E7EB */
  --sidebar-ring: 239 84% 67%;              /* #6366F1 */

  /* ===== 自定义扩展变量 ===== */
  --gradient-start: 239 84% 67%;      /* #6366F1 渐变起点 */
  --gradient-end: 263 70% 58%;        /* #8B5CF6 渐变终点 */
  --surface-elevated: 0 0% 100%;      /* 浮起表面 */
  --surface-sunken: 220 20% 98%;      /* #FAFAFA 凹陷表面 */
  --code-background: 220 14% 96%;     /* #F3F4F6 代码块背景 */
  --code-foreground: 220 13% 18%;     /* #1F2937 代码文字 */
  --shadow-color: 220 13% 10%;        /* 阴影基色 */
}
```

### 2.2 颜色对照表

| 用途 | 暗色（当前） | 亮色（目标） | Hex |
|------|-------------|-------------|-----|
| 主背景 | `240 20% 7%` (#0f0f23) | `0 0% 100%` | #FFFFFF |
| 侧边栏背景 | `240 20% 7%` | `220 14% 97%` | #F7F7F8 |
| 卡片背景 | `240 20% 10%` | `0 0% 100%` | #FFFFFF |
| 主文字 | `210 40% 98%` | `220 13% 10%` | #111827 |
| 次文字 | `215 20% 65%` | `220 9% 46%` | #6B7280 |
| 边框 | `240 15% 20%` | `220 13% 91%` | #E5E7EB |
| 主色 | `239 84% 67%` | `239 84% 67%` | #6366F1 (不变) |
| 强调色 | `263 70% 58%` | `263 70% 58%` | #8B5CF6 (不变) |

---

## 3. 排版系统

### 3.1 字体栈

```css
/* UI 文字 */
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;

/* 代码区域 */
font-family: 'JetBrains Mono', 'Fira Code', 'SF Mono', 'Cascadia Code', monospace;
```

### 3.2 字号层级

| 级别 | 大小 | 行高 | 字重 | 用途 |
|------|------|------|------|------|
| Display | 24px (1.5rem) | 1.3 | 700 | 页面标题 |
| Heading | 18px (1.125rem) | 1.4 | 600 | 区域标题 |
| Subheading | 14px (0.875rem) | 1.5 | 600 | 面板标题 |
| Body | 14px (0.875rem) | 1.6 | 400 | 正文内容 |
| Caption | 12px (0.75rem) | 1.5 | 400 | 辅助文字 |
| Tiny | 10px (0.625rem) | 1.4 | 400 | 时间戳、标签 |
| Code | 13px (0.8125rem) | 1.7 | 400 | 代码内容 |

### 3.3 文字颜色

| 层级 | 变量 | 颜色 | 用途 |
|------|------|------|------|
| 主文字 | `foreground` | #111827 | 标题、正文 |
| 次文字 | `muted-foreground` | #6B7280 | 描述、占位符 |
| 禁用文字 | — | #9CA3AF | 不可操作状态 |
| 链接/强调 | `primary` | #6366F1 | 可点击文字 |
| 成功 | — | #10B981 | 成功状态 |
| 警告 | — | #F59E0B | 警告状态 |
| 错误 | `destructive` | #EF4444 | 错误状态 |

---

## 4. 布局规范

### 4.1 间距系统（基于 4px 网格）

| Token | 值 | 用途 |
|-------|-----|------|
| `space-1` | 4px | 图标与文字间距 |
| `space-2` | 8px | 紧凑元素间距 |
| `space-3` | 12px | 列表项内边距 |
| `space-4` | 16px | 卡片内边距 |
| `space-5` | 20px | 区域间距 |
| `space-6` | 24px | 面板间距 |
| `space-8` | 32px | 大区块间距 |

### 4.2 圆角

| 级别 | 值 | 用途 |
|------|-----|------|
| `rounded-sm` | 4px | 小按钮、标签 |
| `rounded-md` | 6px | 输入框 |
| `rounded-lg` | 8px | 卡片、面板 |
| `rounded-xl` | 12px | 对话框、弹窗 |
| `rounded-full` | 9999px | 头像、圆形按钮 |

### 4.3 阴影

```css
/* 浮起卡片 */
--shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
--shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.07), 0 2px 4px -2px rgba(0, 0, 0, 0.05);
--shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -4px rgba(0, 0, 0, 0.04);
--shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04);

/* 聚焦环 */
--shadow-ring: 0 0 0 3px rgba(99, 102, 241, 0.15);

/* 渐变按钮悬浮 */
--shadow-primary: 0 4px 14px 0 rgba(99, 102, 241, 0.25);
```

### 4.4 主布局结构

```
┌──────────────────────────────────────────────────────────────┐
│  Header (h: 48px, bg: white, border-bottom: #E5E7EB)        │
├────────┬──────────────────────────────────────────────┬──────┤
│ Conv   │                                              │      │
│ Sidebar│        Chat Panel                            │ Code │
│ (w:220)│        (flex: 1)                             │Editor│
│ bg:    │        bg: #FAFAFA                           │  or  │
│ #F7F7F8│                                              │Preview│
│        │                                              │(flex:1)│
├────────┴──────────────────────────────────────────────┴──────┤
│  (无 Footer)                                                  │
└──────────────────────────────────────────────────────────────┘
```

---

## 5. 组件样式规范

### 5.1 按钮

#### 主按钮（Primary）

```css
.btn-primary {
  background: linear-gradient(135deg, #6366F1, #8B5CF6);
  color: #FFFFFF;
  border: none;
  border-radius: 8px;
  padding: 8px 16px;
  font-weight: 500;
  font-size: 14px;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.2);
  transition: all 0.2s ease;
}
.btn-primary:hover {
  background: linear-gradient(135deg, #4F46E5, #7C3AED);
  box-shadow: 0 4px 14px rgba(99, 102, 241, 0.3);
  transform: translateY(-1px);
}
.btn-primary:active {
  transform: translateY(0);
  box-shadow: 0 2px 6px rgba(99, 102, 241, 0.2);
}
```

#### 次要按钮（Secondary / Ghost）

```css
.btn-secondary {
  background: #F3F4F6;
  color: #374151;
  border: 1px solid #E5E7EB;
  border-radius: 8px;
  padding: 8px 16px;
  font-weight: 500;
  font-size: 14px;
  transition: all 0.15s ease;
}
.btn-secondary:hover {
  background: #E5E7EB;
  border-color: #D1D5DB;
}
```

#### 图标按钮

```css
.btn-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: transparent;
  color: #6B7280;
  transition: all 0.15s ease;
}
.btn-icon:hover {
  background: #F3F4F6;
  color: #111827;
}
```

### 5.2 输入框

```css
.input {
  background: #FFFFFF;
  border: 1px solid #E5E7EB;
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 14px;
  color: #111827;
  transition: all 0.15s ease;
}
.input::placeholder {
  color: #9CA3AF;
}
.input:focus {
  border-color: #6366F1;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
  outline: none;
}
```

### 5.3 卡片

```css
.card {
  background: #FFFFFF;
  border: 1px solid #E5E7EB;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  transition: box-shadow 0.2s ease;
}
.card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
}
```

### 5.4 导航栏 / Header

```css
.header {
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid #E5E7EB;
  height: 48px;
  padding: 0 16px;
  display: flex;
  align-items: center;
}
```

### 5.5 侧边栏

```css
.sidebar {
  background: #F7F7F8;
  border-right: 1px solid #E5E7EB;
  width: 220px;
}
.sidebar-item {
  padding: 8px 12px;
  border-radius: 8px;
  color: #374151;
  font-size: 13px;
  transition: all 0.15s ease;
}
.sidebar-item:hover {
  background: #EDEDF0;
}
.sidebar-item.active {
  background: rgba(99, 102, 241, 0.08);
  color: #6366F1;
  border: 1px solid rgba(99, 102, 241, 0.15);
}
```

### 5.6 对话气泡

#### 用户消息

```css
.message-user {
  background: linear-gradient(135deg, #6366F1, #8B5CF6);
  color: #FFFFFF;
  border-radius: 12px 12px 4px 12px;
  padding: 10px 14px;
  max-width: 80%;
  font-size: 14px;
  line-height: 1.6;
}
```

#### AI 消息

```css
.message-assistant {
  background: #F9FAFB;
  border: 1px solid #E5E7EB;
  color: #111827;
  border-radius: 12px 12px 12px 4px;
  padding: 10px 14px;
  max-width: 85%;
  font-size: 14px;
  line-height: 1.6;
}
```

### 5.7 头像

```css
.avatar-user {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #E5E7EB;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #6B7280;
}
.avatar-bot {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: linear-gradient(135deg, #6366F1, #8B5CF6);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #FFFFFF;
}
```

### 5.8 下拉菜单

```css
.dropdown-menu {
  background: #FFFFFF;
  border: 1px solid #E5E7EB;
  border-radius: 10px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.08);
  padding: 4px;
}
.dropdown-item {
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 13px;
  color: #374151;
  transition: background 0.1s ease;
}
.dropdown-item:hover {
  background: #F3F4F6;
}
```

### 5.9 标签 / Badge

```css
.badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 9999px;
  font-size: 11px;
  font-weight: 500;
}
.badge-primary {
  background: rgba(99, 102, 241, 0.1);
  color: #6366F1;
}
.badge-success {
  background: rgba(16, 185, 129, 0.1);
  color: #059669;
}
```

### 5.10 Tooltip

```css
.tooltip {
  background: #111827;
  color: #FFFFFF;
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}
```

---

## 6. 代码编辑器样式

### 6.1 代码区域背景

```css
.code-editor {
  background: #F8F9FA;
  border: 1px solid #E5E7EB;
  border-radius: 8px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  line-height: 1.7;
}
```

### 6.2 代码语法高亮（亮色主题）

| Token 类型 | 颜色 | 说明 |
|-----------|------|------|
| 关键字 | #7C3AED | 紫色 (purple-600) |
| 字符串 | #059669 | 绿色 (emerald-600) |
| 数字 | #D97706 | 琥珀色 (amber-600) |
| 注释 | #9CA3AF | 灰色 (gray-400) |
| 函数名 | #2563EB | 蓝色 (blue-600) |
| 标签名 | #DC2626 | 红色 (red-600) |
| 属性名 | #D97706 | 琥珀色 |
| 属性值 | #059669 | 绿色 |
| 运算符 | #374151 | 深灰 |
| 括号 | #6B7280 | 中灰 |

### 6.3 行号样式

```css
.line-number {
  color: #D1D5DB;
  font-size: 12px;
  padding-right: 16px;
  text-align: right;
  user-select: none;
  min-width: 32px;
}
```

### 6.4 文件标签栏

```css
.file-tabs {
  background: #FFFFFF;
  border-bottom: 1px solid #E5E7EB;
  display: flex;
  gap: 0;
  padding: 0 8px;
}
.file-tab {
  padding: 8px 14px;
  font-size: 12px;
  color: #6B7280;
  border-bottom: 2px solid transparent;
  transition: all 0.15s ease;
}
.file-tab:hover {
  color: #374151;
  background: #F9FAFB;
}
.file-tab.active {
  color: #6366F1;
  border-bottom-color: #6366F1;
  background: #FFFFFF;
}
```

---

## 7. 特殊效果

### 7.1 滚动条

```css
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: #D1D5DB;
  border-radius: 3px;
}
::-webkit-scrollbar-thumb:hover {
  background: #9CA3AF;
}
```

### 7.2 渐变装饰

```css
/* Logo 文字渐变 */
.gradient-text {
  background: linear-gradient(135deg, #6366F1, #8B5CF6);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* 主按钮渐变 */
.gradient-primary {
  background: linear-gradient(135deg, #6366F1, #8B5CF6);
}

/* 顶部装饰条 */
.gradient-bar {
  height: 3px;
  background: linear-gradient(90deg, #6366F1, #8B5CF6, #EC4899);
}
```

### 7.3 动画

保留现有动画，调整颜色：

```css
/* 脉冲发光 - 亮色版 */
@keyframes pulse-glow {
  0%, 100% { box-shadow: 0 0 5px rgba(99, 102, 241, 0.15); }
  50% { box-shadow: 0 0 20px rgba(99, 102, 241, 0.3); }
}

/* 打字指示器保持不变 */
/* fade-in-up 保持不变 */
/* code-appear 保持不变 */
```

---

## 8. 完整 index.css 替换内容

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 220 13% 10%;

    --card: 0 0% 100%;
    --card-foreground: 220 13% 10%;

    --popover: 0 0% 100%;
    --popover-foreground: 220 13% 10%;

    --primary: 239 84% 67%;
    --primary-foreground: 0 0% 100%;

    --secondary: 220 14% 96%;
    --secondary-foreground: 220 13% 10%;

    --muted: 220 14% 96%;
    --muted-foreground: 220 9% 46%;

    --accent: 263 70% 58%;
    --accent-foreground: 0 0% 100%;

    --destructive: 0 84% 60%;
    --destructive-foreground: 0 0% 100%;

    --border: 220 13% 91%;
    --input: 220 13% 91%;
    --ring: 239 84% 67%;

    --radius: 0.5rem;

    --sidebar-background: 220 14% 97%;
    --sidebar-foreground: 220 13% 10%;
    --sidebar-primary: 239 84% 67%;
    --sidebar-primary-foreground: 0 0% 100%;
    --sidebar-accent: 220 14% 93%;
    --sidebar-accent-foreground: 220 13% 10%;
    --sidebar-border: 220 13% 91%;
    --sidebar-ring: 239 84% 67%;
  }
}

@layer base {
  * {
    @apply border-border;
  }

  body {
    @apply bg-background text-foreground;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  }
}

/* Custom scrollbar - Light */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: hsl(220, 13%, 83%);
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: hsl(220, 9%, 62%);
}

/* Typing animation */
@keyframes typing-dot {
  0%, 20% { opacity: 0.2; }
  50% { opacity: 1; }
  80%, 100% { opacity: 0.2; }
}

.typing-dot:nth-child(1) { animation: typing-dot 1.4s infinite 0s; }
.typing-dot:nth-child(2) { animation: typing-dot 1.4s infinite 0.2s; }
.typing-dot:nth-child(3) { animation: typing-dot 1.4s infinite 0.4s; }

/* Code appear animation */
@keyframes code-appear {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.code-line-appear {
  animation: code-appear 0.3s ease forwards;
}

/* Pulse glow - Light version */
@keyframes pulse-glow {
  0%, 100% { box-shadow: 0 0 5px rgba(99, 102, 241, 0.15); }
  50% { box-shadow: 0 0 20px rgba(99, 102, 241, 0.3); }
}

.pulse-glow {
  animation: pulse-glow 2s ease-in-out infinite;
}

/* Progress bar animation */
@keyframes progress-fill {
  from { width: 0%; }
  to { width: 100%; }
}

.progress-fill {
  animation: progress-fill 2s ease-in-out forwards;
}

/* Fade in up */
@keyframes fade-in-up {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.fade-in-up {
  animation: fade-in-up 0.4s ease forwards;
}
```

---

## 9. 组件内联样式迁移指南

### 9.1 颜色映射表（硬编码 → CSS 变量）

在各组件中搜索并替换以下硬编码颜色：

| 暗色硬编码 | 替换为 | 说明 |
|-----------|--------|------|
| `bg-[#0f0f23]` | `bg-background` | 主背景 |
| `bg-[#1a1a2e]` | `bg-secondary` 或 `bg-muted` | 次背景/hover |
| `bg-[#0a0a1a]` | `bg-background` | 深色背景 |
| `border-border` | `border-border` (不变) | 边框 |
| `text-foreground` | `text-foreground` (不变) | 主文字 |
| `text-muted-foreground` | `text-muted-foreground` (不变) | 次文字 |
| `text-indigo-400` | `text-primary` | 主色文字 |
| `text-indigo-300` | `text-primary/80` | 浅主色文字 |
| `hover:bg-[#1a1a2e]` | `hover:bg-muted` | hover 背景 |
| `hover:bg-[#2a2a3e]` | `hover:bg-muted` | hover 背景 |
| `bg-indigo-500/15` | `bg-primary/10` | 选中态背景 |
| `border-indigo-500/30` | `border-primary/20` | 选中态边框 |
| `from-indigo-500 to-purple-500` | `from-primary to-accent` | 渐变 |
| `from-indigo-600 to-purple-600` | `from-primary/90 to-accent/90` | hover 渐变 |

### 9.2 ChatPanel 样式迁移

```tsx
// 当前暗色
<div className="flex flex-col h-full bg-[#0f0f23] border-r border-border">

// 亮色替换
<div className="flex flex-col h-full bg-[#FAFAFA] border-r border-border">
```

```tsx
// 当前暗色 - 消息 hover
className="hover:bg-[#1a1a2e]"

// 亮色替换
className="hover:bg-gray-100"
```

### 9.3 ConversationSidebar 样式迁移

```tsx
// 当前暗色
className="bg-[#0f0f23] border-r border-border"

// 亮色替换
className="bg-[#F7F7F8] border-r border-border"
```

```tsx
// 当前暗色 - 选中态
className="bg-indigo-500/15 border border-indigo-500/30"

// 亮色替换
className="bg-primary/8 border border-primary/15"
```

### 9.4 Header 样式迁移

```tsx
// 当前暗色
className="bg-[#0f0f23]/80 backdrop-blur-sm border-b border-border"

// 亮色替换
className="bg-white/85 backdrop-blur-xl border-b border-border"
```

### 9.5 LoginPage 样式迁移

```tsx
// 当前暗色
className="min-h-screen bg-[#0a0a1a]"
// 表单
className="bg-[#0f0f23] border border-border rounded-xl"
// 输入框
className="bg-[#1a1a2e] border-border"

// 亮色替换
className="min-h-screen bg-[#FAFAFA]"
className="bg-white border border-border rounded-xl shadow-lg"
className="bg-white border-border"
```

---

## 10. 需修改的文件清单

### 10.1 必须修改的文件

| 文件 | 改动内容 |
|------|---------|
| `src/index.css` | 替换全部 CSS 变量为亮色值，更新滚动条和动画颜色 |
| `src/components/ChatPanel.tsx` | 替换 `bg-[#0f0f23]`、`bg-[#1a1a2e]`、`hover:bg-[#1a1a2e]` 等硬编码暗色 |
| `src/components/ConversationSidebar.tsx` | 替换侧边栏暗色背景和 hover 态 |
| `src/components/CodeEditor.tsx` | 替换代码区域暗色背景，更新语法高亮颜色 |
| `src/components/PreviewPanel.tsx` | 替换预览面板暗色背景 |
| `src/components/PublishDialog.tsx` | 替换对话框暗色背景 |
| `src/pages/Index.tsx` | 替换主布局暗色背景、Header 样式 |
| `src/pages/LoginPage.tsx` | 替换登录页暗色背景和表单样式 |

### 10.2 可能需要修改的文件

| 文件 | 改动内容 |
|------|---------|
| `src/components/ProjectSidebar.tsx` | 如有暗色硬编码 |
| `src/pages/AuthCallback.tsx` | 如有暗色背景 |
| `src/pages/AuthError.tsx` | 如有暗色背景 |

### 10.3 无需修改的文件

| 文件 | 原因 |
|------|------|
| `tailwind.config.ts` | 仅引用 CSS 变量，无需改动 |
| `src/lib/simpleApi.ts` | 纯逻辑，无样式 |
| `src/hooks/useAuth.ts` | 纯逻辑，无样式 |
| `src/lib/conversationUtils.ts` | 纯逻辑，无样式 |

---

## 11. 实施步骤

1. **Step 1**：替换 `src/index.css` 中的 CSS 变量（本文档第 8 节完整内容）
2. **Step 2**：全局搜索替换硬编码暗色值（参照第 9.1 节映射表）
3. **Step 3**：逐组件调整（ChatPanel → Sidebar → CodeEditor → Index → Login）
4. **Step 4**：调整代码编辑器语法高亮为亮色方案
5. **Step 5**：视觉走查，确保所有页面一致性
6. **Step 6**：测试响应式布局和交互状态

---

## 12. 视觉参考

### 12.1 Atoms 平台亮色特征总结

- ✅ 纯白主背景，极浅灰 (#FAFAFA) 作为区域区分
- ✅ 侧边栏使用 #F7F7F8，右侧 1px 边框分隔
- ✅ 靛蓝紫渐变 (#6366F1 → #8B5CF6) 作为品牌色和主按钮
- ✅ 卡片白色 + 极轻阴影，hover 时阴影加深
- ✅ 边框统一 #E5E7EB，不使用深色边框
- ✅ 文字层次分明：#111827 主文字、#6B7280 次文字
- ✅ 圆角 8-12px，整体柔和现代
- ✅ 毛玻璃效果用于固定 Header
- ✅ 代码区域使用浅色语法高亮主题
- ✅ 动画轻柔，不使用过重的发光效果