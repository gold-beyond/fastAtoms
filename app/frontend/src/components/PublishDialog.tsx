import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check, Copy, ExternalLink, Loader2, Rocket } from "lucide-react";

interface PublishDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type PublishStep = "idle" | "building" | "deploying" | "published";

export default function PublishDialog({
  open,
  onOpenChange,
}: PublishDialogProps) {
  const [step, setStep] = useState<PublishStep>("idle");
  const [copied, setCopied] = useState(false);
  const publishedUrl = "https://my-landing-page.atoms.app";

  useEffect(() => {
    if (open) {
      setStep("idle");
      setCopied(false);
    }
  }, [open]);

  const handlePublish = () => {
    setStep("building");
    setTimeout(() => {
      setStep("deploying");
      setTimeout(() => {
        setStep("published");
      }, 2000);
    }, 2000);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(publishedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white border-border text-foreground max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold flex items-center gap-2">
            <Rocket className="w-5 h-5 text-primary" />
            发布项目
          </DialogTitle>
        </DialogHeader>

        <div className="py-4">
          {step === "idle" && (
            <div className="space-y-4 fade-in-up">
              <p className="text-sm text-muted-foreground">
                将你的项目部署到全球 CDN，获得一个可分享的链接。
              </p>
              <div className="bg-muted rounded-lg p-4 border border-border">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">项目</span>
                  <span className="text-foreground font-medium">
                    现代化 Landing Page
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm mt-2">
                  <span className="text-muted-foreground">文件</span>
                  <span className="text-foreground">3 个文件</span>
                </div>
                <div className="flex items-center justify-between text-sm mt-2">
                  <span className="text-muted-foreground">区域</span>
                  <span className="text-foreground">全球</span>
                </div>
              </div>
              <Button
                onClick={handlePublish}
                className="w-full bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-white border-0"
              >
                <Rocket className="w-4 h-4 mr-2" />
                开始发布
              </Button>
            </div>
          )}

          {step === "building" && (
            <div className="space-y-4 fade-in-up">
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 text-primary animate-spin" />
                <span className="text-sm font-medium">正在构建项目...</span>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>编译文件</span>
                  <span>进行中</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-primary to-accent rounded-full progress-fill" />
                </div>
              </div>
              <div className="bg-muted rounded-lg p-3 font-mono text-xs text-muted-foreground space-y-1">
                <p>
                  <span className="text-emerald-600">✓</span> 解析 index.html
                </p>
                <p>
                  <span className="text-green-400">✓</span> 编译 styles.css
                </p>
                <p>
                  <span className="text-yellow-400">⟳</span> 打包 app.js...
                </p>
              </div>
            </div>
          )}

          {step === "deploying" && (
            <div className="space-y-4 fade-in-up">
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
                <span className="text-sm font-medium">正在部署到全球 CDN...</span>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>部署进度</span>
                  <span>分发中</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-accent to-pink-500 rounded-full progress-fill" />
                </div>
              </div>
              <div className="bg-[#1a1a2e] rounded-lg p-3 font-mono text-xs text-muted-foreground space-y-1">
                <p>
                  <span className="text-emerald-600">✓</span> 构建完成 (1.2s)
                </p>
                <p>
                  <span className="text-green-400">✓</span> 上传资源文件
                </p>
                <p>
                  <span className="text-yellow-400">⟳</span> 配置 DNS...
                </p>
              </div>
            </div>
          )}

          {step === "published" && (
            <div className="space-y-4 fade-in-up">
              <div className="flex flex-col items-center py-4">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center mb-3 pulse-glow">
                  <Check className="w-6 h-6 text-emerald-600" />
                </div>
                <h3 className="text-base font-semibold text-foreground">
                  发布成功！🎉
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  你的网站已上线
                </p>
              </div>

              <div className="bg-[#1a1a2e] rounded-lg p-3 flex items-center justify-between border border-green-500/20">
                <span className="text-sm text-indigo-300 truncate">
                  {publishedUrl}
                </span>
                <div className="flex gap-1 ml-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-7 h-7"
                    onClick={handleCopy}
                  >
                    {copied ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                    )}
                  </Button>
                  <Button variant="ghost" size="icon" className="w-7 h-7">
                    <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                  </Button>
                </div>
              </div>

              <Button
                onClick={() => onOpenChange(false)}
                variant="outline"
                className="w-full border-border text-foreground hover:bg-muted"
              >
                完成
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}