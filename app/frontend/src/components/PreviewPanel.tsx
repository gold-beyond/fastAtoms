import { useState } from "react";
import { Monitor, Smartphone, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PreviewPanel() {
  const [viewMode, setViewMode] = useState<"desktop" | "mobile">("desktop");
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <div className="flex flex-col h-full bg-[#0d0d1a] rounded-bl-lg overflow-hidden border-t border-border">
      {/* Preview Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#0f0f23] border-b border-border">
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
              className={`w-3.5 h-3.5 ${viewMode === "desktop" ? "text-indigo-400" : "text-muted-foreground"}`}
            />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="w-6 h-6"
            onClick={() => setViewMode("mobile")}
          >
            <Smartphone
              className={`w-3.5 h-3.5 ${viewMode === "mobile" ? "text-indigo-400" : "text-muted-foreground"}`}
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

      {/* URL Bar */}
      <div className="px-3 py-1.5 bg-[#12122a] border-b border-border">
        <div className="flex items-center gap-2 px-2 py-1 bg-[#0f0f23] rounded text-xs text-muted-foreground">
          <span className="text-green-400">🔒</span>
          <span>localhost:3000</span>
        </div>
      </div>

      {/* Preview Content */}
      <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
        <div
          key={refreshKey}
          className={`h-full bg-gradient-to-br from-[#0f0f23] via-[#1a1a2e] to-[#16213e] rounded-lg border border-border overflow-hidden fade-in-up ${
            viewMode === "mobile" ? "w-[320px]" : "w-full"
          }`}
        >
          {/* Simulated Website Preview */}
          <div className="h-full overflow-auto">
            {/* Nav */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-white/5">
              <span className="text-sm font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                MyBrand
              </span>
              <div className="flex gap-4 text-xs text-white/50">
                <span>特性</span>
                <span>联系我们</span>
              </div>
            </div>

            {/* Hero */}
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <h1 className="text-xl md:text-2xl font-bold text-white mb-2">
                构建未来的数字体验
              </h1>
              <p className="text-xs text-white/60 mb-4">
                使用最先进的技术，打造令人惊叹的网站
              </p>
              <button className="px-4 py-1.5 text-xs font-medium text-white bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full">
                立即开始
              </button>
            </div>

            {/* Features */}
            <div className="px-4 pb-6">
              <h2 className="text-sm font-semibold text-white text-center mb-4">
                核心特性
              </h2>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { icon: "⚡", title: "极速性能" },
                  { icon: "🎨", title: "精美设计" },
                  { icon: "🔒", title: "安全可靠" },
                ].map((feature) => (
                  <div
                    key={feature.title}
                    className="bg-white/5 border border-white/10 rounded-lg p-3 text-center"
                  >
                    <span className="text-lg">{feature.icon}</span>
                    <p className="text-xs text-white/80 mt-1">
                      {feature.title}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}