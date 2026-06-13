import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Bot, FileCode, FileText, Braces, Square } from 'lucide-react';
import { useAgentContext, WORK_MODE_STORAGE_KEY } from '@/contexts/AgentContext';
import AgentMessageBubble from '@/components/AgentMessageBubble';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { AgentDef, AVATAR_URLS, WorkMode } from '@/types/agent';
import { api } from '@/lib/simpleApi';
import { getLocalConversations, saveLocalConversations } from '@/lib/conversationUtils';
import Markdown from 'markdown-to-jsx';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  displayContent?: string;
  agentId?: string;
  mentionedAgents?: string[];
  taskId?: number;
  taskTitle?: string;
  timestamp?: string;
}

interface GeneratedFile {
  id: string;
  name: string;
  icon: React.ReactNode;
  language: string;
  code: string;
}

interface ChatPanelProps {
  onCodeGenerated?: (files: GeneratedFile[], html: string) => void;
  onCodeRestored?: (files: GeneratedFile[], html: string) => void;
  onConversationSaved?: (id: string) => void;
  isLoggedIn?: boolean;
  currentConvId: string | null;
  onCurrentConvIdChange?: (id: string | null) => void;
}

const SYSTEM_PROMPT =
  '你是 fastAtoms 平台的 AI 编程助手。你可以帮助用户生成代码、解答编程问题、设计网页和应用。当用户要求你创建网页或应用时，请生成完整的 HTML、CSS 和 JavaScript 代码，使用 markdown 代码块包裹（```html、```css、```javascript）。请用中文回复。';

const SUGGESTED_PROMPTS = [
  '开发一个贪吃蛇小游戏',
  '设计一个电商产品展示页',
  '构建一个数据可视化仪表盘',
  '开发一个任务管理应用',
];

function getFileIcon(language: string): React.ReactNode {
  switch (language) {
    case 'html':
      return <FileCode className="w-3.5 h-3.5 text-orange-400" />;
    case 'css':
      return <FileText className="w-3.5 h-3.5 text-blue-400" />;
    case 'javascript':
    case 'js':
      return <Braces className="w-3.5 h-3.5 text-yellow-400" />;
    default:
      return <FileCode className="w-3.5 h-3.5 text-muted-foreground" />;
  }
}

function getFileName(language: string): string {
  switch (language) {
    case 'html':
      return 'index.html';
    case 'css':
      return 'styles.css';
    case 'javascript':
    case 'js':
      return 'app.js';
    case 'typescript':
    case 'ts':
      return 'app.ts';
    case 'json':
      return 'data.json';
    default:
      return 'code.txt';
  }
}

