"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Copy,
  Crown,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  RefreshCw,
  Shield,
  Trash2,
  User as UserIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SiteFooter } from "@/components/site-footer";

interface AdminUser {
  id: string;
  email: string;
  role: "admin" | "user";
  createdAt: string;
}

export function AdminClient({ me }: { me: AdminUser }) {
  const router = useRouter();
  const [users, setUsers] = React.useState<AdminUser[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [presetKey, setPresetKey] = React.useState("");
  const [showKey, setShowKey] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users", { cache: "no-store" });
      const data = (await res.json()) as { users?: AdminUser[]; error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "加载失败");
        return;
      }
      setUsers(data.users ?? []);
    } catch {
      toast.error("网络错误");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadKey = React.useCallback(async () => {
    try {
      const res = await fetch("/api/admin/preset-key", { cache: "no-store" });
      const data = (await res.json()) as { apiKey?: string; error?: string };
      if (res.ok) setPresetKey(data.apiKey ?? "");
    } catch {
      /* 忽略 */
    }
  }, []);

  React.useEffect(() => {
    void load();
    void loadKey();
  }, [load, loadKey]);

  async function toggleRole(user: AdminUser) {
    if (user.id === me.id) {
      toast.error("不能取消自己的管理员权限");
      return;
    }
    setBusyId(user.id);
    try {
      const nextRole = user.role === "admin" ? "user" : "admin";
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, role: nextRole }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "操作失败");
        return;
      }
      toast.success(`已把 ${user.email} 设为 ${nextRole === "admin" ? "管理员" : "普通用户"}`);
      await load();
    } catch {
      toast.error("网络错误");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(user: AdminUser) {
    if (user.id === me.id) {
      toast.error("不能删除自己");
      return;
    }
    if (!confirm(`确定删除用户 ${user.email}？该用户的会话与云端记录会一并清除。`)) return;
    setBusyId(user.id);
    try {
      const res = await fetch(`/api/admin/users?userId=${encodeURIComponent(user.id)}`, {
        method: "DELETE",
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "删除失败");
        return;
      }
      toast.success("已删除用户");
      await load();
    } catch {
      toast.error("网络错误");
    } finally {
      setBusyId(null);
    }
  }

  async function copyKey() {
    try {
      await navigator.clipboard.writeText(presetKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("复制失败");
    }
  }

  return (
    <main className="relative min-h-[100dvh] px-4 py-10">
      <div className="pointer-events-none absolute inset-0 aurora" />
      <div className="relative mx-auto w-full max-w-4xl space-y-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          返回聊天
        </Link>

        <div className="flex items-center gap-2 rounded-2xl border border-primary/40 bg-primary/10 px-4 py-3 text-sm text-primary">
          <Crown className="h-4 w-4 shrink-0" />
          你是第一位注册用户，已自动成为管理员
        </div>

        <Card>
          <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
            <div className="space-y-1.5">
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="h-4 w-4" />
                站点内置 Agnes API Key
              </CardTitle>
              <CardDescription>
                仅管理员可见。普通用户只能使用，永远拿不到完整值（不下发到浏览器）。
              </CardDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={() => void loadKey()} title="刷新">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            {presetKey ? (
              <div className="flex flex-wrap items-center gap-2">
                <code className="flex-1 truncate rounded-xl border border-border/70 bg-muted/50 px-3 py-2 text-xs">
                  {showKey ? presetKey : `${presetKey.slice(0, 6)}••••••••${presetKey.slice(-4)}`}
                </code>
                <Button variant="outline" size="sm" onClick={() => setShowKey((v) => !v)}>
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  {showKey ? "隐藏" : "显示"}
                </Button>
                <Button variant="outline" size="sm" onClick={copyKey}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? "已复制" : "复制"}
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                未配置 PRESET_AGNES_API_KEY 环境变量。
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
            <div className="space-y-1.5">
              <CardTitle>用户管理</CardTitle>
              <CardDescription>共 {users.length} 位用户</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              刷新
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                加载中…
              </div>
            ) : (
              <div className="space-y-2">
                {users.map((u) => (
                  <div
                    key={u.id}
                    className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card/50 p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">{u.email}</span>
                        {u.role === "admin" ? (
                          <Badge>
                            <Shield className="mr-1 h-3 w-3" />
                            admin
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <UserIcon className="mr-1 h-3 w-3" />
                            user
                          </Badge>
                        )}
                        {u.id === me.id ? <Badge variant="outline">我</Badge> : null}
                      </div>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        id: {u.id} · {new Date(u.createdAt).toLocaleString("zh-CN")}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleRole(u)}
                        disabled={busyId === u.id}
                      >
                        {u.role === "admin" ? "设为普通用户" : "设为管理员"}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => remove(u)}
                        disabled={busyId === u.id}
                      >
                        <Trash2 className="h-4 w-4" />
                        删除
                      </Button>
                    </div>
                  </div>
                ))}
                {users.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">暂无用户</p>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <SiteFooter />
    </main>
  );
}
