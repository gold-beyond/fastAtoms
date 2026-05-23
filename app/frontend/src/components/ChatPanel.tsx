import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Bot, User } from 'lucide-react';
import client from '@/lib/client';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface ChatPanelProps {
  onCodeGenerate?: () => void;
  conversationId?: string | null;
  onConversationSaved?: (id: string) => void;
  isLoggedIn?: boolean;
}

const SYSTEM_PROMPT =
  '你是 Atoms 平台的 AI 编程助手。你可以帮助用户生成代码、解答编程问题、设计网页和应用。请用中文回复。';

const DEMO_MESSAGES: Message[] = [
  {
    id: '1',
    role: 'user',
    content:
      '帮我创建一个现代化的landing page，需要有英雄区域、特性展示和底部联系表单',
  },
  {
    id: '2',
    role: 'assistant',
    content:
      '好的！我来为你创建一个现代化的 Landing Page。我将使用渐变背景、流畅动画和响应式布局来构建。包含以下部分：\n\n✨ 英雄区域 - 大标题 + 渐变背景 + CTA按钮\n📋 特性展示 - 三列卡片布局\n📬 联系表单 - 简洁的输入框设计\n\n正在为你生成代码...',
  },
];

export default function ChatPanel({
  onCodeGenerate,
  conversationId,
  onConversationSaved,
  isLoggedIn,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>(DEMO_MESSAGES);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [currentConvId, setCurrentConvId] = useState<string | null>(
    conversationId || null
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef(false);

  // Load conversation if conversationId is provided
  useEffect(() => {
    if (conversationId && isLoggedIn) {
      loadConversation(conversationId);
    }
  }, [conversationId, isLoggedIn]);

  const loadConversation = async (id: string) => {
    try {
      const response = await client.entities.conversations.get({ id });
      if (response?.data?.messages) {
        const parsed = JSON.parse(response.data.messages as string);
        setMessages(parsed);
        setCurrentConvId(id);
      }
    } catch {
      // Fall back to demo messages
    }
  };

  const saveConversation = useCallback(
    async (msgs: Message[]) => {
      if (!isLoggedIn) return;

      try {
        const messagesStr = JSON.stringify(msgs);
        if (currentConvId) {
          await client.entities.conversations.update({
            id: currentConvId,
            data: { messages: messagesStr },
          });
        } else {
          const title =
            msgs.find((m) => m.role === 'user')?.content.slice(0, 50) ||
            '新对话';
          const response = await client.entities.conversations.create({
            data: { title, messages: messagesStr },
          });
          if (response?.data?.id) {
            const newId = response.data.id as string;
            setCurrentConvId(newId);
            onConversationSaved?.(newId);
          }
        }
      } catch {
        // Silently handle save errors
      }
    },
    [isLoggedIn, currentConvId, onConversationSaved]
  );

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;

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

    // Build messages for the AI API (include conversation history)
    const apiMessages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...updatedMessages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    ];

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
          if (abortRef.current) return;
          const finalContent = finalResult?.content || accumulatedContent;
          const finalMessages: Message[] = [
            ...updatedMessages,
            { id: assistantId, role: 'assistant', content: finalContent },
          ];
          setMessages(finalMessages);
          setIsTyping(false);
          onCodeGenerate?.();
          saveConversation(finalMessages);
        },
        onError: (error: { message?: string }) => {
          if (abortRef.current) return;
          const errorMsg = error?.message || '请求失败，请稍后重试';
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
        setMessages(errorMessages);
        setIsTyping(false);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0f0f23] border-r border-border">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        <span className="text-sm font-medium text-muted-foreground">
          AI 助手
        </span>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-4">
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
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
              {msg.role === 'user' && (
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-[#1a1a2e] border border-border flex items-center justify-center">
                  <User className="w-4 h-4 text-muted-foreground" />
                </div>
              )}
            </div>
          ))}

          {/* Typing indicator */}
          {isTyping && !messages.find((m) => m.id === (Date.now() + 1).toString()) && (
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
            disabled={!input.trim() || isTyping}
            size="icon"
            className="bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white border-0"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}