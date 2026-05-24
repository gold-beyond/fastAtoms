import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Rocket, PanelLeft, Code2, LogOut, FolderOpen, User, Settings } from 'lucide-react';
import { AgentProvider, useAgentContext } from '@/contexts/AgentContext';
import ChatPanel from '@/components/ChatPanel';
import CodeEditor from '@/components/CodeEditor';
import PreviewPanel from '@/components/PreviewPanel';
import PublishDialog from '@/components/PublishDialog';
import { Input } from '@/components/ui/input';

import ProjectSidebar from '@/components/ProjectSidebar';
import ConversationSidebar, { ConversationSidebarToggle } from '@/components/ConversationSidebar';
import AgentBar from '@/components/AgentBar';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/simpleApi';
import { ConversationItem, getLocalConversations, saveLocalConversations, deleteLocalConversation, renameLocalConversation } from '@/lib/conversationUtils';

const LOGO_URL =
  'https://mgx-backend-cdn.metadl.com/generate/images/1263427/2026-05-22/pcdp5pyaagrq/atoms-logo-glow.png';

interface Project {
  id: string;
  name: string;
  code_html?: string;
  code_css?: string;
  code_js?: string;
  published_url?: string;
  created_at?: string;
}

interface GeneratedFile {
  id: string;
  name: string;
  icon: React.ReactNode;
  language: string;
  code: string;
}

export default function IndexPage() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  const [publishOpen, setPublishOpen] = useState(false);

  return (
    <AgentProvider>
      <AppContent
        user={user}
        loading={loading}
        logout={logout}
        navigate={navigate}
        publishOpen={publishOpen}
        setPublishOpen={setPublishOpen}
      />
    </AgentProvider>
  );
}

interface AppContentProps {
  user: ReturnType<typeof useAuth>['user'];
  loading: boolean;
  logout: () => void;
  navigate: ReturnType<typeof useNavigate>;
  publishOpen: boolean;
  setPublishOpen: (v: boolean) => void;
}

