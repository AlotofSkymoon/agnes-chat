"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, LogOut, Shield, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { LS_KEYS } from "@/lib/config";
import { SiteFooter } from "@/components/site-footer";

interface AccountUser {
  id: string;
  email: string;
  role: "admin" | "user";
  createdAt: string;
}

export function AccountClient({ user }: { user: AccountUser }) {
  const router = useRouter();
  const [current, setCurrent] = React.useState("");
  const [next, setNext] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [cloudSync, setCloudSync] = React.useState(false);
  const [clearing, setClearing] = React.useState(false);

  React.useEffect(() => {
    setCloudSync(localStorage.getItem(LS_KEYS.cloudSync) === "true");
  }, []);

  React.useEffect(() => {
    localStorage.setItem(LS_KEYS.cloudSync, String(cloudSync));
  }, [cloudSync]);

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "修改失败");
        return;
      }
      toast.success("密码已修改，请重新登录");
      setCurrent("");
      setNext("");
      router.push("/login");
      router.refresh();
    } catch {
      toast.error("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  async function clearCloudHistory() {
    setClearing(true);
    try {
      const res = await fetch("/api/conversations", { method: "DELETE" });
      const data = (await res.json()) as { error?: string; deleted?: number };
      if (!res.ok) toast.error(data.error ?? "清空失败");
      else toast.success(`已清空云端记录（${data.deleted ?? 0} 条）`);
    } catch {
      toast.error("网络错误");
    } finally {
      setClearing(false);
    }
  }

  function clearLocalHistory() {
    try {
      // 清空所有本地会话（历史列表 + 每个会话的消息）
      Object.keys(localStorage)
        .filter((k) => k.startsWith("agnes:msgs:") || k === "agnes:conversations")
        .forEach((k) => localStorage.removeItem(k));
      toast.success("已清空本地聊天记录");
    } catch {
      toast.error("清空失败");
    }
  }

  return (
    <main className="relative min-h-screen-safe px-4 py-10">
      <div className="pointer-events-none absolute inset-0 aurora" />
      <div className="relative mx-auto w-full max-w-2xl space-y-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          返回聊天
        </Link>

        <Card>
          <CardHeader>
            <CardTitle>账户设置</CardTitle>
            <CardDescription>
              {user.email} · {user.role === "admin" ? "管理员" : "普通用户"} · 注册于{" "}
              {new Date(user.createdAt).toLocaleString("zh-CN")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {user.role === "admin" ? (
              <Link
                href="/admin"
                className="inline-flex items-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-3 py-2 text-sm text-primary"
              >
                <Shield className="h-4 w-4" />
                进入管理员面板
              </Link>
            ) : null}

            <form onSubmit={changePassword} className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="current">当前密码</Label>
                <Input
                  id="current"
                  type="password"
                  value={current}
                  onChange={(e) => setCurrent(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="next">新密码（至少 8 位）</Label>
                <Input
                  id="next"
                  type="password"
                  value={next}
                  onChange={(e) => setNext(e.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </div>
              <Button type="submit" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                修改密码
              </Button>
            </form>

            <div className="h-px bg-border" />

            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">保存聊天记录到云端</p>
                <p className="text-xs text-muted-foreground">默认关闭，开启后同步到 Upstash Redis</p>
              </div>
              <Switch checked={cloudSync} onCheckedChange={setCloudSync} />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={clearLocalHistory}>
                <Trash2 className="h-4 w-4" />
                清空本地记录
              </Button>
              <Button variant="outline" onClick={clearCloudHistory} disabled={clearing}>
                <Trash2 className="h-4 w-4" />
                {clearing ? "清空中…" : "清空云端记录"}
              </Button>
              <Button variant="destructive" onClick={logout}>
                <LogOut className="h-4 w-4" />
                登出
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      <SiteFooter />
    </main>
  );
}