function sanitizeDisplayContent(raw: string): string {
  const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g;
  const markerCount = (raw.match(/```/g) || []).length;
  let result = raw;
  if (markerCount % 2 === 1) {
    const lastIdx = result.lastIndexOf('```');
    result = result.substring(0, lastIdx);
  }
  // Remove code blocks entirely — they're shown in the editor/preview panel, not the chat
  return result.replace(codeBlockRegex, '');
}

function parseCodeBlocks(content: string): {
  files: GeneratedFile[];
  displayContent: string;
  fullHtml: string;
} {
  const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g;
  const files: GeneratedFile[] = [];
  let htmlCode = '';
  let cssCode = '';
  let jsCode = '';

  let match;
  let fileIndex = 0;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    const language = match[1].toLowerCase() || 'text';
    const code = match[2].trim();

    const file: GeneratedFile = {
      id: `file-${fileIndex++}`,
      name: getFileName(language),
      icon: getFileIcon(language),
      language: language === 'js' ? 'javascript' : language,
      code,
    };
    files.push(file);

    if (language === 'html') {
      htmlCode = code;
    } else if (language === 'css') {
      cssCode = code;
    } else if (language === 'javascript' || language === 'js') {
      jsCode = code;
    }
  }

  const displayContent = sanitizeDisplayContent(content);

  let fullHtml = '';
  if (files.length > 0) {
    if (htmlCode) {
      if (htmlCode.includes('<head>') || htmlCode.includes('<html')) {
        fullHtml = htmlCode;
        if (cssCode) {
          fullHtml = fullHtml.replace('</head>', `<style>\n${cssCode}\n</style>\n</head>`);
        }
        if (jsCode) {
          fullHtml = fullHtml.replace('</body>', `<script>\n${jsCode}\n</script>\n</body>`);
        }
      } else {
        fullHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Preview</title>
  ${cssCode ? `<style>\n${cssCode}\n</style>` : ''}
</head>
<body>
${htmlCode}
${jsCode ? `<script>\n${jsCode}\n</script>` : ''}
</body>
</html>`;
      }
    } else if (cssCode || jsCode) {
      fullHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Preview</title>
  ${cssCode ? `<style>\n${cssCode}\n</style>` : ''}
</head>
<body>
${jsCode ? `<script>\n${jsCode}\n</script>` : ''}
</body>
</html>`;
    }
  }

  // Fallback for non-HTML/CSS/JS files (markdown, json, etc.)
  if (!fullHtml && files.length > 0) {
    const bodies = files.map((f) => {
      if (f.language === 'markdown' || f.name.endsWith('.md')) {
        // Simple Markdown → HTML conversion for preview
        const html = f.code
          .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
          .replace(/^### (.+)$/gm, '<h3>$1</h3>')
          .replace(/^## (.+)$/gm, '<h2>$1</h2>')
          .replace(/^# (.+)$/gm, '<h1>$1</h1>')
          .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
          .replace(/\*(.+?)\*/g, '<em>$1</em>')
          .replace(/`([^`]+)`/g, '<code>$1</code>')
          .replace(/^- (.+)$/gm, '<li>$1</li>')
          .replace(/\n\n/g, '</p><p>')
          .replace(/\n/g, '<br>');
        return `<div class="markdown">${html}</div>`;
      }
      return `<h3>${f.name}</h3><pre>${f.code}</pre>`;
    }).join('\n');
    fullHtml = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Preview</title>
<style>body{font-family:sans-serif;padding:20px;color:#333;max-width:800px;margin:0 auto}
.markdown h1{font-size:1.5em;border-bottom:1px solid #eee;padding-bottom:0.3em}
.markdown h2{font-size:1.3em;border-bottom:1px solid #eee;padding-bottom:0.2em}
.markdown code{background:#f5f5f5;padding:2px 6px;border-radius:3px;font-size:0.9em}
.markdown li{margin:4px 0}
pre{background:#f5f5f5;padding:12px;border-radius:6px;overflow:auto;font-size:0.9em}
</style></head><body>${bodies}</body></html>`;
  }

  return { files, displayContent, fullHtml };
}

function formatTimestamp(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${month}-${day} ${hours}:${minutes}`;
}

/** Filter out transient error/loading messages before persisting to storage.
 *  Error messages (⚠️) are ephemeral UI state — they should not survive page refresh. */
function filterTransientForSave(msgs: Message[]): Message[] {
  return msgs.filter((m) => {
    if (m.role !== 'assistant') return true;
    // Never persist error messages — they only make sense in the current session
    if (m.content.startsWith('⚠️')) return false;
    return true;
  });
}

/** Clean up loaded messages so stale stream states don't confuse the user.
 *  - Empty assistant content → show an "interrupted" notice
 *  - Error messages that slipped through → remove them */
function sanitizeLoadedMessages(msgs: Message[]): Message[] {
  return msgs
    .filter((m) => {
      if (m.role !== 'assistant') return true;
      // Strip any error messages that were persisted before the fix
      if (m.content.startsWith('⚠️')) return false;
      return true;
    })
    .map((m) => {
      // Empty assistant messages with no content = interrupted stream
      if (m.role === 'assistant' && !m.content) {
        return { ...m, content: '⏸️ 对话已中断，你可以继续提问。' };
      }
      return m;
    });
}

interface TeamStreamState {
  teamMessages: Record<string, string>;
  completedAgents: Set<string>;
  doneHandled: boolean;
  planMsgId: string;
  teamBaseId: string;
}

export default function ChatPanel({
  onCodeGenerated,
  onCodeRestored,
  onConversationSaved,
  isLoggedIn,
  currentConvId,
  onCurrentConvIdChange,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const prevConvIdRef = useRef<string | null>(null);
  const currentConvIdRef = useRef(currentConvId);
  currentConvIdRef.current = currentConvId;
  const { workMode, setWorkMode, activeAgentId, agents, setAgentStatus, resetAgentStatuses } = useAgentContext();
  const pendingStreamRef = useRef<{
    convId: string;
    assistantId: string;
    accumulatedContent: string;
    baseMessages: Message[];
  } | null>(null);
  const requestConvIdRef = useRef<string | null>(null);
  const streamConvIdRef = useRef<string | null>(null);  // actual buffer key (may differ from requestConvIdRef for team fallback)
  const agentsMapRef = useRef<Record<string, AgentDef>>({});
  const streamStateRef = useRef<TeamStreamState | null>(null);
  const streamBuffers = useRef<Record<string, {
    messages: Message[];
    isTyping: boolean;
    timestamp: string;
    completedAgents: string[];
    planMsgId: string;
  }>>({});

  // Periodic stream progress save for resume-after-refresh support
  const SAVE_DEBOUNCE_MS = 800;
  const lastStreamSaveRef = useRef(0);

  useEffect(() => {
    const map: Record<string, AgentDef> = {};
    for (const a of agents) {
      map[a.id] = a;
    }
    agentsMapRef.current = map;
  }, [agents]);

  const cleanupStream = () => {
    const ss = streamStateRef.current;
    if (ss && !ss.doneHandled) {
      ss.doneHandled = true;
    }
    // Use streamConvIdRef for accurate buffer key (handles _team_ fallback)
    const scId = streamConvIdRef.current || requestConvIdRef.current;
    if (scId && streamBuffers.current[scId]) {
      streamBuffers.current[scId].isTyping = false;
    }
    setIsTyping(false);
    pendingStreamRef.current = null;
    streamStateRef.current = null;
    streamConvIdRef.current = null;
  };

  const abortGeneration = () => {
    abortRef.current = true;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    // Capture stream state BEFORE cleanup (cleanupStream nulls streamStateRef)
    const ss = streamStateRef.current;
    // Save partial conversation state before cleanup
    const scId = streamConvIdRef.current || requestConvIdRef.current;
    if (scId && streamBuffers.current[scId]) {
      const buf = streamBuffers.current[scId];
      const stoppedMsgs = [...buf.messages];
      // Mark the last streaming message as stopped
      const lastMsg = stoppedMsgs[stoppedMsgs.length - 1];
      if (lastMsg?.role === 'assistant' && !lastMsg.content) {
        stoppedMsgs[stoppedMsgs.length - 1] = { ...lastMsg, content: '⏸️ 已停止生成' };
      }
      streamBuffers.current[scId].messages = stoppedMsgs;
      streamBuffers.current[scId].isTyping = false;
      saveConversation(stoppedMsgs, requestConvIdRef.current || undefined, true);
    } else if (requestConvIdRef.current === currentConvIdRef.current) {
      // Single-agent mode: save current messages with stop marker
      setMessages((prev) => {
        const updated = [...prev];
        const lastMsg = updated[updated.length - 1];
        if (lastMsg?.role === 'assistant') {
          updated[updated.length - 1] = { ...lastMsg, content: lastMsg.content || '⏸️ 已停止生成' };
        }
        saveConversation(updated, undefined, true);
        return updated;
      });
    }
    cleanupStream();
    // Use captured stream state to reset only active agents
    if (ss && ss.completedAgents.size > 0) {
      // Team mode: only complete agents not yet done
      if (!ss.completedAgents.has('mike')) setAgentStatus('mike', 'completed');
      if (!ss.completedAgents.has('alex')) setAgentStatus('alex', 'completed');
      if (!ss.completedAgents.has('emma')) setAgentStatus('emma', 'completed');
    } else {
      // Single-agent mode
      resetAgentStatuses();
    }
  };

  useEffect(() => {
    if (currentConvId === prevConvIdRef.current) return;

    const prevId = prevConvIdRef.current;
    const abortController = new AbortController();
    const signal = abortController.signal;

    if (prevId !== null && streamBuffers.current[prevId]) {
      const buf = streamBuffers.current[prevId];
      // Don't overwrite buffer messages with potentially stale React state.
      // The buffer is already kept up-to-date by the token handlers regardless
      // of whether the user is viewing this conversation.
      // Don't overwrite isTyping either — the buffer state is authoritative.
      const ss = streamStateRef.current;
      buf.completedAgents = ss ? Array.from(ss.completedAgents) : [];
      saveConversation(buf.messages, prevId, true);
    }
    if (prevId && messagesRef.current.length > 0 && !streamBuffers.current[prevId]) {
      const msgs = [...messagesRef.current];
      const pending = pendingStreamRef.current;
      if (!pending || pending.convId !== prevId) {
        const lastMsg = msgs[msgs.length - 1];
        if (lastMsg?.role === 'assistant') {
          const content = lastMsg.content || '';
          if (content.startsWith('⏳') || content.startsWith('⚠️')) {
            msgs.pop();
          }
        }
      }
      saveConversation(msgs, prevId);
    }

    prevConvIdRef.current = currentConvId;

    // Clean up stale buffers: remove entries for completed/non-streaming conversations
    // Keep at most 10 buffer entries to prevent memory leaks over long sessions
    const bufferKeys = Object.keys(streamBuffers.current);
    if (bufferKeys.length > 10) {
      // Remove oldest completed buffers first.
      // Protect: active buffers (isTyping=true), current conversation, and temporary buffers
      // (_team_ for team mode, _single_ for individual mode)
      const staleKeys = bufferKeys
        .filter(k => !streamBuffers.current[k].isTyping && k !== currentConvId
          && !k.startsWith('_team_') && !k.startsWith('_single_'))
        .slice(0, bufferKeys.length - 10);
      staleKeys.forEach(k => delete streamBuffers.current[k]);
    }
    // Remove completed temp buffers for conversations we're no longer viewing
    if (currentConvId === null) {
      Object.keys(streamBuffers.current).forEach(k => {
        if (k.startsWith('_team_') || k.startsWith('_single_')) {
          delete streamBuffers.current[k];
        }
      });
    }

    let buf = currentConvId ? streamBuffers.current[currentConvId] : undefined;
    // Fallback: search for temporary buffers (new conversations without an ID at start)
    if (!buf && currentConvId) {
      const fallbackKey = Object.keys(streamBuffers.current).find(k => k.startsWith('_team_') || k.startsWith('_single_'));
      if (fallbackKey) buf = streamBuffers.current[fallbackKey];
    }
    if (buf) {
      setMessages(buf.messages);
      if (buf.isTyping) setIsTyping(true);
      if (buf.completedAgents) {
        streamStateRef.current = {
          teamMessages: {},
          completedAgents: new Set(buf.completedAgents),
          doneHandled: false,
          planMsgId: buf.planMsgId || '',
          teamBaseId: '',
        };
      }
      return;
    }

    if (currentConvId === null) {
      setMessages([]);
      setIsTyping(false);
      return;
    }

    const pending = pendingStreamRef.current;
    if (pending && pending.convId === currentConvId) {
      setMessages([
        ...pending.baseMessages,
        {
          id: pending.assistantId,
          role: 'assistant' as const,
          content: pending.accumulatedContent || '⏳ 正在思考...',
        },
      ]);
      setIsTyping(true);
      return;
    }

    setIsTyping(false);

    const restoreCodeFromMessages = (msgs: Message[]) => {
      if (!onCodeRestored) return;
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].role === 'assistant' && msgs[i].content) {
          const { files, fullHtml } = parseCodeBlocks(msgs[i].content);
          if (files.length > 0) {
            onCodeRestored(files, fullHtml);
            return;  // Found the last message with code, restore and stop
          }
        }
      }
    };

    const loadConversation = async () => {
      if (signal.aborted) return;

      const backupKey = `atoms_backup_${currentConvId}`;
      try {
        const backup = localStorage.getItem(backupKey);
        if (backup) {
          const parsed = JSON.parse(backup);
          const { messages: msgStr, streaming, lastUpdated, retryCount: bakRetryCount, workMode: backupWorkMode } = parsed;
          if (msgStr) {
            const rawMsgs = JSON.parse(msgStr);
            if (!signal.aborted && Array.isArray(rawMsgs) && rawMsgs.length > 0) {
              const msgs = sanitizeLoadedMessages(rawMsgs);
              setMessages(msgs);
              restoreCodeFromMessages(msgs);

              // ── Auto-retry detection ──────────────────────────────
              // Check if the last assistant message looks incomplete —
              // empty content or a transient placeholder (⏸️ ⏳ 🔄).
              // This catches interrupted streams regardless of whether
              // the streaming flag was persisted correctly.
              const lastMsg = msgs[msgs.length - 1];
              const isIncomplete = lastMsg?.role === 'assistant' && (
                !lastMsg.content ||
                lastMsg.content.startsWith('⏸️') ||
                lastMsg.content.startsWith('⏳') ||
                lastMsg.content.startsWith('🔄')
              );

              if (isIncomplete) {
                const mode = (backupWorkMode === 'team' || backupWorkMode === 'engineer')
                  ? backupWorkMode as WorkMode : workMode;
                const retryCnt = (bakRetryCount as number) || 0;
                const MAX_RETRY = 3;
                if (retryCnt < MAX_RETRY) {
                  let lastUserIdx = -1;
                  for (let i = msgs.length - 1; i >= 0; i--) {
                    if (msgs[i].role === 'user') { lastUserIdx = i; break; }
                  }
                  const cleanMsgs = lastUserIdx >= 0 ? msgs.slice(0, lastUserIdx + 1) : msgs;
                  doRecover(cleanMsgs, currentConvId!, mode, retryCnt + 1, parsed);
                }
              }
              return;
            }
          }
        }
      } catch { /* ignore corrupt backup */ }

      // Fallback: always try atoms_backup_latest.  This catches cases
      // where the primary backup key doesn't match (e.g. conversation ID
      // changed, or save raced with refresh).
      try {
        const latest = localStorage.getItem('atoms_backup_latest');
        if (latest) {
          const parsed = JSON.parse(latest);
          const { messages: msgStr, streaming: fbStreaming, lastUpdated: fbUpdated, retryCount: fbRetry, workMode: fbMode } = parsed;
          if (msgStr) {
            const rawMsgs = JSON.parse(msgStr);
            if (!signal.aborted && Array.isArray(rawMsgs) && rawMsgs.length > 0) {
              const msgs = sanitizeLoadedMessages(rawMsgs);
              setMessages(msgs);
              restoreCodeFromMessages(msgs);

              const lastMsg = msgs[msgs.length - 1];
              const isIncomplete = lastMsg?.role === 'assistant' && (
                !lastMsg.content ||
                lastMsg.content.startsWith('⏸️') ||
                lastMsg.content.startsWith('⏳') ||
                lastMsg.content.startsWith('🔄')
              );

              if (isIncomplete) {
                const mode = (fbMode === 'team' || fbMode === 'engineer')
                  ? fbMode as WorkMode : workMode;
                const retryCnt = (fbRetry as number) || 0;
                const MAX_RETRY = 3;
                if (retryCnt < MAX_RETRY) {
                  let lastUserIdx = -1;
                  for (let i = msgs.length - 1; i >= 0; i--) {
                    if (msgs[i].role === 'user') { lastUserIdx = i; break; }
                  }
                  const cleanMsgs = lastUserIdx >= 0 ? msgs.slice(0, lastUserIdx + 1) : msgs;
                  doRecover(cleanMsgs, (parsed.id as string) || currentConvId || 'recovery', mode, retryCnt + 1, parsed);
                }
              }
              return;
            }
          }
        }
      } catch { /* ignore */ }

      // Helper: trigger retry if the last assistant message is incomplete
      const maybeRetry = (msgs: Message[], mode: WorkMode, convId: string, retryCnt: number, backup: Record<string, unknown>) => {
        const lastM = msgs[msgs.length - 1];
        const incomplete = lastM?.role === 'assistant' && (
          !lastM.content ||
          lastM.content.startsWith('⏸️') ||
          lastM.content.startsWith('⏳') ||
          lastM.content.startsWith('🔄')
        );
        if (!incomplete || retryCnt >= 3) return;
        let lastUserIdx = -1;
        for (let i = msgs.length - 1; i >= 0; i--) {
          if (msgs[i].role === 'user') { lastUserIdx = i; break; }
        }
        const cleanMsgs = lastUserIdx >= 0 ? msgs.slice(0, lastUserIdx + 1) : msgs;
        doRecover(cleanMsgs, convId, mode, retryCnt + 1, backup);
      };

      if (isLoggedIn) {
        try {
          const data = await api.get<any>(`/api/v1/entities/conversations/${currentConvId}`);
          if (signal.aborted) return;
          if (data?.messages) {
            const rawParsed = JSON.parse(data.messages as string);
            if (!signal.aborted) {
              const parsed = sanitizeLoadedMessages(rawParsed);
              setMessages(parsed);
              restoreCodeFromMessages(parsed);
              maybeRetry(parsed, workMode, currentConvId!, 0, {});
            }
          }
        } catch { /* fall back silently */ }
      } else {
        const localConvs = getLocalConversations();
        const conv = localConvs.find((c) => c.id === currentConvId);
        if (conv?.messages) {
          try {
            const rawParsed = JSON.parse(conv.messages);
            if (!signal.aborted) {
              const parsed = sanitizeLoadedMessages(rawParsed);
              setMessages(parsed);
              restoreCodeFromMessages(parsed);
              maybeRetry(parsed, workMode, currentConvId!, 0, {});
            }
          } catch { /* ignore */ }
        }
      }
    };

    loadConversation();

    return () => {
      abortController.abort();
    };
  }, [currentConvId, isLoggedIn]);

  const saveConversation = useCallback(
    async (msgs: Message[], convIdOverride?: string, silent?: boolean): Promise<string | null> => {
      const targetConvId = convIdOverride ?? currentConvIdRef.current;
      // Strip transient error/loading messages before persisting — they should
      // not survive a page refresh and confuse the user on next load.
      const cleanMsgs = filterTransientForSave(msgs);
      const saveMsgs = cleanMsgs.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        agentId: m.agentId,
        taskTitle: m.taskTitle,
        timestamp: m.timestamp,
      }));
      const messagesStr = JSON.stringify(saveMsgs);
      const title =
        [...(msgs.find((m) => m.role === 'user')?.content || '新对话')].slice(0, 50).join('') || '新对话';

      const backupKey = targetConvId ? `atoms_backup_${targetConvId}` : 'atoms_backup_pending';
      try {
        localStorage.setItem(backupKey, JSON.stringify({ title, messages: messagesStr, id: targetConvId }));
      } catch { /* storage full — ignore */ }

      if (isLoggedIn) {
        try {
          const saveBody: Record<string, any> = { title, messages: messagesStr };
          if (targetConvId) {
            await api.put(`/api/v1/entities/conversations/${targetConvId}`, saveBody);
            if (!silent) onConversationSaved?.(targetConvId);
            return targetConvId;
          } else {
            const data = await api.post<any>('/api/v1/entities/conversations', saveBody);
            if (data?.id) {
              const newId = String(data.id);
              prevConvIdRef.current = newId;
              onCurrentConvIdChange?.(newId);
              if (!silent) onConversationSaved?.(newId);
              return newId;
            }
          }
        } catch { /* silently handle save errors */ }
      } else {
        const localConvs = getLocalConversations();
        if (targetConvId) {
          const idx = localConvs.findIndex((c) => c.id === targetConvId);
          if (idx >= 0) {
            localConvs[idx].title = title;
            localConvs[idx].messages = messagesStr;
          }
          saveLocalConversations(localConvs);
          if (!silent) onConversationSaved?.(targetConvId);
          return targetConvId;
        } else {
          const newId = `local-${Date.now()}`;
          localConvs.unshift({
            id: newId,
            title,
            messages: messagesStr,
            created_at: new Date().toISOString(),
          });
          saveLocalConversations(localConvs);
          prevConvIdRef.current = newId;
          onCurrentConvIdChange?.(newId);
          if (!silent) onConversationSaved?.(newId);
          return newId;
        }
      }
      return null;
    },
    [isLoggedIn, currentConvId, onConversationSaved, onCurrentConvIdChange]
  );

  /** Lightweight localStorage-only save of stream progress.
   *  Called periodically during streaming so that partial content survives
   *  a page refresh and can be used for auto-retry.  Does NOT call the
   *  backend API — that's saveConversation's job at stream boundaries. */
  const saveStreamProgress = useCallback((convId: string) => {
    if (!convId || abortRef.current) return;

    const now = Date.now();
    if (now - lastStreamSaveRef.current < SAVE_DEBOUNCE_MS) return;
    lastStreamSaveRef.current = now;

    const buf = streamBuffers.current[convId];
    if (!buf || !buf.messages.length) return;

    const cleanMsgs = filterTransientForSave(buf.messages);
    const messagesStr = JSON.stringify(cleanMsgs);
    const title =
      [...(cleanMsgs.find((m) => m.role === 'user')?.content || '新对话')].slice(0, 50).join('') || '新对话';

    const backupKey = `atoms_backup_${convId}`;
    try {
      // Read existing backup to preserve retryCount if present
      let existing: Record<string, unknown> = {};
      try { existing = JSON.parse(localStorage.getItem(backupKey) || '{}'); } catch { /* ignore */ }
      const backupPayload = {
        title,
        messages: messagesStr,
        id: convId,
        streaming: true,
        lastUpdated: now,
        workMode: (existing.workMode as string) || workMode,
        retryCount: (existing.retryCount as number) || 0,
      };
      localStorage.setItem(backupKey, JSON.stringify(backupPayload));
      // Also write to fallback keys so loadConversation can recover even
      // when the conversation-id-based key is missing or mismatched.
      try { localStorage.setItem('atoms_backup_latest', JSON.stringify(backupPayload)); } catch { /* ignore */ }
    } catch { /* storage full — silently ignore */ }
  }, [workMode]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const processAIResponse = useCallback(
    (content: string) => {
      const { files, displayContent, fullHtml } = parseCodeBlocks(content);
      if (files.length > 0) {
        onCodeGenerated?.(files, fullHtml);
      }
      return files.length > 0 ? displayContent : content;
    },
    [onCodeGenerated]
  );

  const handleStop = () => {
    // abortGeneration now handles both single-agent and team modes,
    // including saving partial state and marking stopped messages
    abortGeneration();
  };

  /** Direct recovery: called inline from loadConversation when an
   *  interrupted stream is detected.  No state triggers, no effects —
   *  just sets up state, calls the API, and streams the result. */
  const doRecover = (cleanMsgs: Message[], convId: string, mode: WorkMode, attemptCount: number, backupData: Record<string, unknown>) => {
    try {
      const backupKey = `atoms_backup_${convId}`;
      localStorage.setItem(backupKey, JSON.stringify({ ...backupData, streaming: false }));
    } catch { /* ignore */ }

    const resumeAssistantId = `resume-${Date.now()}`;
    const now = formatTimestamp();
    const effectiveAgentId = mode === 'team' ? 'mike' : (activeAgentId || 'alex');

    abortRef.current = false;
    abortControllerRef.current = new AbortController();
    pendingStreamRef.current = { convId, assistantId: resumeAssistantId, accumulatedContent: '', baseMessages: cleanMsgs };
    streamConvIdRef.current = convId;
    requestConvIdRef.current = convId;

    const placeholder: Message = { id: resumeAssistantId, role: 'assistant' as const, content: '⏸️ 对话已中断，正在恢复...', timestamp: now, agentId: effectiveAgentId };
    setMessages([...cleanMsgs, placeholder]);
    setIsTyping(true);
    streamBuffers.current[convId] = { messages: [...cleanMsgs, placeholder], isTyping: true, timestamp: now, completedAgents: [], planMsgId: resumeAssistantId };

    let accumulatedContent = '';

    const onToken = (token: string) => {
      accumulatedContent += token;
      if (pendingStreamRef.current) pendingStreamRef.current.accumulatedContent = accumulatedContent;
      setMessages((prev) => { const u = [...prev]; const idx = u.findIndex(m => m.id === resumeAssistantId); if (idx >= 0) u[idx] = { ...u[idx], content: accumulatedContent }; return u; });
      const buf = streamBuffers.current[convId]; if (buf) { const idx = buf.messages.findIndex(m => m.id === resumeAssistantId); if (idx >= 0) buf.messages[idx] = { ...buf.messages[idx], content: accumulatedContent }; }
      saveStreamProgress(convId);
    };

    const onDone = (extra?: Record<string, any>) => {
      const content = accumulatedContent || '未收到回复';
      const display = processAIResponse(content);
      const final: Message[] = [...cleanMsgs, { id: resumeAssistantId, role: 'assistant' as const, content, displayContent: display, agentId: extra?.agent_id || effectiveAgentId, timestamp: formatTimestamp() }];
      const buf = streamBuffers.current[convId]; if (buf) { buf.messages = final; buf.isTyping = false; }
      setMessages(final); setIsTyping(false);
      saveConversation(final, convId, false);
      pendingStreamRef.current = null;
    };

    const onErr = (error: string) => {
      if (abortRef.current) { pendingStreamRef.current = null; return; }
      const errMsgs: Message[] = [...cleanMsgs, { id: resumeAssistantId, role: 'assistant' as const, content: `⚠️ ${error}`, agentId: effectiveAgentId, timestamp: formatTimestamp() }];
      const buf = streamBuffers.current[convId]; if (buf) { buf.messages = errMsgs; buf.isTyping = false; }
      setMessages(errMsgs); setIsTyping(false);
      saveConversation(errMsgs, convId, true);
      pendingStreamRef.current = null;
    };

    const apiMessages = [{ role: 'system' as const, content: SYSTEM_PROMPT }, ...cleanMsgs.map(m => ({ role: m.role as 'user'|'assistant', content: m.content }))];

    (async () => {
      try {
        if (mode === 'team') {
          const labels: Record<string,string> = { alex: '👨‍💻 Alex(工程师)', emma: '📋 Emma(产品)' };
          await api.postStream('/api/v1/agents/team/chat/stream', { messages: apiMessages.slice(1) }, {
            onEvent: (ev: Record<string,any>) => {
              if (abortRef.current) return;
              switch (ev.type) {
                case 'token': onToken(ev.token || ''); break;
                case 'plan': { const tf = (ev.tasks || []).map((t: any,i: number) => `${i+1}. ${labels[t.agent_id]||t.agent_id} — ${t.title}`).join('\n'); onToken(`\n\n---\n\n📋 **执行计划**\n\n${tf}`); break; }
                case 'task_start': case 'task_complete': case 'phase': break;
                case 'need_clarify': onErr('需要更多信息才能继续，请补充你的需求描述。'); break;
                case 'error': onErr(ev.error || '系统异常'); break;
              }
            },
            onDone: () => onDone(),
            onError: (e: string) => onErr(e),
          }, abortControllerRef.current?.signal);
        } else {
          await api.postStream('/api/v1/agents/chat/stream', { agent_id: effectiveAgentId, messages: apiMessages }, {
            onToken: (t: string) => { if (!abortRef.current) onToken(t); },
            onDone: (extra?: Record<string,any>) => onDone(extra || { agent_id: effectiveAgentId }),
            onError: (e: string) => onErr(e),
          }, abortControllerRef.current?.signal);
        }
      } catch (e: unknown) {
        if (!abortRef.current) onErr('系统异常，请稍后重试。');
        cleanupStream();
      } finally {
        abortControllerRef.current = null;
      }
    })();
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    // If there's an active stream for the CURRENT conversation, block sending
    if (isTyping && pendingStreamRef.current?.convId === currentConvId) return;

    // If there's a background stream for a DIFFERENT conversation, abort it first
    // so we can start a new stream for this conversation
    if (pendingStreamRef.current && pendingStreamRef.current.convId !== currentConvId) {
      abortGeneration();
    }

    // Reset stream tracking refs for the new request
    streamConvIdRef.current = null;
    requestConvIdRef.current = null;

    const effectiveAgentId = workMode === 'team' ? 'mike' : (activeAgentId || null);

    const now = formatTimestamp();

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: now,
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setIsTyping(true);
    abortRef.current = false;

    const assistantId = (Date.now() + 1).toString();

    // 立即创建/更新对话，确保左侧列表即时出现新条目
    const savedConvId = await saveConversation(updatedMessages);
    const effectiveConvId = savedConvId ?? currentConvId;
    requestConvIdRef.current = effectiveConvId;
    pendingStreamRef.current = {
      convId: effectiveConvId!,
      assistantId,
      accumulatedContent: '',
      baseMessages: updatedMessages,
    };

    const apiMessages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...updatedMessages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    ];

    abortControllerRef.current = new AbortController();

    if (workMode !== 'team') {
      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: 'assistant', content: '', timestamp: now, agentId: effectiveAgentId || undefined },
      ]);
      // Create stream buffer for background streaming support (consistent with team mode)
      const singleConvId = effectiveConvId || `_single_${assistantId}`;
      streamConvIdRef.current = singleConvId;
      streamBuffers.current[singleConvId] = {
        messages: [...updatedMessages, { id: assistantId, role: 'assistant', content: '', timestamp: now, agentId: effectiveAgentId || undefined }],
        isTyping: true,
        timestamp: now,
        completedAgents: [],
        planMsgId: assistantId,
      };
      // Immediately persist with streaming=true so a refresh during "thinking"
      // (before any token arrives) still triggers auto-retry
      saveStreamProgress(singleConvId);
    }

    if (abortRef.current) return;

    let accumulatedContent = '';
    let finalAgentId: string | undefined;

    const handleStreamToken = (token: string) => {
      accumulatedContent += token;
      // Keep pendingStreamRef up-to-date so conversation switch can recover tokens
      if (pendingStreamRef.current) {
        pendingStreamRef.current.accumulatedContent = accumulatedContent;
      }
      if (requestConvIdRef.current === currentConvIdRef.current) {
        setMessages((prev) => {
          const updated = [...prev];
          const lastMsg = updated[updated.length - 1];
          if (lastMsg?.id === assistantId) {
            updated[updated.length - 1] = { ...lastMsg, content: accumulatedContent };
          }
          return updated;
        });
      } else {
        // Background streaming: keep streamBuffers up-to-date so switching back recovers all tokens
        const scId = streamConvIdRef.current || requestConvIdRef.current;
        if (scId && streamBuffers.current[scId]) {
          const buf = streamBuffers.current[scId];
          const idx = buf.messages.findIndex((m: any) => m.id === assistantId);
          if (idx >= 0) {
            buf.messages[idx] = { ...buf.messages[idx], content: accumulatedContent };
          }
        }
      }
      // Periodic save for resume-after-refresh support
      const scId = streamConvIdRef.current || requestConvIdRef.current;
      if (scId) saveStreamProgress(scId);
    };

    const handleStreamDone = (extra?: Record<string, any>) => {
      const agentId = extra?.agent_id || effectiveAgentId || undefined;
      finalAgentId = agentId;
      const content = accumulatedContent || '未收到回复';
      const display = processAIResponse(content);
      const replyTimestamp = formatTimestamp();
      const finalMessages: Message[] = [
        ...updatedMessages,
        { id: assistantId, role: 'assistant', content, displayContent: display, agentId, timestamp: replyTimestamp },
      ];
      // Update stream buffer so conversation switch recovery picks up the completed state
      const scId = streamConvIdRef.current || requestConvIdRef.current;
      if (scId && streamBuffers.current[scId]) {
        streamBuffers.current[scId].messages = finalMessages;
        streamBuffers.current[scId].isTyping = false;
      }
      if (requestConvIdRef.current === currentConvIdRef.current) {
        setMessages(finalMessages);
        setIsTyping(false);
        saveConversation(finalMessages);
      } else {
        setIsTyping(false);
        // Use the convId we already assigned, not undefined (prevents duplicate creation)
        saveConversation(finalMessages, requestConvIdRef.current || undefined, true);
      }
      pendingStreamRef.current = null;
    };

    const handleStreamError = (error: string) => {
      if (abortRef.current) {
        pendingStreamRef.current = null;
        return;
      }
      const errorTimestamp = formatTimestamp();
      const errorMessages: Message[] = [
        ...updatedMessages,
        {
          id: assistantId,
          role: 'assistant',
          content: `⚠️ ${error}`,
          agentId: effectiveAgentId || undefined,
          timestamp: errorTimestamp,
        },
      ];
      // Update stream buffer so conversation switch recovery picks up the error state
      const scId = streamConvIdRef.current || requestConvIdRef.current;
      if (scId && streamBuffers.current[scId]) {
        streamBuffers.current[scId].messages = errorMessages;
        streamBuffers.current[scId].isTyping = false;
      }
      if (requestConvIdRef.current === currentConvIdRef.current) {
        setMessages(errorMessages);
      }
      setIsTyping(false);
      saveConversation(errorMessages, requestConvIdRef.current || undefined, requestConvIdRef.current !== currentConvIdRef.current);
      pendingStreamRef.current = null;
    };

    try {
      if (workMode === 'team') {
        // Reset agent statuses from any previous conversation
        resetAgentStatuses();
        const teamBaseId = Date.now().toString();
        const streamState: TeamStreamState = {
          teamMessages: {},
          completedAgents: new Set(),
          doneHandled: false,
          planMsgId: `${teamBaseId}-plan`,
          teamBaseId,
        };
        streamStateRef.current = streamState;
        const { teamMessages, planMsgId } = streamState;

        if (abortRef.current) return;

        setMessages((prev) => [...prev, { id: planMsgId, role: 'assistant', content: '', agentId: 'mike', timestamp: now }]);

        const streamConvId = effectiveConvId || `_team_${teamBaseId}`;
        streamConvIdRef.current = streamConvId;  // track actual buffer key for cleanup
        streamBuffers.current[streamConvId] = {
          messages: [...updatedMessages, { id: planMsgId, role: 'assistant', content: '', agentId: 'mike', timestamp: now }],
          isTyping: true,
          timestamp: now,
          completedAgents: [],
          planMsgId,
        };
        // Immediately persist with streaming=true so a refresh during "thinking"
        // (before any token arrives) still triggers auto-retry
        saveStreamProgress(streamConvId);

        const finishTeamStream = (finalMsgs?: Message[]) => {
          if (streamState.doneHandled) return;
          streamState.doneHandled = true;
          const buf = streamBuffers.current[streamConvId];
          const msgs = finalMsgs || (buf ? buf.messages : messagesRef.current);
          if (buf) buf.messages = msgs;
          saveConversation(msgs);
          cleanupStream();
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
                  // Use teamBaseId-scoped message ID so tokens only update the current round's bubble
                  const taskMsgId = tId ? `${teamBaseId}-task${tId}` : '';

                  if (isActiveConv) {
                    setMessages((prev) => {
                      const u = [...prev];
                      if (tId && taskMsgId) {
                        const idx = u.findIndex((m) => m.id === taskMsgId);
                        if (idx >= 0) u[idx] = { ...u[idx], content: teamMessages[key] };
                      } else {
                        const idx = u.findIndex((m) => m.id === planMsgId);
                        if (idx >= 0) u[idx] = { ...u[idx], content: teamMessages[key] };
                      }
                      return u;
                    });
                    // Update buffer after React state is settled (avoid side-effects in updater)
                    if (streamBuffers.current[streamConvId]) {
                      const buf = streamBuffers.current[streamConvId];
                      if (tId && taskMsgId) {
                        const idx = buf.messages.findIndex((m: any) => m.id === taskMsgId);
                        if (idx >= 0) buf.messages[idx] = { ...buf.messages[idx], content: teamMessages[key] };
                      } else {
                        const idx = buf.messages.findIndex((m: any) => m.id === planMsgId);
                        if (idx >= 0) buf.messages[idx] = { ...buf.messages[idx], content: teamMessages[key] };
                      }
                    }
                  } else if (streamBuffers.current[streamConvId]) {
                    const buf = streamBuffers.current[streamConvId];
                    if (tId && taskMsgId) {
                      const idx = buf.messages.findIndex((m: any) => m.id === taskMsgId);
                      if (idx >= 0) buf.messages[idx] = { ...buf.messages[idx], content: teamMessages[key] };
                    } else {
                      const idx = buf.messages.findIndex((m: any) => m.id === planMsgId);
                      if (idx >= 0) buf.messages[idx] = { ...buf.messages[idx], content: teamMessages[key] };
                    }
                  }
                  // Periodic save for resume-after-refresh support
                  saveStreamProgress(streamConvId);
                  break;
                }
                case 'plan': {
                  const thinkingContent = teamMessages['mike'] || '';
                  const agentLabels: Record<string, string> = { alex: '👨‍💻 Alex(工程师)', emma: '📋 Emma(产品)' };
                  const taskFlow = (event.tasks || []).map((t: any, i: number) => {
                    const who = agentLabels[t.agent_id] || t.agent_id;
                    return `${i + 1}. ${who} — ${t.title}`;
                  }).join('\n');
                  const sep = thinkingContent ? '\n\n---\n\n' : '';
                  const planContent = `${thinkingContent}${sep}📋 **执行计划**\n\n${taskFlow}`;
                  if (isActiveConv) {
                    setMessages((prev) => {
                      const u = [...prev];
                      const idx = u.findIndex((m) => m.id === planMsgId);
                      if (idx >= 0) {
                        u[idx] = {
                          ...u[idx],
                          content: planContent,
                          timestamp: formatTimestamp(),
                        };
                      }
                      return u;
                    });
                    // Update buffer after React state is settled
                    if (streamBuffers.current[streamConvId]) {
                      const buf = streamBuffers.current[streamConvId];
                      const idx = buf.messages.findIndex((m: any) => m.id === planMsgId);
                      if (idx >= 0) {
                        buf.messages[idx] = { ...buf.messages[idx], content: planContent, timestamp: formatTimestamp() };
                      }
                    }
                  } else if (streamBuffers.current[streamConvId]) {
                    const buf = streamBuffers.current[streamConvId];
                    const idx = buf.messages.findIndex((m: any) => m.id === planMsgId);
                    if (idx >= 0) {
                      buf.messages[idx] = { ...buf.messages[idx], content: planContent, timestamp: formatTimestamp() };
                    }
                  }
                  // Periodic save for resume-after-refresh support
                  saveStreamProgress(streamConvId);
                  break;
                }
                case 'task_start': {
                  setAgentStatus(event.agent_id, 'thinking');
                  const tId: number = event.task_id || Date.now();
                  teamMessages[`task${tId}`] = '';
                  const msgId = `${teamBaseId}-task${tId}`;
                  const newMsg = { id: msgId, role: 'assistant' as const, content: '', agentId: event.agent_id, taskTitle: event.title || '', taskId: tId, timestamp: formatTimestamp() };

                  if (isActiveConv) {
                    setMessages((prev) => {
                      if (prev.some((m) => m.id === msgId)) return prev;
                      return [...prev, newMsg];
                    });
                    // Update buffer after React state is settled
                    if (streamBuffers.current[streamConvId]) {
                      const buf = streamBuffers.current[streamConvId];
                      if (!buf.messages.some((m: any) => m.id === msgId)) buf.messages.push(newMsg);
                    }
                  } else if (streamBuffers.current[streamConvId]) {
                    const buf = streamBuffers.current[streamConvId];
                    if (!buf.messages.some((m: any) => m.id === msgId)) buf.messages.push(newMsg);
                  }
                  // Periodic save for resume-after-refresh support
                  saveStreamProgress(streamConvId);
                  break;
                }
                case 'task_complete': {
                  streamState.completedAgents.add(event.agent_id);
                  setAgentStatus(event.agent_id, 'completed');
                  if (event.agent_id === 'alex') {
                    const agentCode = teamMessages[`task${event.task_id}`] || '';
                    if (agentCode) {
                      const { files, fullHtml } = parseCodeBlocks(agentCode);
                      if (fullHtml) onCodeGenerated?.(files, fullHtml);
                      else if (files.length > 0) onCodeGenerated?.(files, '');
                      else onCodeGenerated?.([], `<html><body><pre>${agentCode}</pre></body></html>`);
                    }
                  }
                  break;
                }
                case 'need_clarify': {
                  // Add a visible feedback message before finishing the stream
                  const clarifyMsg = {
                    id: `${teamBaseId}-clarify`,
                    role: 'assistant' as const,
                    content: '⚠️ 需要更多信息才能继续，请补充你的需求描述。',
                    agentId: 'mike',
                    timestamp: formatTimestamp(),
                  };
                  if (isActiveConv) {
                    setMessages((prev) => [...prev, clarifyMsg]);
                  }
                  const buf = streamBuffers.current[streamConvId];
                  if (buf) {
                    buf.messages = [...buf.messages, clarifyMsg];
                    saveConversation(buf.messages);
                  }
                  finishTeamStream();
                  break;
                }
                case 'error': {
                  const errMsg = { id: `${teamBaseId}-err`, role: 'assistant' as const, content: `⚠️ ${event.error}`, agentId: 'mike', timestamp: formatTimestamp() };
                  if (isActiveConv) setMessages((prev) => [...prev, errMsg]);
                  const buf = streamBuffers.current[streamConvId];
                  if (buf) {
                    buf.messages = [...buf.messages, errMsg];
                    // Persist error message immediately so it survives page refresh
                    saveConversation(buf.messages);
                  }
                  cleanupStream();
                  break;
                }
                case 'done': {
                  streamState.completedAgents.add('mike');
                  setAgentStatus('mike', 'completed');

                  // Remove the plan bubble and add a completion message
                  const completionMsg = {
                    id: `${teamBaseId}-complete`,
                    role: 'assistant' as const,
                    content: '✅ 团队协作完成！所有任务已执行完毕。',
                    agentId: 'mike',
                    timestamp: formatTimestamp(),
                  };

                  if (isActiveConv) {
                    setMessages((prev) => [...prev.filter((m) => m.id !== planMsgId), completionMsg]);
                  }

                  const buf = streamBuffers.current[streamConvId];
                  if (buf) {
                    buf.messages = [...buf.messages.filter((m: any) => m.id !== planMsgId), completionMsg];
                    buf.isTyping = false;
                  }

                  const finalMsgs = buf ? buf.messages : messagesRef.current;
                  if (buf && !isActiveConv) {
                    setMessages(buf.messages);
                  }
                  finishTeamStream(finalMsgs);
                  break;
                }
              }
            },
            onDone: () => {
              // Stream ended without a proper 'done' event — treat as completion
              if (streamState.doneHandled) return;
              streamState.completedAgents.add('mike');
              setAgentStatus('mike', 'completed');
              const buf = streamBuffers.current[streamConvId];
              const finalMsgs = buf ? buf.messages : messagesRef.current;
              finishTeamStream(finalMsgs);
            },
            onError: (error: string) => {
              const scId = streamConvIdRef.current || streamConvId;
              const buf = scId ? streamBuffers.current[scId] : undefined;
              const errMsg = {
                id: `${teamBaseId}-err`,
                role: 'assistant' as const,
                content: `⚠️ ${error || '系统异常，请稍后重试。'}`,
                agentId: 'mike',
                timestamp: formatTimestamp(),
              };
              const errMessages = buf ? [...buf.messages, errMsg] : [...messagesRef.current, errMsg];
              if (buf) {
                buf.messages = errMessages;
                buf.isTyping = false;
                saveConversation(errMessages, requestConvIdRef.current || undefined, true);
              }
              if (currentConvIdRef.current === (requestConvIdRef.current || streamConvId)) {
                setMessages(errMessages);
              }
              cleanupStream();
              resetAgentStatuses();
            },
          },
          abortControllerRef.current?.signal,
        );
      } else {
        const agentId = effectiveAgentId || 'alex';
        await api.postStream(
          '/api/v1/agents/chat/stream',
          { agent_id: agentId, messages: apiMessages },
          {
            onToken: (token: string) => {
              if (abortRef.current) return;
              handleStreamToken(token);
            },
            onDone: (extra?: Record<string, any>) => {
              handleStreamDone(extra || { agent_id: agentId });
            },
            onError: (error: string) => {
              handleStreamError(error);
            },
          },
          abortControllerRef.current?.signal,
        );
      }
    } catch (e: unknown) {
      if (!abortRef.current) {
        const errorDetail = '系统异常，请稍后重试。';
        const errorTimestamp = formatTimestamp();
        const errorMessages: Message[] = [
          ...updatedMessages,
          { id: assistantId, role: 'assistant', content: `⚠️ ${errorDetail}`, agentId: effectiveAgentId || undefined, timestamp: errorTimestamp },
        ];
        const scId = streamConvIdRef.current || requestConvIdRef.current;
        if (scId && streamBuffers.current[scId]) {
          streamBuffers.current[scId].messages = errorMessages;
          streamBuffers.current[scId].isTyping = false;
        }
        if (requestConvIdRef.current === currentConvIdRef.current) {
          setMessages(errorMessages);
        }
        saveConversation(errorMessages, undefined, requestConvIdRef.current !== currentConvIdRef.current);
      }
      cleanupStream();
      setAgentStatus('mike', 'completed');
      setAgentStatus('alex', 'completed');
      setAgentStatus('emma', 'completed');
    } finally {
      abortControllerRef.current = null;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isStreamingToCurrentConv =
    isTyping && requestConvIdRef.current === currentConvId;
  const isStreamingForOtherConv =
    isTyping && !!requestConvIdRef.current && requestConvIdRef.current !== currentConvId;

  const handleModeChange = (mode: WorkMode) => {
    setWorkMode(mode);
    try { localStorage.setItem(WORK_MODE_STORAGE_KEY, mode); } catch {}
  };

  return (
    <div className="flex flex-col h-full bg-background border-r border-border relative">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleModeChange('engineer')}
            className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
              workMode === 'engineer'
                ? 'bg-gradient-to-r from-primary to-accent text-white shadow-md'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            个人对话
          </button>
          <button
            onClick={() => handleModeChange('team')}
            className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
              workMode === 'team'
                ? 'bg-gradient-to-r from-primary to-accent text-white shadow-md'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            团队协作
          </button>
        </div>
      </div>

      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-4">
          {messages.length === 0 && !isTyping && (
            <div className="flex flex-col items-center justify-center h-full min-h-[300px] py-12 px-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center mb-6">
                <Bot className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-xl font-semibold text-foreground mb-2">
                {workMode === 'team' ? '开始团队协作' : '你想构建什么？'}
              </h2>
              <p className="text-sm text-muted-foreground mb-8 text-center">
                {workMode === 'team' ? '描述你的想法，Mike 会协调团队为你实现' : '描述你的想法，我来帮你实现'}
              </p>
              <div className="grid grid-cols-1 gap-2 w-full max-w-sm">
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => setInput(prompt)}
                    className="text-left px-4 py-3 rounded-lg border border-border bg-muted text-sm text-foreground hover:border-primary/30 hover:bg-primary/5 transition-colors"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => {
            const agentInfo = msg.agentId
              ? agents.find((a: AgentDef) => a.id === msg.agentId)
              : null;

            if (agentInfo && msg.role === 'assistant') {
              // Only show streaming status for messages belonging to the current round (same teamBaseId).
              // Previous rounds' messages should always appear as completed.
              const currentTeamBaseId = streamStateRef.current?.teamBaseId;
              const isFromCurrentRound = currentTeamBaseId
                ? msg.id.includes(currentTeamBaseId)
                : false;
              const agentDone = streamStateRef.current?.completedAgents.has(msg.agentId || '');
              const isStreaming = workMode === 'team'
                ? isTyping && isFromCurrentRound && !agentDone
                : isTyping && msg.id === pendingStreamRef.current?.assistantId;
              // Agent-specific status labels
              const agentStatusMap: Record<string, string> = {
                alex: 'coding',
                emma: 'planning',
              };
              const streamStatus = agentStatusMap[msg.agentId || ''] || 'thinking';
              return (
                <AgentMessageBubble
                  key={msg.id}
                  agent={agentInfo}
                  content={sanitizeDisplayContent(msg.content)}
                  status={isStreaming ? streamStatus : 'completed'}
                  taskTitle={msg.taskTitle}
                  timestamp={msg.timestamp}
                />
              );
            }

            return (
              <div
                key={msg.id}
                className={`flex gap-3 fade-in-up group ${
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {msg.role === 'assistant' && (
                  <Avatar className="w-8 h-8 ring-2 ring-accent/20">
                    <AvatarImage src={agentsMapRef.current[msg.agentId || '']?.avatarUrl || AVATAR_URLS.alex} alt="AI" className="object-cover" />
                    <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-[10px] text-white font-bold">
                      AI
                    </AvatarFallback>
                  </Avatar>
                )}
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-primary/10 border border-primary/20 text-foreground'
                      : 'bg-muted border border-border text-foreground'
                  }`}
                >
                  {msg.role === 'assistant' && (
                    <div className="flex items-center gap-1 mb-1.5">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                        AI 助手
                      </span>
                      {msg.timestamp && (
                        <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                          {msg.timestamp}
                        </span>
                      )}
                    </div>
                  )}
                  {msg.taskTitle && (
                    <div className="flex items-center gap-1 mb-1.5">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 border border-blue-200">
                        📋 {msg.taskTitle}
                      </span>
                    </div>
                  )}
                  {msg.content === '' && msg.role === 'assistant' ? (
                    <div className="flex gap-1 py-1">
                      <span className="typing-dot w-1.5 h-1.5 rounded-full bg-primary" />
                      <span className="typing-dot w-1.5 h-1.5 rounded-full bg-primary" />
                      <span className="typing-dot w-1.5 h-1.5 rounded-full bg-primary" />
                    </div>
                  ) : (
                    <div className="prose prose-sm max-w-none prose-headings:text-foreground prose-p:text-foreground prose-strong:text-foreground prose-code:text-foreground">
                      <Markdown>{msg.displayContent || sanitizeDisplayContent(msg.content)}</Markdown>
                    </div>
                  )}
                </div>
                {msg.role === 'user' && (
                  <Avatar className="w-8 h-8 ring-2 ring-primary/20">
                    <AvatarImage src={AVATAR_URLS.user} alt="You" className="object-cover" />
                    <AvatarFallback className="bg-gradient-to-br from-yellow-400 to-amber-500 text-[10px] text-white font-bold">
                      Me
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
            );
          })}

          <div ref={bottomRef} />

        </div>
      </ScrollArea>

      <div className="p-3 border-t border-border">
        {isStreamingForOtherConv && (
          <div className="text-xs text-amber-500 mb-2 flex items-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            其他对话正在生成中，发送消息将停止该生成
          </div>
        )}
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isStreamingForOtherConv ? '发送消息将停止其他对话的生成...' : '输入你的需求...'}
            className="bg-muted border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-primary/50"
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isStreamingToCurrentConv}
            size="icon"
            className="bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-white border-0"
          >
            <Send className="w-4 h-4" />
          </Button>
          {isStreamingToCurrentConv && (
            <Button
              onClick={handleStop}
              size="icon"
              className="bg-red-500 hover:bg-red-600 text-white border-0"
            >
              <Square className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
