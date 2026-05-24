---
last_updated: 2026-05-22T09:11:52Z
---

# Requirements & Progress

## Requirements Overview

## User Stories

## Task Breakdown
- [x] Create chat conversation interface (left panel)
- [x] Create code generation display with syntax highlighting (right panel)
- [x] Create live preview window (right bottom)
- [x] Create publish flow with animation
- [x] Create IDE-like layout with dark theme and navigation
- [x] Add user authentication (login/logout with Atoms Cloud auth)
- [x] Add conversation persistence (save/load chat history)
- [x] Add project persistence (save/load code projects)
- [x] Update UI with user menu and project list sidebar
- [x] Add backend AI proxy for custom API keys (OpenAI/Anthropic/DeepSeek)
- [x] Add AI settings UI with provider/key/model configuration

## Progress Log
- 2026-05-22: All 5 tasks implemented. Lint and build pass. Dark theme IDE layout with chat, code editor, preview, and publish flow complete.
- 2026-05-22: Backend activated. Created conversations and projects tables via BackendManager.
- 2026-05-22: Implemented real AI chat using client.ai.gentxt streaming with claude-opus-4.6 model. Replaced simulated responses with live AI streaming.
- 2026-05-22: Added backend AI proxy (POST /api/v1/chat/proxy) supporting OpenAI, Anthropic, DeepSeek with user's own API keys. Added AISettings UI component with provider/key/model configuration stored in localStorage. ChatPanel now switches between built-in Atoms AI and custom proxy based on settings.
- 2026-05-22: Added conversation history feature. Chat header now has a clock icon button that toggles a conversation history overlay. Logged-in users fetch history from backend; non-logged-in users use localStorage. Users can switch between conversations and create new ones.

