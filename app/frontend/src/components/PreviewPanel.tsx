import { useState } from "react";
import { Monitor, Smartphone, RotateCw, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PreviewPanelProps {
  hasContent?: boolean;
  htmlContent?: string;
}

export default function PreviewPanel({ hasContent = false, htmlContent }: PreviewPanelProps) {
  const [viewMode, setViewMode] = useState<"desktop" | "mobile">("desktop");
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <div className="flex flex-col h-full bg-[#F8F9FA] rounded-bl-lg overflow-hidden border-t border-border">
      {/* Preview Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-white border-b border-border">
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
          </div>
          <span className="text-xs text-muted-foreground ml-2">预览</span>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="w-6 h-6"
            onClick={() => setViewMode("desktop")}
          >
            <Monitor
              className={`w-3.5 h-3.5 ${viewMode === "desktop" ? "text-primary" : "text-muted-foreground"}`}
            />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="w-6 h-6"
            onClick={() => setViewMode("mobile")}
          >
            <Smartphone
              className={`w-3.5 h-3.5 ${viewMode === "mobile" ? "text-primary" : "text-muted-foreground"}`}
            />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="w-6 h-6"
            onClick={handleRefresh}
          >
            <RotateCw className="w-3.5 h-3.5 text-muted-foreground" />
          </Button>
        </div>
      </div>

      {/* Preview Content */}
      <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
        {hasContent && htmlContent ? (
          <div
            key={refreshKey}
            className={`h-full rounded-lg border border-border overflow-hidden fade-in-up ${
              viewMode === "mobile" ? "w-[320px]" : "w-full"
            }`}
          >
            <iframe
              srcDoc={htmlContent}
              className="w-full h-full border-0 bg-white"
              title="Preview"
              sandbox="allow-scripts allow-same-origin"
            />
          </div>
        ) : hasContent ? (
          <div
            key={refreshKey}
            className={`h-full bg-gradient-to-br from-[#0f0f23] via-[#1a1a2e] to-[#16213e] rounded-lg border border-border overflow-hidden fade-in-up ${
              viewMode === "mobile" ? "w-[320px]" : "w-full"
            }`}
          >
            <div className="h-full overflow-auto flex items-center justify-center">
              <p className="text-xs text-muted-foreground">渲染中...</p>
            </div>
          </div>
        ) : (
          /* Empty State */
          <div className="flex flex-col items-center justify-center gap-3">
            <Eye className="w-10 h-10 text-muted-foreground/30" />
            <div className="text-center">
              <p className="text-sm text-muted-foreground/50">预览区域</p>
              <p className="text-xs text-muted-foreground/30 mt-1">代码生成后将在此处显示预览</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}