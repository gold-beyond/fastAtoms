import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { AgentDef, WorkMode, TaskItem, AgentStatus, DEFAULT_AGENTS } from '@/types/agent';
import { api } from '@/lib/simpleApi';

export const WORK_MODE_STORAGE_KEY = 'fastatoms_work_mode';

interface AgentContextValue {
  agents: AgentDef[];
  activeAgentId: string | null;
  setActiveAgentId: (id: string | null) => void;
  workMode: WorkMode;
  setWorkMode: (mode: WorkMode) => void;
  tasks: TaskItem[];
  agentStatuses: Record<string, AgentStatus>;
  setAgentStatus: (agentId: string, status: AgentStatus) => void;
  refreshAgents: () => Promise<void>;
}

const AgentContext = createContext<AgentContextValue | null>(null);

export function AgentProvider({ children }: { children: ReactNode }) {
  const [agents, setAgents] = useState<AgentDef[]>(DEFAULT_AGENTS);
  const [activeAgentId, setActiveAgentId] = useState<string | null>('alex');
  const [workMode, setWorkMode] = useState<WorkMode>(() => {
    try {
      const saved = localStorage.getItem(WORK_MODE_STORAGE_KEY);
      if (saved === 'team' || saved === 'engineer') return saved;
    } catch {}
    return 'engineer';
  });
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [agentStatuses, setAgentStatuses] = useState<Record<string, AgentStatus>>({});

  const refreshAgents = useCallback(async () => {
    try {
      const data = await api.get<{ agents: AgentDef[] }>('/api/v1/agents');
      if (data?.agents && data.agents.length > 0) {
        setAgents(data.agents);
      }
    } catch {
      // Use defaults when backend unavailable
      setAgents(DEFAULT_AGENTS);
    }
  }, []);

  useEffect(() => {
    refreshAgents();
  }, [refreshAgents]);

  const setAgentStatus = useCallback((agentId: string, status: AgentStatus) => {
    setAgentStatuses(prev => ({ ...prev, [agentId]: status }));
  }, []);

  return (
    <AgentContext.Provider
      value={{
        agents,
        activeAgentId,
        setActiveAgentId,
        workMode,
        setWorkMode,
        tasks,
        agentStatuses,
        setAgentStatus,
        refreshAgents,
      }}
    >
      {children}
    </AgentContext.Provider>
  );
}

export function useAgentContext() {
  const ctx = useContext(AgentContext);
  if (!ctx) {
    throw new Error('useAgentContext must be used within an AgentProvider');
  }
  return ctx;
}
