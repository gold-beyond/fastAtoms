import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Bot, User, FileCode, FileText, Braces, Square } from 'lucide-react';
import client from '@/lib/client';
import AISettingsDialog, { getAISettings } from '@/components/AISettings';
import { getLocalConversations, saveLocalConversations } from '@/lib/conversationUtils';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  displayContent?: string;
}

interface GeneratedFile {
  id: string;
  name: string;
  icon: React.ReactNode;
  language: string;
  code: string;
}

interface ChatPanelProps {
  onCodeGenerate?: () => void;
  onCodeGenerated?: (files: GeneratedFile[], html: string) => void;
  onCodeRestored?: (files: GeneratedFile[], html: string) => void;
  onConversationSaved?: (id: string) => void;
  isLoggedIn?: boolean;
  currentConvId: string | null;
  onCurrentConvIdChange?: (id: string | null) => void;
}

const SYSTEM_PROMPT =
  '你是 Atoms 平台的 AI 编程助手。你可以帮助用户生成代码、解答编程问题、设计网页和应用。当用户要求你创建网页或应用时，请生成完整的 HTML、CSS 和 JavaScript 代码，使用 markdown 代码块包裹（```html、```css、```javascript）。请用中文回复。';

const SUGGESTED_PROMPTS = [
  '创建一个现代化的 Landing Page',
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

  // Build display content: replace code blocks with short notes
  const displayContent = content.replace(codeBlockRegex, (_fullMatch, lang: string) => {
    const fileName = getFileName(lang.toLowerCase() || 'text');
    return `\n📄 ${fileName} 已生成 →\n`;
  });

  // Build full HTML for preview
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

  return { files, displayContent, fullHtml };
}

/**
 * Returns display-friendly content for a message by stripping code blocks.
 */
function getDisplayContent(msg: Message): string {
  if (msg.displayContent) return msg.displayContent;
  if (msg.role === 'user') return msg.content;
  const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
  if (!codeBlockRegex.test(msg.content)) return msg.content;
  return msg.content.replace(/```(\w*)\n([\s\S]*?)```/g, (_match, lang: string) => {
    const fileName = getFileName(lang.toLowerCase() || 'text');
    return `\n📄 ${fileName} 已生成 →\n`;
  });
}

