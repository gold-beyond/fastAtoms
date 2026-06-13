import { AgentDef, AgentStatus } from '@/types/agent';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import Markdown from 'markdown-to-jsx';

interface AgentMessageBubbleProps {
  agent: AgentDef;
  content: string;
  status?: AgentStatus;
  taskTitle?: string;
  timestamp?: string;
}

const STATUS_LABELS: Record<string, string> = {
  thinking: '思考中...',
  coding: '正在写代码...',
  designing: '正在设计架构...',
  planning: '正在规划需求...',
  completed: '已完成',
};

const STATUS_DOT_CLASS: Record<string, string> = {
  idle: 'bg-gray-400',
  thinking: 'bg-yellow-400 animate-pulse',
  coding: 'bg-green-400 animate-pulse',
  reviewing: 'bg-blue-400 animate-pulse',
  completed: 'bg-emerald-500',
};

const STATUS_TEXT_CLASS: Record<string, string> = {
  thinking: 'text-yellow-500',
  coding: 'text-green-500',
  reviewing: 'text-blue-500',
};

export default function AgentMessageBubble({ agent, content, status, taskTitle, timestamp }: AgentMessageBubbleProps) {
  return (
    <div className="flex gap-3 justify-start fade-in-up group">
      {/* Agent Avatar */}
      <div className="flex-shrink-0 flex flex-col items-center gap-1">
        <Avatar className="w-8 h-8 ring-2 ring-accent/20">
          <AvatarImage src={agent.avatarUrl} alt={agent.name} className="object-cover" />
          <AvatarFallback className={`bg-gradient-to-br ${agent.avatarColor} text-[10px] text-white font-bold`}>
            {agent.name?.[0] || '?'}
          </AvatarFallback>
        </Avatar>
        <span className="text-[9px] text-muted-foreground">{agent.name}</span>
      </div>

      {/* Message Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          {status && status !== 'idle' && status !== 'completed' && (
            <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT_CLASS[status] || 'bg-yellow-400 animate-pulse'} flex-shrink-0`} />
          )}
          <span className="text-xs font-medium text-foreground">{agent.name}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">
            {agent.role}
          </span>
          {timestamp && (
            <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
              {timestamp}
            </span>
          )}
          {taskTitle && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 border border-blue-200">
              📋 {taskTitle}
            </span>
          )}
          {status && status !== 'idle' && status !== 'completed' && (
            <span className={`text-[10px] animate-pulse font-medium ${STATUS_TEXT_CLASS[status] || 'text-yellow-500'}`}>
              {STATUS_LABELS[status] || status}
            </span>
          )}
        </div>
        <div className="bg-white border border-border rounded-lg px-3 py-2 text-sm leading-relaxed text-foreground">
          {content ? (
            <div className="prose prose-sm max-w-none prose-headings:text-foreground prose-p:text-foreground prose-strong:text-foreground prose-code:text-foreground">
              <Markdown>{content}</Markdown>
            </div>
          ) : (
            <div className="flex gap-1 py-1">
              <span className="typing-dot w-1.5 h-1.5 rounded-full bg-primary" />
              <span className="typing-dot w-1.5 h-1.5 rounded-full bg-primary" />
              <span className="typing-dot w-1.5 h-1.5 rounded-full bg-primary" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
