import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, FolderOpen, ChevronLeft } from 'lucide-react';
import client from '@/lib/client';

interface Project {
  id: string;
  name: string;
  code_html?: string;
  code_css?: string;
  code_js?: string;
  published_url?: string;
  created_at?: string;
}

interface ProjectSidebarProps {
  visible: boolean;
  onClose: () => void;
  onSelectProject: (project: Project) => void;
  currentProjectId?: string | null;
}

export default function ProjectSidebar({
  visible,
  onClose,
  onSelectProject,
  currentProjectId,
}: ProjectSidebarProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      loadProjects();
    }
  }, [visible]);

  const loadProjects = async () => {
    setLoading(true);
    try {
      const response = await client.entities.projects.query({
        query: {},
        sort: '-created_at',
      });
      if (response?.data?.items) {
        setProjects(response.data.items as Project[]);
      }
    } catch {
      // Silently handle errors
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async () => {
    try {
      const response = await client.entities.projects.create({
        data: {
          name: `项目 ${projects.length + 1}`,
          code_html: '',
          code_css: '',
          code_js: '',
        },
      });
      if (response?.data) {
        const newProject = response.data as Project;
        setProjects((prev) => [newProject, ...prev]);
        onSelectProject(newProject);
      }
    } catch {
      // Silently handle errors
    }
  };

  if (!visible) return null;

  return (
    <div className="w-[220px] min-w-[220px] flex flex-col h-full bg-[#F7F7F8] border-r border-border">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-border">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          项目列表
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-foreground"
          onClick={onClose}
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
      </div>

      {/* New Project Button */}
      <div className="px-3 py-2">
        <Button
          variant="outline"
          size="sm"
          className="w-full text-xs border-dashed border-primary/30 text-primary hover:bg-primary/10 hover:text-primary/80"
          onClick={handleCreateProject}
        >
          <Plus className="w-3.5 h-3.5 mr-1" />
          新建项目
        </Button>
      </div>

      {/* Project List */}
      <ScrollArea className="flex-1 px-2">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <span className="text-xs text-muted-foreground">加载中...</span>
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <FolderOpen className="w-8 h-8 text-muted-foreground/50" />
            <span className="text-xs text-muted-foreground">暂无项目</span>
          </div>
        ) : (
          <div className="space-y-1 py-1">
            {projects.map((project) => (
              <button
                key={project.id}
                onClick={() => onSelectProject(project)}
                className={`w-full text-left px-3 py-2 rounded-md text-xs transition-colors ${
                  currentProjectId === project.id
                    ? 'bg-primary/10 text-primary border border-primary/20'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <div className="font-medium truncate">{project.name}</div>
                {project.created_at && (
                  <div className="text-[10px] text-muted-foreground/60 mt-0.5">
                    {new Date(project.created_at).toLocaleDateString('zh-CN')}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}