function AppContent({ user, loading, logout, navigate, publishOpen, setPublishOpen }: AppContentProps) {
  const { workMode } = useAgentContext();
  const [chatCollapsed, setChatCollapsed] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [generatedFiles, setGeneratedFiles] = useState<GeneratedFile[]>([]);
  const [previewHtml, setPreviewHtml] = useState<string>('');

  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  // Restore active conversation from sessionStorage (survives page refresh)
  const [currentConvId, setCurrentConvId] = useState<string | null>(
    () => sessionStorage.getItem('atoms_current_conv') || null
  );
  const [convSidebarCollapsed, setConvSidebarCollapsed] = useState(false);
  const [agentBarVisible, setAgentBarVisible] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [keyConfigured, setKeyConfigured] = useState(false);
  const [keyOwner, setKeyOwner] = useState('');
  const settingsBtnRef = useRef<HTMLDivElement>(null);

  // Show settings button if no key configured, or current user is the owner
  const canSeeSettings = !keyConfigured || (user && keyOwner === user.id);

  // Close settings dropdown on click outside
  useEffect(() => {
    if (!showSettings) return;
    const handler = (e: MouseEvent) => {
      if (settingsBtnRef.current && !settingsBtnRef.current.contains(e.target as Node)) {
        setShowSettings(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showSettings]);

  // Check if key is configured globally and who owns it
  useEffect(() => {
    api.get('/api/v1/admin/settings/shared-key/deepseek').then((r: any) => {
      if (r?.configured) {
        setKeyConfigured(true);
        setKeyOwner(r.owner || '');
      } else {
        setKeyConfigured(false);
        setKeyOwner('');
      }
    }).catch(() => {});
  }, [user]);

  const isLoggedIn = !!user;

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login', { replace: true });
    }
  }, [loading, user, navigate]);

  const loadConversationList = useCallback(async () => {
    if (isLoggedIn) {
      try {
        const data = await api.get<any>('/api/v1/entities/conversations');
        if (data?.items && Array.isArray(data.items)) {
          const seen = new Set<string>();
          const items: ConversationItem[] = [];
          for (const item of data.items) {
            const id = String(item.id);
            if (seen.has(id)) continue;
            seen.add(id);
            items.push({
              id,
              title: (item.title as string) || '新对话',
              created_at: item.created_at as string | undefined,
              messages: item.messages as string | undefined,
            });
          }
          items.sort((a, b) => {
            if (!a.created_at || !b.created_at) return 0;
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          });
          setConversations(items);
        }
      } catch {
        // Silently handle errors
      }
    } else {
      const raw = getLocalConversations();
      const seen = new Set<string>();
      const deduped = raw.filter((c) => {
        if (seen.has(c.id)) return false;
        seen.add(c.id);
        return true;
      });
      if (deduped.length !== raw.length) {
        saveLocalConversations(deduped);
      }
      setConversations(deduped);
    }
  }, [isLoggedIn]);

  useEffect(() => {
    if (loading) return;
    loadConversationList();
  }, [loadConversationList, loading]);


  const handleSelectConversation = useCallback((conv: ConversationItem) => {
    setCurrentConvId(conv.id);
    sessionStorage.setItem('atoms_current_conv', conv.id);
    setGeneratedFiles([]);
    setPreviewHtml('');
  }, []);

  const handleNewConversation = useCallback(() => {
    setCurrentConvId(null);
    sessionStorage.removeItem('atoms_current_conv');
    setGeneratedFiles([]);
    setPreviewHtml('');
  }, []);

  const handleConversationSaved = useCallback(
    (_id: string) => {
      loadConversationList();
    },
    [loadConversationList]
  );

  const handleCurrentConvIdChange = useCallback((id: string | null) => {
    // Persist to sessionStorage so it survives page refresh
    if (id) {
      sessionStorage.setItem('atoms_current_conv', id);
    } else {
      sessionStorage.removeItem('atoms_current_conv');
    }
    setCurrentConvId(id);
  }, []);

  const handleSelectProject = useCallback((project: Project) => {
    setCurrentProject(project);
  }, []);

  const handleDeleteConversation = useCallback(
    async (conv: ConversationItem) => {
      if (isLoggedIn) {
        try {
          await api.del(`/api/v1/entities/conversations/${conv.id}`);
        } catch { /* ignore delete errors */ }
      } else {
        deleteLocalConversation(conv.id);
      }
      if (currentConvId === conv.id) {
        setCurrentConvId(null);
        setGeneratedFiles([]);
        setPreviewHtml('');
      }
      await loadConversationList();
    },
    [isLoggedIn, currentConvId, loadConversationList]
  );

  const handleRenameConversation = useCallback(
    async (conv: ConversationItem, newTitle: string) => {
      if (isLoggedIn) {
        try {
          await api.put(`/api/v1/entities/conversations/${conv.id}`, { title: newTitle });
        } catch { /* ignore rename errors */ }
      } else {
        renameLocalConversation(conv.id, newTitle);
      }
      await loadConversationList();
    },
    [isLoggedIn, loadConversationList]
  );

  const [rightPanelTab, setRightPanelTab] = useState<'preview' | 'editor'>('preview');
  const [chatWidth, setChatWidth] = useState(35);
  const [sidebarWidth, setSidebarWidth] = useState(224);
  const chatWidthRef = useRef(35);
  const sidebarWidthRef = useRef(224);
  const sidebarCollapsedRef = useRef(false);
  const resizing = useRef<string | false>(false);

  // Sync state → refs for resize handlers
  useEffect(() => { chatWidthRef.current = chatWidth; }, [chatWidth]);
  useEffect(() => { sidebarWidthRef.current = sidebarWidth; }, [sidebarWidth]);
  useEffect(() => { sidebarCollapsedRef.current = convSidebarCollapsed; }, [convSidebarCollapsed]);

  const handleResizeStart = useCallback((e: React.MouseEvent, target: 'sidebar' | 'chat') => {
    e.preventDefault();
    resizing.current = target;
    const startX = e.clientX;
    const startSidebarW = sidebarWidthRef.current;

    const onMove = (ev: MouseEvent) => {
      if (!resizing.current) return;
      if (resizing.current === 'sidebar') {
        setSidebarWidth(Math.max(160, Math.min(400, ev.clientX - startX + startSidebarW)));
      } else {
        const container = document.querySelector('.main-content');
        if (!container) return;
        const rect = container.getBoundingClientRect();
        // Use actual sidebar width: 0 if collapsed
        const isCollapsed = sidebarCollapsedRef.current;
        const sw = isCollapsed ? 0 : sidebarWidthRef.current;
        const sidebarOffset = sw + (isCollapsed ? 0 : 6);
        const availableWidth = rect.width - sidebarOffset;
        const pct = ((ev.clientX - rect.left - sidebarOffset) / availableWidth) * 100;
        setChatWidth(Math.max(20, Math.min(70, pct)));
      }
    };

    const onUp = () => {
      resizing.current = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, []);

  const handleCodeGenerated = useCallback((files: GeneratedFile[], html: string) => {
    // Merge new files with existing ones, replacing by filename to avoid duplicates
    setGeneratedFiles((prev) => {
      const existing = new Map(prev.map((f) => [f.name, f]));
      for (const f of files) existing.set(f.name, f);
      return Array.from(existing.values());
    });
    if (html) setPreviewHtml(html);
    if (html) setRightPanelTab('preview');
  }, []);

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background">
      <header className="flex items-center justify-between px-4 py-2 bg-background border-b border-border z-10">
        <div className="flex items-center gap-3">
          <img
            src={LOGO_URL}
            alt="fastAtoms Logo"
            className="w-7 h-7 rounded"
          />
          <span className="text-sm font-semibold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            fastAtoms
          </span>
          <span className="text-xs text-muted-foreground px-2 py-0.5 bg-muted rounded border border-border">
            {currentProject?.name || '现代化 Landing Page'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {canSeeSettings && (
            <div className="relative" ref={settingsBtnRef}>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => setShowSettings(!showSettings)}
              >
                <Settings className="w-4 h-4" />
              </Button>
              {showSettings && (
                <div className="absolute top-full right-0 mt-1 w-56 bg-white border border-border rounded-lg shadow-lg z-50 overflow-hidden p-3">
                  <SettingsDropdown onSaved={() => { setKeyConfigured(true); setKeyOwner(user?.id || ''); setShowSettings(false); }} />
                </div>
              )}
            </div>
          )}
          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => setAgentBarVisible(!agentBarVisible)}
            >
              <PanelLeft className="w-4 h-4 mr-1" />
              <span className="text-xs">团队</span>
            </Button>
            <AgentBar visible={agentBarVisible} onClose={() => setAgentBarVisible(false)} />
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => setChatCollapsed(!chatCollapsed)}
          >
            <PanelLeft className="w-4 h-4 mr-1" />
            <span className="text-xs">面板</span>
          </Button>
          <Button
            onClick={() => setPublishOpen(true)}
            size="sm"
            className="bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-white border-0 text-xs"
          >
            <Rocket className="w-3.5 h-3.5 mr-1" />
            发布
          </Button>

          {loading ? (
            <div className="w-8 h-8 rounded-full bg-muted animate-pulse" />
          ) : isLoggedIn ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent hover:from-primary/90 hover:to-accent/90"
                >
                  <User className="w-4 h-4 text-white" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="bg-popover border-border"
              >
                <DropdownMenuItem
                  onClick={logout}
                  className="text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  退出登录
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/login')}
              className="text-primary hover:text-primary/80 text-xs"
            >
              登录
            </Button>
          )}
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative main-content">
        {isLoggedIn && (
          <ProjectSidebar
            visible={sidebarVisible}
            onClose={() => setSidebarVisible(false)}
            onSelectProject={handleSelectProject}
            currentProjectId={currentProject?.id}
          />
        )}

        <div style={{ width: convSidebarCollapsed ? 0 : sidebarWidth, minWidth: convSidebarCollapsed ? 0 : 160, overflow: convSidebarCollapsed ? 'hidden' : 'visible' }} className="flex-shrink-0">
          <ConversationSidebar
            conversations={conversations}
            currentConvId={currentConvId}
            onSelectConversation={handleSelectConversation}
            onNewConversation={handleNewConversation}
            onDeleteConversation={handleDeleteConversation}
            onRenameConversation={handleRenameConversation}
            collapsed={convSidebarCollapsed}
            onToggleCollapse={() => setConvSidebarCollapsed(true)}
          />
        </div>
        {!convSidebarCollapsed && (
          <div
            className="w-[5px] cursor-col-resize flex-shrink-0 relative group"
            onMouseDown={(e) => handleResizeStart(e, 'sidebar')}
          >
            <div className="absolute inset-y-0 left-1/2 -translate-x-px w-px bg-border group-hover:bg-foreground/50" />
          </div>
        )}

        {convSidebarCollapsed && (
          <ConversationSidebarToggle onClick={() => setConvSidebarCollapsed(false)} />
        )}

        {!chatCollapsed && (
          <>
            <div style={{ width: `${chatWidth}%`, minWidth: 280 }}>
              <ChatPanel
                onCodeGenerated={handleCodeGenerated}
                isLoggedIn={isLoggedIn}
                currentConvId={currentConvId}
                onCodeRestored={handleCodeGenerated}
                onCurrentConvIdChange={handleCurrentConvIdChange}
                onConversationSaved={handleConversationSaved}
              />
            </div>
            <div
              className="w-[5px] cursor-col-resize flex-shrink-0 relative group"
              onMouseDown={(e) => handleResizeStart(e, 'chat')}
            >
              <div className="absolute inset-y-0 left-1/2 -translate-x-px w-px bg-border group-hover:bg-foreground/50 transition-colors" />
            </div>
          </>
        )}

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center gap-1 px-3 py-1.5 bg-muted border-b border-border">
            <button
              onClick={() => setRightPanelTab('preview')}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                rightPanelTab === 'preview'
                  ? 'bg-primary/10 text-primary border border-primary/20'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              预览
            </button>
            <button
              onClick={() => setRightPanelTab('editor')}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                rightPanelTab === 'editor'
                  ? 'bg-primary/10 text-primary border border-primary/20'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              代码
            </button>

          </div>

          <div className="flex-1 min-h-0">
            {rightPanelTab === 'preview' ? (
              <PreviewPanel
                hasContent={!!previewHtml}
                htmlContent={previewHtml}
              />
            ) : (
              <CodeEditor files={generatedFiles} />
            )}
          </div>
        </div>
      </div>

      <PublishDialog open={publishOpen} onOpenChange={setPublishOpen} />
    </div>
  );
}