export default function ChatPanel({
  onCodeGenerate,
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
  const abortRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const prevConvIdRef = useRef<string | null>(null);
  const currentConvIdRef = useRef(currentConvId);
  currentConvIdRef.current = currentConvId;
  const pendingStreamRef = useRef<{
    convId: string;
    assistantId: string;
    accumulatedContent: string;
    baseMessages: Message[];
  } | null>(null);
  const requestConvIdRef = useRef<string | null>(null);

  const abortGeneration = () => {
    abortRef.current = true;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsTyping(false);
  };

  // Load conversation when currentConvId changes externally
  useEffect(() => {
    if (currentConvId === prevConvIdRef.current) return;

    const prevId = prevConvIdRef.current;

    if (prevId && messagesRef.current.length > 0) {
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
          }
          break;
        }
      }
    };

    const loadConversation = async () => {
      if (isLoggedIn) {
        try {
          const response = await client.entities.conversations.get({ id: currentConvId });
          if (response?.data?.messages) {
            const parsed = JSON.parse(response.data.messages as string);
            setMessages(parsed);
            restoreCodeFromMessages(parsed);
          }
        } catch {
          // Fall back silently
        }
      } else {
        // Load from local storage
        const localConvs = getLocalConversations();
        const conv = localConvs.find((c) => c.id === currentConvId);
        if (conv?.messages) {
          try {
            const parsed = JSON.parse(conv.messages);
            setMessages(parsed);
            restoreCodeFromMessages(parsed);
          } catch {
            // ignore
          }
        }
      }
    };

    loadConversation();
  }, [currentConvId, isLoggedIn]);

  const saveConversation = useCallback(
    async (msgs: Message[], convIdOverride?: string, silent?: boolean) => {
      const targetConvId = convIdOverride ?? currentConvId;
      const saveMsgs = msgs.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
      }));
      const messagesStr = JSON.stringify(saveMsgs);
      const title =
        msgs.find((m) => m.role === 'user')?.content.slice(0, 50) || '新对话';

      if (isLoggedIn) {
        try {
          if (targetConvId) {
            await client.entities.conversations.update({
              id: targetConvId,
              data: { title, messages: messagesStr },
            });
            if (!silent) onConversationSaved?.(targetConvId);
          } else {
            const response = await client.entities.conversations.create({
              data: { title, messages: messagesStr },
            });
            if (response?.data?.id) {
              const newId = response.data.id as string;
              prevConvIdRef.current = newId;
              onCurrentConvIdChange?.(newId);
              if (!silent) onConversationSaved?.(newId);
            }
          }
        } catch {
          // Silently handle save errors
        }
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
        }
      }
    },
    [isLoggedIn, currentConvId, onConversationSaved, onCurrentConvIdChange]
  );

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
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
    if (requestConvIdRef.current !== currentConvIdRef.current) return;
    abortGeneration();
    setMessages((prev) => {
      const updated = [...prev];
      const lastMsg = updated[updated.length - 1];
      if (lastMsg?.role === 'assistant') {
        const content = lastMsg.content || '';
        if (content.startsWith('⏳') || content.startsWith('⚠️')) {
          updated.pop();
        } else {
          updated[updated.length - 1] = {
            ...lastMsg,
            content: content || '(已停止生成)',
            displayContent: '(已停止生成)',
          };
        }
      }
      saveConversation(updated);
      return updated;
    });
  };

  const handleSend = async () => {
    if (!input.trim() || isTyping || pendingStreamRef.current) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setIsTyping(true);
    abortRef.current = false;

    const assistantId = (Date.now() + 1).toString();

    requestConvIdRef.current = currentConvId;
    pendingStreamRef.current = {
      convId: currentConvId!,
      assistantId,
      accumulatedContent: '',
      baseMessages: updatedMessages,
    };

    // Save conversation immediately when user sends a message
    saveConversation(updatedMessages);

    // Build messages for the AI API (include conversation history)
    const apiMessages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...updatedMessages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    ];

    // Check if custom AI settings are configured
    const customSettings = getAISettings();

    if (customSettings) {
      // Use custom API via backend proxy
      abortControllerRef.current = new AbortController();

      try {
        // Show loading message
        setMessages((prev) => [
          ...prev,
          { id: assistantId, role: 'assistant', content: '⏳ 正在思考...' },
        ]);

        if (abortRef.current) return;

        const response = await client.apiCall.invoke({
          url: '/api/v1/chat/proxy',
          method: 'POST',
          data: {
            messages: apiMessages,
            model: customSettings.model,
            api_key: customSettings.apiKey,
            provider: customSettings.provider,
          },
          signal: abortControllerRef.current.signal,
        });

        if (abortRef.current) return;

        const content =
          (response as { data?: { content?: string } })?.data?.content ||
          '未收到回复';

        if (requestConvIdRef.current === currentConvIdRef.current) {
          const display = processAIResponse(content);
          const finalMessages: Message[] = [
            ...updatedMessages,
            { id: assistantId, role: 'assistant', content, displayContent: display },
          ];
          setMessages(finalMessages);
          onCodeGenerate?.();
          setIsTyping(false);
          saveConversation(finalMessages, requestConvIdRef.current!);
        } else {
          const finalMessages: Message[] = [
            ...updatedMessages,
            { id: assistantId, role: 'assistant', content },
          ];
          setIsTyping(false);
          saveConversation(finalMessages, requestConvIdRef.current!, true);
        }
        pendingStreamRef.current = null;
      } catch (e: unknown) {
        if (abortRef.current) {
          pendingStreamRef.current = null;
          return;
        }
        const errorDetail =
          (e as { data?: { detail?: string } })?.data?.detail ||
          (e as { message?: string })?.message ||
          '请求失败，请检查 API 设置';
        const errorMessages: Message[] = [
          ...updatedMessages,
          {
            id: assistantId,
            role: 'assistant',
            content: `⚠️ ${errorDetail}`,
          },
        ];
        if (requestConvIdRef.current === currentConvIdRef.current) {
          setMessages(errorMessages);
        }
        setIsTyping(false);
        saveConversation(errorMessages, requestConvIdRef.current!, requestConvIdRef.current !== currentConvIdRef.current);
        pendingStreamRef.current = null;
      } finally {
        abortControllerRef.current = null;
      }
    } else {
      // Use built-in Atoms AI (streaming)
      let accumulatedContent = '';

      try {
        await client.ai.gentxt({
          messages: apiMessages,
          model: 'claude-opus-4.6',
          stream: true,
          onChunk: (chunk: { content?: string }) => {
            if (abortRef.current) return;
            if (chunk.content) {
              accumulatedContent += chunk.content;
              if (pendingStreamRef.current) {
                pendingStreamRef.current.accumulatedContent = accumulatedContent;
              }
              if (requestConvIdRef.current !== currentConvIdRef.current) return;
              const currentContent = accumulatedContent;
              setMessages((prev) => {
                const existing = prev.find((m) => m.id === assistantId);
                if (existing) {
                  return prev.map((m) =>
                    m.id === assistantId ? { ...m, content: currentContent } : m
                  );
                }
                return [
                  ...prev,
                  { id: assistantId, role: 'assistant', content: currentContent },
                ];
              });
            }
          },
          onComplete: (finalResult: { content?: string }) => {
            if (abortRef.current) {
              if (requestConvIdRef.current === currentConvIdRef.current) {
                setMessages((prev) => {
                  const updated = prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, content: m.content || '(已停止生成)', displayContent: '(已停止生成)' }
                      : m
                  );
                  saveConversation(updated);
                  return updated;
                });
                setIsTyping(false);
              } else {
                saveConversation(
                  [
                    ...updatedMessages,
                    {
                      id: assistantId,
                      role: 'assistant' as const,
                      content: accumulatedContent || '(已停止生成)',
                    },
                  ],
                  requestConvIdRef.current!,
                  true
                );
              }
              pendingStreamRef.current = null;
              setIsTyping(false);
              return;
            }
            const finalContent = finalResult?.content || accumulatedContent;

            if (requestConvIdRef.current === currentConvIdRef.current) {
              const display = processAIResponse(finalContent);
              const finalMessages: Message[] = [
                ...updatedMessages,
                { id: assistantId, role: 'assistant', content: finalContent, displayContent: display },
              ];
              setMessages(finalMessages);
              onCodeGenerate?.();
              setIsTyping(false);
              saveConversation(finalMessages, requestConvIdRef.current!);
            } else {
              const finalMessages: Message[] = [
                ...updatedMessages,
                { id: assistantId, role: 'assistant', content: finalContent },
              ];
              setIsTyping(false);
              saveConversation(finalMessages, requestConvIdRef.current!, true);
            }
            pendingStreamRef.current = null;
          },
          onError: (error: { message?: string }) => {
            if (abortRef.current) {
              if (requestConvIdRef.current === currentConvIdRef.current) {
                setMessages((prev) => {
                  const updated = prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, content: m.content || '(已停止生成)', displayContent: '(已停止生成)' }
                      : m
                  );
                  saveConversation(updated);
                  return updated;
                });
                setIsTyping(false);
              } else {
                saveConversation(
                  [
                    ...updatedMessages,
                    {
                      id: assistantId,
                      role: 'assistant' as const,
                      content: accumulatedContent || '(已停止生成)',
                    },
                  ],
                  requestConvIdRef.current!,
                  true
                );
              }
              pendingStreamRef.current = null;
              setIsTyping(false);
              return;
            }
            const errorMsg = error?.message || '请求失败，请稍后重试';
            if (requestConvIdRef.current === currentConvIdRef.current) {
              const errorMessages: Message[] = [
                ...updatedMessages,
                {
                  id: assistantId,
                  role: 'assistant',
                  content: `⚠️ ${errorMsg}`,
                },
              ];
              setMessages(errorMessages);
              setIsTyping(false);
              saveConversation(errorMessages, requestConvIdRef.current!);
            } else {
              const errorMessages: Message[] = [
                ...updatedMessages,
                {
                  id: assistantId,
                  role: 'assistant',
                  content: `⚠️ ${errorMsg}`,
                },
              ];
              setIsTyping(false);
              saveConversation(errorMessages, requestConvIdRef.current!, true);
            }
            pendingStreamRef.current = null;
          },
          timeout: 60_000,
        });
      } catch (e: unknown) {
        if (!abortRef.current) {
          const errorDetail =
            (e as { data?: { detail?: string } })?.data?.detail ||
            (e as { message?: string })?.message ||
            '请求失败，请稍后重试';
          const errorMessages: Message[] = [
            ...updatedMessages,
            {
              id: assistantId,
              role: 'assistant',
              content: `⚠️ ${errorDetail}`,
            },
          ];
          if (requestConvIdRef.current === currentConvIdRef.current) {
            setMessages(errorMessages);
            setIsTyping(false);
            saveConversation(errorMessages, requestConvIdRef.current!);
          } else {
            setIsTyping(false);
            saveConversation(errorMessages, requestConvIdRef.current!, true);
          }
        } else {
          setIsTyping(false);
        }
        pendingStreamRef.current = null;
      }
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

  return (
    <div className="flex flex-col h-full bg-[#0f0f23] border-r border-border relative">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        <span className="text-sm font-medium text-muted-foreground">
          AI 助手
        </span>
        <div className="ml-auto flex items-center gap-1">
          <AISettingsDialog />
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-4">
          {/* Empty state / Welcome */}
          {messages.length === 0 && !isTyping && (
            <div className="flex flex-col items-center justify-center h-full min-h-[300px] py-12 px-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center mb-6">
                <Bot className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-xl font-semibold text-foreground mb-2">
                你想构建什么？
              </h2>
              <p className="text-sm text-muted-foreground mb-8 text-center">
                描述你的想法，我来帮你实现
              </p>
              <div className="grid grid-cols-1 gap-2 w-full max-w-sm">
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => setInput(prompt)}
                    className="text-left px-4 py-3 rounded-lg border border-border bg-[#1a1a2e] text-sm text-foreground hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-colors"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 fade-in-up ${
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {msg.role === 'assistant' && (
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-white" />
                </div>
              )}
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-indigo-600/20 border border-indigo-500/30 text-foreground'
                    : 'bg-[#1a1a2e] border border-border text-foreground'
                }`}
              >
                <p className="whitespace-pre-wrap">
                  {getDisplayContent(msg)}
                </p>
              </div>
              {msg.role === 'user' && (
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-[#1a1a2e] border border-border flex items-center justify-center">
                  <User className="w-4 h-4 text-muted-foreground" />
                </div>
              )}
            </div>
          ))}

          {/* Typing indicator */}
          {isStreamingToCurrentConv && !messages.find((m) => m.id === (Date.now() + 1).toString()) && (
            <div className="flex gap-3 justify-start fade-in-up">
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="bg-[#1a1a2e] border border-border rounded-lg px-4 py-3">
                <div className="flex gap-1">
                  <span className="typing-dot w-2 h-2 rounded-full bg-indigo-400" />
                  <span className="typing-dot w-2 h-2 rounded-full bg-indigo-400" />
                  <span className="typing-dot w-2 h-2 rounded-full bg-indigo-400" />
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-3 border-t border-border">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入你的需求..."
            className="bg-[#1a1a2e] border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-indigo-500/50"
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isStreamingToCurrentConv}
            size="icon"
            className="bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white border-0"
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