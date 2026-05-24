import { AgentDef, AgentStatus } from '@/types/agent';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

const STATUS_DOT: Record<AgentStatus, string> = {
  idle: 'bg-gray-400',
  thinking: 'bg-yellow-400 animate-pulse',
  coding: 'bg-green-400 animate-pulse',
  reviewing: 'bg-blue-400 animate-pulse',
  completed: 'bg-emerald-500',
};

interface AgentCardProps {
  agent: AgentDef;
  isActive: boolean;
  status: AgentStatus;
  onClick: () => void;
}

export default function AgentCard({ agent, isActive, status, onClick }: AgentCardProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center gap-2.5 ${
        isActive
          ? 'bg-primary/10 border border-primary/20'
          : 'hover:bg-muted border border-transparent'
      }`}
    >
      {/* Avatar */}
      <div className="w-8 h-8 rounded-full relative flex-shrink-0">
        <Avatar className="w-8 h-8 ring-2 ring-accent/20">
          <AvatarImage src={agent.avatarUrl} alt={agent.name} className="object-cover" />
          <AvatarFallback className={`bg-gradient-to-br ${agent.avatarColor}`}>
            <span className="text-xs text-white font-bold">{agent.name[0]}</span>
          </AvatarFallback>
        </Avatar>
        {status !== 'idle' && (
          <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${STATUS_DOT[status]}`} />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-foreground truncate">{agent.name}</p>
        <p className="text-[10px] text-muted-foreground truncate">{agent.role}</p>
      </div>
    </button>
  );
}
