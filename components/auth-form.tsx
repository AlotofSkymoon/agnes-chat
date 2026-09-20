"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, LogIn, Sparkles, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/";

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const isLogin = mode === "login";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/auth/${isLogin ? "login" : "register"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json()) as {
        error?: string;
        isFirstUser?: boolean;
        needVerification?: boolean;
        email?: string;
        mailFailed?: boolean;
      };

      if (!res.ok) {
        /*
         * 登录被"邮箱未验证"拦下时，直接把人送到验证页 ——
         * 否则用户只知道登不进去，不知道该去哪补验证。
         */
        if (data.needVerification && data.email) {
          router.push(`/verify?email=${encodeURIComponent(data.email)}`);
          return;
        }
        toast.error(data.error ?? "操作失败");
        return;
      }

      /*
       * 注册需要验证邮箱：不建 session，先去验证页。
       * 邮件没发出去时（mailFailed）服务端已放行并给了 session，走正常跳转。
       */
      if (!isLogin && data.needVerification) {
        toast.success("验证码已发送，请查收邮箱");
        router.push(`/verify?email=${encodeURIComponent(data.email ?? email)}`);
        return;
      }

      if (!isLogin && data.isFirstUser) {
        toast.success("你是第一位用户，已获得管理员权限。");
      } else if (data.mailFailed) {
        // 邮件服务异常，已放行但让用户知道验证码没发出去
        toast.success("注册成功（邮件服务暂不可用，已直接放行）");
      } else {
        toast.success(isLogin ? "登录成功" : "注册成功");
      }

      router.push(redirectTo);
      router.refresh();
    } catch {
      toast.error("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-2 text-center">
        <div className="mx-auto mb-1 flex h-12 w-12 items-center justify-center rounded-2xl brand-gradient shadow-xl shadow-primary/30">
          <Sparkles className="h-6 w-6 text-primary-foreground" />
        </div>
        <CardTitle className="text-2xl">{isLogin ? "登录" : "注册"}</CardTitle>
        <CardDescription>
          {isLogin
            ? "登录后可选把聊天记录保存到云端"
            : "第一个注册的用户将自动成为管理员"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
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
            <Label htmlFor="password">密码</Label>
            <Input
              id="password"
              type="password"
              autoComplete={isLogin ? "current-password" : "new-password"}
              placeholder={isLogin ? "输入密码" : "至少 8 位"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={isLogin ? undefined : 8}
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isLogin ? (
              <LogIn className="h-4 w-4" />
            ) : (
              <UserPlus className="h-4 w-4" />
            )}
            {isLogin ? "登录" : "注册"}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            {isLogin ? "还没有账号？" : "已有账号？"}{" "}
            <Link
              href={isLogin ? "/register" : "/login"}
              className="font-medium text-primary hover:underline"
            >
              {isLogin ? "去注册" : "去登录"}
            </Link>
          </p>
          <p className="text-center text-xs text-muted-foreground">
            <Link href="/" className="hover:underline">
              ← 返回聊天（不登录也能用）
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
