"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, MailCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** 重发倒计时（秒），与服务端冷却保持一致 */
const COOLDOWN = 60;

export function VerifyForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  /*
   * 邮箱优先从 query 带过来（注册成功后跳转会带上）。
   * 没有的话让用户手填 —— 直接刷新这个页面时不该把人挡在门外。
   */
  const [email, setEmail] = React.useState(() => searchParams.get("email") ?? "");
  const [code, setCode] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [resending, setResending] = React.useState(false);
  const [left, setLeft] = React.useState(0);

  React.useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    if (code.trim().length !== 6) {
      toast.error("请输入 6 位验证码");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), code: code.trim(), action: "verify" }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "验证失败");
        return;
      }
      toast.success("验证通过，已自动登录");
      router.push("/");
      router.refresh();
    } catch {
      toast.error("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    if (resending || left > 0) return;
    if (!email.trim()) {
      toast.error("请先填写邮箱");
      return;
    }
    setResending(true);
    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), action: "resend" }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "重发失败");
        return;
      }
      toast.success("验证码已重新发送");
      setLeft(COOLDOWN);
    } catch {
      toast.error("网络错误，请稍后重试");
    } finally {
      setResending(false);
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-2 text-center">
        <div className="mx-auto mb-1 flex h-12 w-12 items-center justify-center rounded-2xl brand-gradient shadow-xl shadow-primary/30">
          <MailCheck className="h-6 w-6 text-primary-foreground" />
        </div>
        <CardTitle className="text-2xl">验证你的邮箱</CardTitle>
        <CardDescription>
          验证码已发送到你的邮箱，30 分钟内有效
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">邮箱</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="code">验证码</Label>
            <Input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="6 位数字"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className="text-center text-lg tracking-[0.4em]"
              required
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            完成验证
          </Button>

          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={resend}
            disabled={resending || left > 0}
          >
            {resending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {left > 0 ? `重发验证码（${left}s）` : "重发验证码"}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            没收到？检查一下垃圾邮件，或者
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mx-1 font-medium text-primary hover:underline"
            >
              刷新页面
            </button>
            再试。
          </p>
          <p className="text-center text-sm text-muted-foreground">
            <Link href="/login" className="font-medium text-primary hover:underline">
              返回登录
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
