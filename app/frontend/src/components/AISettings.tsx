import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Settings } from 'lucide-react';

export interface AISettings {
  useCustom: boolean;
  provider: 'openai' | 'anthropic' | 'deepseek';
  apiKey: string;
  model: string;
}

const STORAGE_KEY = 'atoms-ai-settings';

const MODEL_SUGGESTIONS: Record<string, string[]> = {
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
  anthropic: ['claude-sonnet-4-20250514', 'claude-3-5-haiku-20241022'],
  deepseek: ['deepseek-chat', 'deepseek-reasoner'],
};

export function getAISettings(): AISettings | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    const settings: AISettings = JSON.parse(stored);
    if (!settings.useCustom) return null;
    if (!settings.apiKey || !settings.model || !settings.provider) return null;
    return settings;
  } catch {
    return null;
  }
}

export default function AISettingsDialog() {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<AISettings>({
    useCustom: false,
    provider: 'openai',
    apiKey: '',
    model: 'gpt-4o',
  });

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setSettings(JSON.parse(stored));
      }
    } catch {
      // ignore
    }
  }, []);

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    setOpen(false);
  };

  const handleProviderChange = (provider: 'openai' | 'anthropic' | 'deepseek') => {
    const defaultModel = MODEL_SUGGESTIONS[provider]?.[0] || '';
    setSettings((prev) => ({ ...prev, provider, model: defaultModel }));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted"
        >
          <Settings className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-white border-border text-foreground sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground">AI 设置</DialogTitle>
        </DialogHeader>
        <div className="space-y-5 py-2">
          {/* Toggle custom API */}
          <div className="flex items-center justify-between">
            <Label htmlFor="use-custom" className="text-sm text-muted-foreground">
              使用自定义 API
            </Label>
            <Switch
              id="use-custom"
              checked={settings.useCustom}
              onCheckedChange={(checked) =>
                setSettings((prev) => ({ ...prev, useCustom: checked }))
              }
            />
          </div>

          {settings.useCustom && (
            <>
              {/* Provider */}
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">提供商</Label>
                <Select
                  value={settings.provider}
                  onValueChange={(v) =>
                    handleProviderChange(v as 'openai' | 'anthropic' | 'deepseek')
                  }
                >
                  <SelectTrigger className="bg-white border-border text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-border">
                    <SelectItem value="openai">OpenAI</SelectItem>
                    <SelectItem value="anthropic">Anthropic</SelectItem>
                    <SelectItem value="deepseek">DeepSeek</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* API Key */}
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">API Key</Label>
                <Input
                  type="password"
                  value={settings.apiKey}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, apiKey: e.target.value }))
                  }
                  placeholder="sk-..."
                  className="bg-white border-border text-foreground placeholder:text-muted-foreground"
                />
              </div>

              {/* Model */}
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">模型</Label>
                <Select
                  value={settings.model}
                  onValueChange={(v) =>
                    setSettings((prev) => ({ ...prev, model: v }))
                  }
                >
                  <SelectTrigger className="bg-white border-border text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-border">
                    {(MODEL_SUGGESTIONS[settings.provider] || []).map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {/* Save button */}
          <Button
            onClick={handleSave}
            className="w-full bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-white border-0"
          >
            保存设置
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}