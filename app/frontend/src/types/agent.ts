export interface AgentDef {
  id: string;
  name: string;
  role: string;
  avatarColor: string;  // Tailwind gradient class
  avatarUrl?: string;   // Real image URL for avatar
  systemPrompt: string;
  skills: string[];
  isBuiltin: boolean;
}

export interface TaskItem {
  id: number;
  conversationId: number;
  agentId: string;
  title: string;
  description?: string;
  status: 'pending' | 'thinking' | 'working' | 'completed' | 'failed';
  result?: string;
  dependentTaskIds: number[];
  sortOrder: number;
  createdAt: string;
}

export type WorkMode = 'team' | 'engineer';

export interface AgentState {
  agents: AgentDef[];
  customAgents: AgentDef[];
  activeAgentId: string | null;
  workMode: WorkMode;
  tasks: TaskItem[];
  agentStatuses: Record<string, AgentStatus>;
}

export type AgentStatus = 'idle' | 'thinking' | 'coding' | 'reviewing' | 'completed';

export interface AgentMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  agentId?: string;           // which agent sent this (assistant messages)
  mentionedAgents?: string[]; // user @mentioned agents (user messages)
  taskId?: number;
  timestamp?: string;
}

/** SSE event from streaming team chat */
export type TeamStreamEvent =
  | { type: 'phase'; agent_id: string; status: string }
  | { type: 'token'; agent_id: string; token: string }
  | { type: 'plan'; analysis: string; tasks: { agent_id: string; title: string; task_id: number }[] }
  | { type: 'task_start'; agent_id: string; task_id: number; title: string }
  | { type: 'task_complete'; agent_id: string; task_id: number; title: string }
  | { type: 'need_clarify'; agent_id: string }
  | { type: 'summary'; agent_id: string; content: string; tasks?: any[] }
  | { type: 'done' }
  | { type: 'error'; error: string };

export const AVATAR_URLS = {
  mike: 'https://mgx-backend-cdn.metadl.com/generate/images/1263427/2026-05-24/pfidnuqaagta/avatar-mike-team-leader.png',
  alex: 'https://mgx-backend-cdn.metadl.com/generate/images/1263427/2026-05-24/pfidoxqaagra/avatar-alex-engineer.png',
  emma: 'https://mgx-backend-cdn.metadl.com/generate/images/1263427/2026-05-24/pfidmfqaagsq/avatar-emma-product-manager.png',
  user: 'https://mgx-backend-cdn.metadl.com/generate/images/1263427/2026-05-24/pfidmwyaagsa/avatar-user-default.png',
} as const;

export const DEFAULT_AGENTS: AgentDef[] = [
  {
    id: 'mike',
    name: 'Mike',
    role: 'Team Leader',
    avatarColor: 'from-orange-400 to-amber-500',
    avatarUrl: AVATAR_URLS.mike,
    systemPrompt: '',
    skills: ['任务分解', '团队协调', '需求分析'],
    isBuiltin: true,
  },
  {
    id: 'alex',
    name: 'Alex',
    role: 'Engineer',
    avatarColor: 'from-blue-500 to-blue-600',
    avatarUrl: AVATAR_URLS.alex,
    skills: ['代码开发', 'Bug修复', '部署'],
    systemPrompt: '',
    isBuiltin: true,
  },
  {
    id: 'emma',
    name: 'Emma',
    role: 'Product Manager',
    avatarColor: 'from-pink-400 to-rose-500',
    avatarUrl: AVATAR_URLS.emma,
    skills: ['PRD', '竞品分析', '用户研究'],
    systemPrompt: '',
    isBuiltin: true,
  },
];
