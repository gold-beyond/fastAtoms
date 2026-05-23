import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Bot, User } from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  isTyping?: boolean;
}

interface ChatPanelProps {
  onCodeGenerate?: () => void;
}

const DEMO_MESSAGES: Message[] = [
  {
    id: "1",
    role: "user",
    content: "帮我创建一个现代化的landing page，需要有英雄区域、特性展示和底部联系表单",
  },
  {
    id: "2",
    role: "assistant",
    content:
      "好的！我来为你创建一个现代化的 Landing Page。我将使用渐变背景、流畅动画和响应式布局来构建。包含以下部分：\n\n✨ 英雄区域 - 大标题 + 渐变背景 + CTA按钮\n📋 特性展示 - 三列卡片布局\n📬 联系表单 - 简洁的输入框设计\n\n正在为你生成代码...",
  },
];

const AI_RESPONSES = [
  "已为你更新了样式文件，添加了渐变动画效果。预览窗口中可以看到实时变化。",
  "代码已生成完毕！你可以在右侧编辑器中查看完整代码，也可以在预览窗口中查看效果。",
  "好的，我来帮你调整。正在修改布局和配色方案...",
];

export default function ChatPanel({ onCodeGenerate }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>(DEMO_MESSAGES);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const responseIndex = useRef(0);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() || isTyping) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsTyping(true);

    // Simulate AI typing
    setTimeout(() => {
      const response =
        AI_RESPONSES[responseIndex.current % AI_RESPONSES.length];
      responseIndex.current++;

      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: response,
        },
      ]);
      setIsTyping(false);
      onCodeGenerate?.();
    }, 1500);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
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
                msg.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              {msg.role === "assistant" && (
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-white" />
                </div>
              )}
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-indigo-600/20 border border-indigo-500/30 text-foreground"
                    : "bg-[#1a1a2e] border border-border text-foreground"
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
              {msg.role === "user" && (
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-[#1a1a2e] border border-border flex items-center justify-center">
                  <User className="w-4 h-4 text-muted-foreground" />
                </div>
              )}
            </div>
          ))}

          {/* Typing indicator */}
          {isTyping && (
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