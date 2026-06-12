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
  const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
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
  const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
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
  const agentsMapRef = useRef<Record<string, AgentDef>>({});
  const streamStateRef = useRef<TeamStreamState | null>(null);
  const streamBuffers = useRef<Record<string, {
    messages: Message[];
    isTyping: boolean;
    timestamp: string;
    completedAgents: string[];
    planMsgId: string;
  }>>({});

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
    const scId = requestConvIdRef.current;
    if (scId && streamBuffers.current[scId]) {
      streamBuffers.current[scId].isTyping = false;
    }
    setIsTyping(false);
    pendingStreamRef.current = null;
    streamStateRef.current = null;
  };

  const abortGeneration = () => {
    abortRef.current = true;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    cleanupStream();
    setAgentStatus('mike', 'completed');
    setAgentStatus('alex', 'completed');
    setAgentStatus('emma', 'completed');
  };

  useEffect(() => {
    if (currentConvId === prevConvIdRef.current) return;

    const prevId = prevConvIdRef.current;
    const abortController = new AbortController();
    const signal = abortController.signal;

    if (prevId !== null && streamBuffers.current[prevId]) {
      const buf = streamBuffers.current[prevId];
      buf.messages = messagesRef.current;
      buf.isTyping = isTyping;
      const ss = streamStateRef.current;
      buf.completedAgents = ss ? Array.from(ss.completedAgents) : [];
      saveConversation(messagesRef.current, prevId, true);
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

    // Clean up stale team buffers when starting a new conversation
    if (currentConvId === null) {
      Object.keys(streamBuffers.current).forEach(k => {
        if (k.startsWith('_team_')) {
          delete streamBuffers.current[k];
        }
      });
    }

    let buf = currentConvId ? streamBuffers.current[currentConvId] : undefined;
    // Fallback: search for _team_ buffers (new conversations without an ID at start)
    if (!buf && currentConvId) {
      const fallbackKey = Object.keys(streamBuffers.current).find(k => k.startsWith('_team_'));
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
          const { messages: msgStr } = parsed;
          if (msgStr) {
            const msgs = JSON.parse(msgStr);
            if (!signal.aborted && Array.isArray(msgs) && msgs.length > 0) {
              setMessages(msgs);
              restoreCodeFromMessages(msgs);
              return;
            }
          }
        }
      } catch { /* ignore corrupt backup */ }

      if (!currentConvId) {
        try {
          const latest = localStorage.getItem('atoms_backup_latest');
          if (latest) {
            const parsed = JSON.parse(latest);
            const { messages: msgStr } = parsed;
            if (msgStr) {
              const msgs = JSON.parse(msgStr);
              if (!signal.aborted && Array.isArray(msgs) && msgs.length > 0) {
                setMessages(msgs);
                restoreCodeFromMessages(msgs);
                return;
              }
            }
          }
        } catch { /* ignore */ }
      }

      if (isLoggedIn) {
        try {
          const data = await api.get<any>(`/api/v1/entities/conversations/${currentConvId}`);
          if (signal.aborted) return;
          if (data?.messages) {
            const parsed = JSON.parse(data.messages as string);
            if (!signal.aborted) {
              setMessages(parsed);
              restoreCodeFromMessages(parsed);
            }
          }
        } catch { /* fall back silently */ }
      } else {
        const localConvs = getLocalConversations();
        const conv = localConvs.find((c) => c.id === currentConvId);
        if (conv?.messages) {
          try {
            const parsed = JSON.parse(conv.messages);
            if (!signal.aborted) {
              setMessages(parsed);
              restoreCodeFromMessages(parsed);
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
      const saveMsgs = msgs.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        agentId: m.agentId,
        taskTitle: m.taskTitle,
        timestamp: m.timestamp,
      }));
      const messagesStr = JSON.stringify(saveMsgs);
      const title =
        msgs.find((m) => m.role === 'user')?.content.slice(0, 50) || '新对话';

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
    abortGeneration();
    if (requestConvIdRef.current === currentConvIdRef.current) {
      setMessages((prev) => {
        const updated = [...prev];
        const lastMsg = updated[updated.length - 1];
        if (lastMsg?.role === 'assistant') {
          const content = lastMsg.content || '';
          if (content.startsWith('⏳') || content.startsWith('⚠️')) {
            updated[updated.length - 1] = {
              ...lastMsg,
              content: '⏸️ 已停止生成',
            };
          }
        }
        return updated;
      });
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isTyping || pendingStreamRef.current) return;

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
    }

    if (abortRef.current) return;

    let accumulatedContent = '';
    let finalAgentId: string | undefined;

    const handleStreamToken = (token: string) => {
      accumulatedContent += token;
      if (requestConvIdRef.current === currentConvIdRef.current) {
        setMessages((prev) => {
          const updated = [...prev];
          const lastMsg = updated[updated.length - 1];
          if (lastMsg?.id === assistantId) {
            updated[updated.length - 1] = { ...lastMsg, content: accumulatedContent };
          }
          return updated;
        });
      }
    };

    const handleStreamDone = (extra?: Record<string, any>) => {
      if (requestConvIdRef.current === currentConvIdRef.current) {
        const agentId = extra?.agent_id || effectiveAgentId || undefined;
        finalAgentId = agentId;
        const content = accumulatedContent || '未收到回复';
        const display = processAIResponse(content);
        const replyTimestamp = formatTimestamp();
        const finalMessages: Message[] = [
          ...updatedMessages,
          { id: assistantId, role: 'assistant', content, displayContent: display, agentId, timestamp: replyTimestamp },
        ];
        setMessages(finalMessages);
        setIsTyping(false);
        saveConversation(finalMessages);
      } else {
        const content = accumulatedContent || '未收到回复';
        const replyTimestamp = formatTimestamp();
        const finalMessages: Message[] = [
          ...updatedMessages,
          { id: assistantId, role: 'assistant', content, agentId: finalAgentId || effectiveAgentId || undefined, timestamp: replyTimestamp },
        ];
        setIsTyping(false);
        saveConversation(finalMessages, undefined, true);
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
      if (requestConvIdRef.current === currentConvIdRef.current) {
        setMessages(errorMessages);
      }
      setIsTyping(false);
      saveConversation(errorMessages, undefined, requestConvIdRef.current !== currentConvIdRef.current);
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
        streamBuffers.current[streamConvId] = {
          messages: [...updatedMessages, { id: planMsgId, role: 'assistant', content: '', agentId: 'mike', timestamp: now }],
          isTyping: true,
          timestamp: now,
          completedAgents: [],
          planMsgId,
        };

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
              cleanupStream();
              setAgentStatus('mike', 'completed');
              setAgentStatus('alex', 'completed');
              setAgentStatus('emma', 'completed');
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
                      <Markdown>{sanitizeDisplayContent(msg.content)}</Markdown>
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
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入你的需求..."
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
