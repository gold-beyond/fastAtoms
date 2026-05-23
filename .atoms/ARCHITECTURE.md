---
last_updated: 2026-05-22T09:11:52Z
---

# Architecture Design

## System Overview
Single-page React application simulating the Atoms platform workflow. Pure frontend with simulated AI responses and code generation animations.

## Tech Stack
- React + TypeScript
- Vite
- Tailwind CSS
- shadcn/ui components

## Module Design
| Module | Responsibility | Key Files |
|--------|---------------|-----------|
| Chat Panel | User input and AI response simulation | src/components/ChatPanel.tsx |
| Code Editor | Code display with syntax highlighting and file tabs | src/components/CodeEditor.tsx |
| Preview Panel | Live preview iframe rendering | src/components/PreviewPanel.tsx |
| Publish Flow | Deployment animation and link generation | src/components/PublishDialog.tsx |
| Layout | IDE-like shell with resizable panels | src/pages/Index.tsx |

## Tech Decisions
| Decision | Choice | Rationale |
|----------|--------|-----------|

## File Tree Plan
```
src/
├── pages/
│   └── Index.tsx          # Main IDE layout page
├── components/
│   ├── ChatPanel.tsx      # Chat conversation interface
│   ├── CodeEditor.tsx     # Code generation display
│   ├── PreviewPanel.tsx   # Live preview window
│   └── PublishDialog.tsx  # Publish flow dialog
├── App.tsx                # Router setup
├── main.tsx               # Entry point
└── index.css              # Global styles
```

## Implementation Guide

