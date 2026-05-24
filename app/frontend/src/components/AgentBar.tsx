import { useAgentContext } from '@/contexts/AgentContext';
import { X } from 'lucide-react';
import AgentCard from './AgentCard';

interface AgentBarProps {
  visible: boolean;
  onClose: () => void;
}

export default function AgentBar({ visible, onClose }: AgentBarProps) {
  const { agents, activeAgentId, setActiveAgentId, agentStatuses } = useAgentContext();

  if (!visible) return null;

  return (
    <div className="absolute top-full right-0 mt-1 w-48 bg-white border border-border rounded-lg shadow-lg z-50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-xs font-medium text-foreground">团队成员</span>
        <button
          className="text-muted-foreground hover:text-foreground"
          onClick={onClose}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Agent List */}
      <div className="py-1 max-h-80 overflow-y-auto">
        {agents.map((agent) => (
          <AgentCard
            key={agent.id}
            agent={agent}
            isActive={activeAgentId === agent.id}
            status={agentStatuses[agent.id] || 'idle'}
            onClick={() => {
              setActiveAgentId(agent.id);
              onClose();
            }}
          />
        ))}
      </div>
    </div>
  );
}
