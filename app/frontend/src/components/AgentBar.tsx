import { useState, useEffect } from 'react';
import { useAgentContext } from '@/contexts/AgentContext';
import { X, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/simpleApi';
import AgentCard from './AgentCard';

interface AgentBarProps {
  visible: boolean;
  onClose: () => void;
}

export default function AgentBar({ visible, onClose }: AgentBarProps) {
  const { agents, activeAgentId, setActiveAgentId, agentStatuses } = useAgentContext();
  const [showSettings, setShowSettings] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Populate the backend's in-memory cache on mount (so AI proxy can use the key)
  useEffect(() => {
    api.get('/api/v1/admin/settings/shared-key/deepseek').catch(() => {});
  }, []);

  const handleSaveKey = async () => {
    if (!apiKey.trim()) return;
    setSaving(true);
    try {
      await api.put('/api/v1/admin/settings/shared-key/deepseek', { provider: 'deepseek', api_key: apiKey.trim() });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch { /* ignore */ }
    setSaving(false);
  };

  if (!visible) return null;

  return (
    <div className="absolute top-full right-0 mt-1 w-56 bg-white border border-border rounded-lg shadow-lg z-50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-xs font-medium text-foreground">
          {showSettings ? 'AI 配置' : '团队成员'}
        </span>
        <div className="flex items-center gap-1">
          <button
            className="text-muted-foreground hover:text-foreground p-0.5"
            onClick={() => { setShowSettings(!showSettings); setSaved(false); }}
            title="设置"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
          <button className="text-muted-foreground hover:text-foreground" onClick={onClose}>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {showSettings ? (
        <div className="p-3 space-y-2">
          <p className="text-[10px] text-muted-foreground">配置 DeepSeek API Key，一人配置全体可用</p>
          <Input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-..."
            className="text-xs h-8"
          />
          <Button
            size="sm"
            className="w-full h-7 text-xs"
            onClick={handleSaveKey}
            disabled={saving || !apiKey.trim()}
          >
            {saving ? '保存中...' : saved ? '✅ 已保存' : '保存'}
          </Button>
        </div>
      ) : (
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
      )}
    </div>
  );
}
