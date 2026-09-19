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
  FileText,
  KeyRound,
  Loader2,
  RefreshCw,
  Save,
  Server,
  Settings2,
  Shield,
  Trash2,
  TriangleAlert,
  User as UserIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SiteFooter } from "@/components/site-footer";
import { parseIcpInput } from "@/lib/use-site-icp";
import { timeoutSignal } from "@/lib/fetch-timeout";
import { SiteFooterBadge } from "@/components/site-footer-badge";

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
    <main className="relative min-h-screen-safe px-4 py-10">
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

        <SiteSettingsCard />

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


/* ========================================================================== */
/* 站点配置：原本散落在用户设置里的高级项，统一收归管理员                      */
/* ========================================================================== */

interface SiteSettings {
  defaultBaseUrl: string;
  defaultModel: string;
  cloudSaveDefault: boolean;
  /* 页脚 / 备案 */
  icpText: string;
  icpUrl: string;
  icpIconUrl: string;
  footerExtra: string;
}

function SiteSettingsCard() {
  const [form, setForm] = React.useState<SiteSettings>({
    defaultBaseUrl: "",
    defaultModel: "",
    cloudSaveDefault: false,
    icpText: "",
    icpUrl: "",
    icpIconUrl: "",
    footerExtra: "",
  });
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  /**
   * 读取结果的提示。
   * fatal=true  → 拿不到配置，展示错误态 + 重试
   * fatal=false → 只是警告（如后端没配存储），表单仍可填
   */
  const [loadError, setLoadError] = React.useState<{ msg: string; fatal: boolean } | null>(
    null,
  );

  const load = React.useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      /**
       * 必须带超时。之前没有，服务端一旦挂起（Upstash 慢、KV 卡住），
       * 这张卡片就会永远停在「读取中…」，而其他卡片都正常 ——
       * 看起来像整个页面坏了，实际只是这一个请求没回来。
       */
      const res = await fetch("/api/admin/settings", {
        signal: timeoutSignal(10_000),
      });

      // 403 / 500 也带 JSON，尽量读出服务端给的中文原因
      const data = (await res.json().catch(() => ({}))) as {
        settings?: SiteSettings;
        error?: string;
        storage?: boolean;
      };

      if (!res.ok) {
        setLoadError({ msg: data.error ?? `读取失败（HTTP ${res.status}）`, fatal: true });
        return;
      }

      if (data.settings) {
        /**
         * 旧数据里没有页脚字段（服务端可能是旧版本或空配置），
         * 逐个兜底成空串 —— 否则受控输入拿到 undefined 会报警告，
         * 而且用户在框里一打字就崩。
         */
        setForm({
          ...data.settings,
          icpText: data.settings.icpText ?? "",
          icpUrl: data.settings.icpUrl ?? "",
          icpIconUrl: data.settings.icpIconUrl ?? "",
          footerExtra: data.settings.footerExtra ?? "",
        });
      }
      // storage:false 表示后端没配存储，配置能读但保存会失败，提前告知
      if (data.storage === false) {
        setLoadError({
          msg: "未配置存储后端，当前显示的是默认值，保存也不会生效",
          fatal: false,
        });
      }
    } catch (err) {
      const name = err instanceof Error ? err.name : "";
      setLoadError({
        msg:
          name === "TimeoutError" || name === "AbortError"
            ? "读取超时（10 秒），请检查服务端存储是否正常"
            : "读取站点配置失败，请检查网络",
        fatal: true,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
        signal: timeoutSignal(15_000),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        /** 服务端回读校验：保存的值和读回来的值是否一致 */
        verified?: boolean;
        settings?: SiteSettings;
      };
      if (!res.ok) {
        // 服务端会给出中文原因（如"需要管理员权限""未配置存储"），优先展示
        toast.error(data.error ?? `保存失败（HTTP ${res.status}）`);
        return;
      }
      /**
       * 保存后校验回读值。
       *
       * 之前这里只弹一句"已保存"，实际有没有写进去完全靠猜 ——
       * 于是出现了"保存成功但刷新还是关闭"这种无解现象。
       * 现在服务端会回读并给出 verified，存没存进去当场能看出来。
       */
      if (data.verified === false) {
        toast.error("保存后回读不一致，配置可能未真正写入存储");
      } else {
        toast.success("站点配置已保存，全站生效");
      }
      await load();
    } catch (err) {
      const name = err instanceof Error ? err.name : "";
      toast.error(
        name === "TimeoutError" || name === "AbortError" ? "保存超时，请重试" : "保存失败",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div className="space-y-1.5">
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="h-4 w-4" />
            站点配置
          </CardTitle>
          <CardDescription>
            Base URL、默认模型、云端保存等站点级设置。普通用户的设置面板不显示这些项。
          </CardDescription>
        </div>
        <Button variant="ghost" size="icon" onClick={() => void load()} title="刷新">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          /* 骨架屏：保留大致布局，避免内容到达时高度突变 */
          <div className="space-y-4" aria-busy>
            <div className="space-y-2">
              <div className="h-4 w-24 animate-pulse rounded bg-muted" />
              <div className="h-9 w-full animate-pulse rounded-md bg-muted" />
            </div>
            <div className="space-y-2">
              <div className="h-4 w-20 animate-pulse rounded bg-muted" />
              <div className="h-9 w-full animate-pulse rounded-md bg-muted" />
            </div>
            <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
          </div>
        ) : loadError?.fatal ? (
          /* 出错时给出原因和重试入口，而不是让用户对着空白猜 */
          <div className="space-y-3 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-3">
            <p className="flex items-start gap-2 text-sm text-destructive">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              {loadError.msg}
            </p>
            <Button variant="outline" size="sm" onClick={() => void load()}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              重试
            </Button>
          </div>
        ) : (
          <>
            {/* 非致命警告：表单照常可用，只是提前告知保存会失败 */}
            {loadError ? (
              <p className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 text-sm text-amber-700 dark:text-amber-400">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                {loadError.msg}
              </p>
            ) : null}
            <div className="space-y-1.5">
              <Label htmlFor="ss-base" className="flex items-center gap-2">
                <Server className="h-4 w-4" />
                默认 Base URL
              </Label>
              <Input
                id="ss-base"
                placeholder="留空则使用内置地址（如 https://apihub.agnes-ai.com/v1）"
                value={form.defaultBaseUrl}
                onChange={(e) => setForm((f) => ({ ...f, defaultBaseUrl: e.target.value }))}
                autoComplete="off"
              />
              <p className="text-[11px] text-muted-foreground">
                兼容 OpenAI /chat/completions 的中转地址均可。用户未自定义时生效。
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ss-model">默认模型</Label>
              <Input
                id="ss-model"
                placeholder="留空则使用内置默认（agnes-3.0-flash）"
                value={form.defaultModel}
                onChange={(e) => setForm((f) => ({ ...f, defaultModel: e.target.value }))}
                autoComplete="off"
              />
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border/70 bg-muted/30 px-3 py-3">
              <div className="pr-3">
                <p className="text-sm font-medium">默认开启云端保存</p>
                <p className="text-xs text-muted-foreground">
                  新用户是否默认把聊天记录存到服务端（用户仍可自行关闭）
                </p>
              </div>
              <Switch
                checked={form.cloudSaveDefault}
                onCheckedChange={(v) => setForm((f) => ({ ...f, cloudSaveDefault: v }))}
              />
            </div>

            {/* ---- 页脚 / 备案：在面板里填，不用改环境变量 ---- */}
            <div className="space-y-3 rounded-xl border border-border/70 bg-muted/20 px-3 py-3">
              <p className="flex items-center gap-2 text-sm font-medium">
                <FileText className="h-4 w-4" />
                页脚与备案
              </p>

              <div className="space-y-1.5">
                <Label htmlFor="ss-icp-text">备案号</Label>
                <Input
                  id="ss-icp-text"
                  placeholder="如 京ICP备12345678号-1 / 萌ICP备20260645号，留空不显示"
                  value={form.icpText}
                  onChange={(e) => {
                    const v = e.target.value;
                    /**
                     * 支持直接粘贴第三方备案给的整段 <a> 标签：
                     * 自动拆出链接和文字，不用手动分两个框填。
                     */
                    const parsed = parseIcpInput(v);
                    if (parsed) {
                      setForm((f) => ({
                        ...f,
                        icpText: parsed.icpText || f.icpText,
                        icpUrl: parsed.icpUrl || f.icpUrl,
                      }));
                      toast.success("已识别备案链接，请确认备案号文字");
                      return;
                    }
                    setForm((f) => ({ ...f, icpText: v }));
                  }}
                  autoComplete="off"
                />
                <p className="text-[11px] text-muted-foreground">
                  可直接粘贴第三方备案给的整段 &lt;a&gt; 标签，会自动拆出链接与文字。
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ss-icp-url">备案链接</Label>
                <Input
                  id="ss-icp-url"
                  placeholder="留空则自动指向工信部备案查询系统"
                  value={form.icpUrl}
                  onChange={(e) => {
                    const v = e.target.value;
                    const parsed = parseIcpInput(v);
                    if (parsed) {
                      setForm((f) => ({
                        ...f,
                        icpUrl: parsed.icpUrl || f.icpUrl,
                        icpText: parsed.icpText || f.icpText,
                      }));
                      return;
                    }
                    setForm((f) => ({ ...f, icpUrl: v }));
                  }}
                  autoComplete="off"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ss-icp-icon">备案徽章图片地址</Label>
                <Input
                  id="ss-icp-icon"
                  placeholder="icp.gov.moe / icp.sakura.ink 给的图标链接（可选）"
                  value={form.icpIconUrl}
                  onChange={(e) => setForm((f) => ({ ...f, icpIconUrl: e.target.value }))}
                  autoComplete="off"
                />
                <p className="text-[11px] text-muted-foreground">
                  可选。留空会根据备案链接自动生成徽章（萌备案显示「萌」、
                  工信部显示「ICP」）。填了自己的图片就以图片为准，
                  加载失败会自动退回生成的徽章，不会显示破图。
                </p>
              </div>

              {/* 实时预览：填完立刻能看出效果，不用去前台刷新 */}
              {form.icpUrl || form.icpText ? (
                <div className="space-y-1.5">
                  <Label>徽章预览</Label>
                  <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-[11px] text-fg-tertiary">
                    <SiteFooterBadge
                      src={form.icpIconUrl || undefined}
                      alt={form.icpText || "备案徽章"}
                      href={form.icpUrl || undefined}
                    />
                    <span>{form.icpText || "（未填备案号）"}</span>
                  </div>
                </div>
              ) : null}

              <div className="space-y-1.5">
                <Label htmlFor="ss-footer-extra">页脚额外文字</Label>
                <Input
                  id="ss-footer-extra"
                  placeholder="版权声明、联系方式等（可选）"
                  value={form.footerExtra}
                  onChange={(e) => setForm((f) => ({ ...f, footerExtra: e.target.value }))}
                  autoComplete="off"
                />
              </div>
            </div>

            <Button onClick={() => void save()} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              保存配置
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
