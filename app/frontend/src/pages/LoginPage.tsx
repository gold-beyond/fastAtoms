import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';

const LOGO_URL =
  'https://mgx-backend-cdn.metadl.com/generate/images/1263427/2026-05-22/pcdp5pyaagrq/atoms-logo-glow.png';

const TIPS = ['默认账号: admin / admin123', '默认账号: alex / alex123', '默认账号: sarah / sarah123'];

export default function LoginPage() {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [tipIndex, setTipIndex] = useState(0);
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate('/', { replace: true });
    }
  }, [loading, user, navigate]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTipIndex((i) => (i + 1) % TIPS.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || !password) return;
    setSubmitting(true);
    setError('');
    try {
      await login(trimmed, password);
    } catch (err) {
      setError((err as Error).message || '登录失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a1a] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a1a] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <form
          onSubmit={handleSubmit}
          className="bg-[#0f0f23] border border-border rounded-xl p-8 space-y-5 shadow-[0_0_40px_rgba(99,102,241,0.08)]"
        >
          <div className="flex flex-col items-center gap-3">
            <img
              src={LOGO_URL}
              alt="Atoms Logo"
              className="w-12 h-12 rounded-lg"
            />
            <span className="text-lg font-semibold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
              Atoms
            </span>
          </div>

          <div className="text-center space-y-1">
            <h1 className="text-white text-xl font-semibold">欢迎回来</h1>
            <p className="text-muted-foreground text-sm">
              登录你的账号继续创作
            </p>
          </div>

          <div className="space-y-3">
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError('');
              }}
              placeholder="用户名"
              autoComplete="username"
              className="bg-[#1a1a2e] border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-indigo-500/50 h-11 text-sm"
              disabled={submitting}
            />
            <Input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError('');
              }}
              placeholder="密码"
              autoComplete="current-password"
              className="bg-[#1a1a2e] border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-indigo-500/50 h-11 text-sm"
              disabled={submitting}
            />

            {error && (
              <p className="text-red-400 text-xs text-center">{error}</p>
            )}

            <Button
              type="submit"
              disabled={!name.trim() || !password || submitting}
              className="w-full bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white border-0 h-11 text-sm font-medium"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  登录中...
                </>
              ) : (
                '登录'
              )}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center transition-opacity duration-500">
            {TIPS[tipIndex]}
          </p>
        </form>
      </div>
    </div>
  );
}
