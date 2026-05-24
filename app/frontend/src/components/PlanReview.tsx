import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Bot, RefreshCw, Play } from 'lucide-react';
import { AgentDef } from '@/types/agent';

export interface PlanTask {
  agent_id: string;
  title: string;
  description?: string;
  task_id: number;
}

interface PlanReviewProps {
  analysis: string;
  tasks: PlanTask[];
  agents: AgentDef[];
  onConfirm: (tasks: PlanTask[], extraInstructions: string) => void;
  onRegenerate: () => void;
}

export default function PlanReview({ analysis, tasks, agents, onConfirm, onRegenerate }: PlanReviewProps) {
  const [extraInstructions, setExtraInstructions] = useState('');

  const handleConfirm = () => {
    onConfirm(tasks, extraInstructions);
  };

  return (
    <div className="border border-primary/20 rounded-lg bg-white p-4 space-y-3 fade-in-up">
      <div className="flex items-center gap-2">
        <Bot className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold text-foreground">执行计划</span>
      </div>

      <div className="text-xs text-muted-foreground bg-muted rounded p-2 leading-relaxed">
        {analysis}
      </div>

      <div className="space-y-2">
        {tasks.map((task) => {
          const agentDef = agents.find(a => a.id === task.agent_id);
          return (
            <div key={task.task_id} className="flex items-start gap-2 p-2 rounded border border-border bg-white">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  {agentDef ? (
                    <Avatar className="w-5 h-5 flex-shrink-0">
                      <AvatarImage src={agentDef.avatarUrl} alt={agentDef.name} className="object-cover" />
                      <AvatarFallback className={`text-[8px] text-white font-bold ${agentDef.avatarColor}`}>
                        {agentDef.name[0]}
                      </AvatarFallback>
                    </Avatar>
                  ) : (
                    <span className="text-xs">🤖</span>
                  )}
                  <span className="text-xs font-medium text-foreground">{agentDef?.name || task.agent_id}</span>
                  <span className="text-[10px] text-muted-foreground">- {task.title}</span>
                </div>
                {task.description && (
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {task.description}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Textarea
        value={extraInstructions}
        onChange={(e) => setExtraInstructions(e.target.value)}
        placeholder="补充说明（可选）— 例如：使用深色主题、移动端适配..."
        className="text-xs min-h-[60px]"
      />

      <div className="flex items-center gap-2 pt-1">
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs gap-1"
          onClick={onRegenerate}
        >
          <RefreshCw className="w-3 h-3" />
          重新生成
        </Button>
        <Button
          size="sm"
          className="h-8 text-xs gap-1 bg-gradient-to-r from-primary to-accent text-white"
          onClick={handleConfirm}
        >
          <Play className="w-3 h-3" />
          确认执行 ({tasks.length} 个任务)
        </Button>
      </div>
    </div>
  );
}