function SettingsDropdown({ onSaved }: { onSaved: () => void }) {
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [configured, setConfigured] = useState(false);

  useEffect(() => {
    api.get('/api/v1/admin/settings/shared-key/deepseek').then((r: any) => {
      if (r?.configured) setConfigured(true);
    }).catch(() => {});
  }, []);

  const handleSave = async () => {
    if (!apiKey.trim()) return;
    setSaving(true);
    try {
      await api.put('/api/v1/admin/settings/shared-key/deepseek', { provider: 'deepseek', api_key: apiKey.trim() });
      setSaved(true);
      setTimeout(() => { onSaved(); }, 2000);
    } catch (e: any) {
      alert('保存失败: ' + (e?.message || '请检查网络或登录状态'));
    }
    setSaving(false);
  };

  return (
    <div className="space-y-3">
      {saved ? (
        <div className="flex flex-col items-center gap-2 py-4">
          <span className="text-2xl">✅</span>
          <p className="text-sm font-medium text-emerald-600">配置成功，全局生效</p>
          <p className="text-[10px] text-muted-foreground">窗口即将关闭...</p>
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">配置 DeepSeek API Key</p>
          <Input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-..."
            className="text-sm h-8"
          />
          <Button
            size="sm"
            className="w-full h-7 text-xs"
            onClick={handleSave}
            disabled={saving || !apiKey.trim()}
          >
            {saving ? '保存中...' : '保存'}
          </Button>
        </>
      )}
    </div>
  );
}
