"use client";

import * as React from "react";
import {
  CloudUpload,
  Eye,
  EyeOff,
  ExternalLink,
  KeyRound,
  Palette,
  Server,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  AGENT_TIP,
  CUSTOM_PROVIDER_PREFIX,
  DEFAULT_MODEL,
  PROVIDERS,
  isBlockedBaseUrl,
  type CustomProviderConfig,
  type ProviderId,
} from "@/lib/config";
import { Loader2, Plus, Pencil, Search, Check as CheckIcon, X as XIcon } from "lucide-react";
import {
  ALLOW_CUSTOM_BASE_URL,
  ALLOW_CUSTOM_KEY,
  THEME_PRESETS,
  type ThemePreset,
} from "@/lib/site";
import { useTheme } from "@/components/theme-provider";
import {
  DEFAULT_S3_CONFIG,
  presetsForPlatform,
  type S3Config,
} from "@/lib/s3-presets";

export interface ChatSettings {
  /** 各服务商的 Key：{ agnes, deepseek, "custom:xxx" } */
  keys: Record<string, string>;
  /**
   * 各服务商「独立」的 Base URL 覆盖值。
   * ⚠️ 必须按服务商分开存 —— 共用一个字符串会导致改 DeepSeek 地址把 Agnes 也带跑。
   */
  baseUrls: Record<string, string>;
  /** 用户自建的 OpenAI 兼容供应商 */
  customProviders: CustomProviderConfig[];
  model: string;
  /** 对象存储配置（图片 / 视频上传） */
  s3?: S3Config;
}

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: ChatSettings;
  onSave: (settings: ChatSettings) => void;
  user: { email: string; role: string } | null;
  cloudSync: boolean;
  onCloudSyncChange: (value: boolean) => void;
  onClearAll: () => void;
}

const PROVIDER_ORDER: ProviderId[] = ["agnes", "deepseek"];

export function SettingsDialog({
  open,
  onOpenChange,
  settings,
  onSave,
  user,
  cloudSync,
  onCloudSyncChange,
  onClearAll,
}: SettingsDialogProps) {
  const [form, setForm] = React.useState<ChatSettings>(settings);
  const [showKey, setShowKey] = React.useState<Record<string, boolean>>({});
  const [showSecret, setShowSecret] = React.useState(false);
  const [discovering, setDiscovering] = React.useState(false);
  const [discoverMsg, setDiscoverMsg] = React.useState("");
  const [siteInfo, setSiteInfo] = React.useState<{
    siteManaged: boolean;
    endpoint: string;
    bucket: string;
    publicBaseUrl: string;
    platform?: "cloudflare" | "vercel" | "local";
  } | null>(null);

  // 只展示当前部署平台支持的对象存储
  const availablePresets = React.useMemo(
    () => presetsForPlatform(siteInfo?.platform ?? "local"),
    [siteInfo?.platform],
  );

  React.useEffect(() => {
    if (!open) return;
    let alive = true;
    fetch("/api/upload/config")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d && typeof d === "object") setSiteInfo(d);
      })
      .catch(() => {
        /* 忽略 */
      });
    return () => {
      alive = false;
    };
  }, [open]);

  const { preset, setPreset } = useTheme();

  /**
   * 权限分流：普通用户只能改「配色主题」和「自己的 API Key」。
   * Base URL、对象存储、云端保存等属于站点级配置，只有管理员可见，
   * 并已在 /admin 面板提供。
   */
  const isAdmin = user?.role === "admin";

  /** 只填桶名 → 自动定位 R2 桶并填好 endpoint / 公开域名 */
  async function discoverBucket() {
    const name = (form.s3?.bucket ?? "").trim();
    if (!name) {
      setDiscoverMsg("请先填写桶名");
      return;
    }
    setDiscovering(true);
    setDiscoverMsg("");
    try {
      const res = await fetch("/api/upload/discover-r2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bucket: name }),
      });
      const data = (await res.json()) as {
        found?: boolean;
        endpoint?: string;
        publicBaseUrl?: string;
        error?: string;
      };
      if (data.found && data.endpoint) {
        patchS3({
          enabled: true,
          endpoint: data.endpoint,
          region: "auto",
          bucket: name,
          publicBaseUrl: data.publicBaseUrl ?? "",
        });
        setDiscoverMsg(`已找到桶「${name}」，端点已自动填入`);
      } else {
        setDiscoverMsg(data.error ?? "未找到该桶");
      }
    } catch {
      setDiscoverMsg("查找失败，请稍后重试");
    } finally {
      setDiscovering(false);
    }
  }

  const s3 = form.s3 ?? DEFAULT_S3_CONFIG;
  const patchS3 = (patch: Partial<S3Config>) =>
    setForm((f) => ({ ...f, s3: { ...(f.s3 ?? DEFAULT_S3_CONFIG), ...patch } }));

  React.useEffect(() => {
    if (open) setForm(settings);
  }, [open, settings]);

  /** 内置 + 自定义，统一成一个列表渲染 */
  const allProviders = React.useMemo(() => {
    const builtin = PROVIDER_ORDER.map((pid) => {
      const p = PROVIDERS[pid];
      return { id: pid as string, label: p.label, baseUrl: p.baseUrl, hasPreset: p.hasPreset, keyUrl: p.keyUrl };
    });
    const custom = form.customProviders.map((c) => ({
      id: c.id,
      label: c.label,
      baseUrl: (form.baseUrls[c.id] ?? "").trim() || c.baseUrl,
      hasPreset: false,
      keyUrl: "",
      isCustom: true,
    }));
    return [...builtin, ...custom];
  }, [form.customProviders, form.baseUrls]);

  function removeCustomProvider(id: string) {
    setForm((f) => ({
      ...f,
      customProviders: f.customProviders.filter((c) => c.id !== id),
      // 同时清掉它的 Key 和 Base URL，避免残留脏数据
      keys: Object.fromEntries(Object.entries(f.keys).filter(([k]) => k !== id)),
      baseUrls: Object.fromEntries(Object.entries(f.baseUrls).filter(([k]) => k !== id)),
      // 若当前正选中该供应商的模型，回落到默认模型
      model: f.customProviders.find((c) => c.id === id)?.models.includes(f.model)
        ? DEFAULT_MODEL
        : f.model,
    }));
  }

  /** 新增 / 编辑自定义供应商的内联表单 */
  function CustomProviderEditor() {
    const [editing, setEditing] = React.useState(false);
    const [label, setLabel] = React.useState("");
    const [url, setUrl] = React.useState("");
    const [modelsRaw, setModelsRaw] = React.useState("");
    const [vision, setVision] = React.useState(false);
    const [err, setErr] = React.useState("");

    function reset() {
      setEditing(false);
      setLabel("");
      setUrl("");
      setModelsRaw("");
      setVision(false);
      setErr("");
    }

    function add() {
      const name = label.trim();
      const base = url.trim().replace(/\/+$/, "");
      const models = modelsRaw
        .split(/[\n,]/)
        .map((m) => m.trim())
        .filter(Boolean);

      if (!name) return setErr("请填写名称");
      if (!base) return setErr("请填写 Base URL");
      if (!/^https?:\/\//i.test(base)) return setErr("Base URL 必须以 http:// 或 https:// 开头");
      if (isBlockedBaseUrl(base)) return setErr("不允许填写内网 / 本机地址");
      if (models.length === 0) return setErr("至少填写一个模型 id");

      const id = `${CUSTOM_PROVIDER_PREFIX}${name.toLowerCase().replace(/[^a-z0-9_-]/g, "") || Date.now()}`;
      if (form.customProviders.some((c) => c.id === id)) return setErr("已存在同名供应商");

      setForm((f) => ({
        ...f,
        customProviders: [...f.customProviders, { id, label: name, baseUrl: base, models, vision }],
        // 默认选中第一个模型，省得再手动切
        model: models[0],
      }));
      reset();
    }

    if (!editing) {
      return (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border px-3 py-2.5 text-xs text-fg-secondary hover:border-primary/50 hover:text-primary"
        >
          <Plus className="h-4 w-4" />
          添加自定义 API 供应商（兼容 OpenAI 接口）
        </button>
      );
    }

    return (
      <div className="space-y-2 rounded-xl border border-border/70 bg-card/40 p-3">
        <Label className="flex items-center gap-2 text-sm font-medium">
          <Pencil className="h-4 w-4" />
          自定义供应商
        </Label>
        <Input
          placeholder="名称，例如：我的中转站"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          autoComplete="off"
        />
        <Input
          placeholder="Base URL，例如：https://api.example.com/v1"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          autoComplete="off"
        />
        <div className="space-y-1">
          <Input
            placeholder="模型 id，多个用逗号或换行分隔"
            value={modelsRaw}
            onChange={(e) => setModelsRaw(e.target.value)}
            autoComplete="off"
          />
          <p className="text-[11px] text-muted-foreground">
            例如：gpt-4o, claude-3-5-sonnet。填的名字要和上游一致。
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs text-fg-secondary">
          <input
            type="checkbox"
            checked={vision}
            onChange={(e) => setVision(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-border"
          />
          这些模型支持识图（vision）
        </label>
        {err ? <p className="text-[11px] text-destructive">{err}</p> : null}
        <div className="flex gap-2">
          <Button type="button" size="sm" onClick={add}>
            <CheckIcon className="h-4 w-4" />
            添加
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={reset}>
            取消
          </Button>
        </div>
      </div>
    );
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedKeys: Record<string, string> = {};
    for (const [k, v] of Object.entries(form.keys)) trimmedKeys[k] = (v ?? "").trim();
    // 自定义供应商的 Key 也要一起带上
    for (const c of form.customProviders) {
      trimmedKeys[c.id] = (form.keys[c.id] ?? "").trim();
    }

    const trimmedBaseUrls: Record<string, string> = {};
    for (const [k, v] of Object.entries(form.baseUrls)) trimmedBaseUrls[k] = (v ?? "").trim();

    onSave({
      keys: trimmedKeys,
      baseUrls: trimmedBaseUrls,
      customProviders: form.customProviders,
      model: form.model,
      s3: form.s3,
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>设置</DialogTitle>
          <DialogDescription>{AGENT_TIP}</DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-5">
          {/* 外观：配色预设 */}
          <div className="space-y-2 rounded-xl border border-border/70 bg-card/40 p-3">
            <Label className="flex items-center gap-2">
              <Palette className="h-4 w-4" />
              配色主题
            </Label>
            <div className="grid grid-cols-2 gap-2">
              {THEME_PRESETS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setPreset(t.id as ThemePreset)}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-left transition-colors",
                    preset === t.id
                      ? "border-primary bg-primary/10"
                      : "border-border hover:bg-muted",
                  )}
                >
                  <span className="block text-sm font-medium">{t.label}</span>
                  <span className="mt-0.5 block text-[11px] text-fg-tertiary">{t.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* API Keys（按服务商）—— 站长可锁死为「仅用内置 Key」 */}
          <div className="space-y-4">
            <Label className="flex items-center gap-2">
              <KeyRound className="h-4 w-4" />
              API Key
              {!ALLOW_CUSTOM_KEY ? (
                <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[10px] text-fg-tertiary">
                  本站点已内置，无需填写
                </span>
              ) : null}
            </Label>

            {!ALLOW_CUSTOM_KEY ? (
              <p className="rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-[11px] text-fg-secondary">
                本站已配置好 API Key，打开即可直接聊天。
              </p>
            ) : null}

            <div className={ALLOW_CUSTOM_KEY ? "space-y-4" : "hidden"}>

            {allProviders.map((p) => {
              const pid = p.id;
              const isCustom = "isCustom" in p && p.isCustom;
              return (
                <div key={pid} className="space-y-1.5 rounded-xl border border-border/70 bg-card/40 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-sm font-medium">
                      {p.label}
                      {isCustom ? (
                        <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
                          自定义
                        </span>
                      ) : null}
                    </span>
                    {isCustom ? (
                      <button
                        type="button"
                        onClick={() => removeCustomProvider(pid)}
                        className="inline-flex items-center gap-1 text-xs text-destructive hover:underline"
                      >
                        <XIcon className="h-3 w-3" />
                        删除
                      </button>
                    ) : (
                      <a
                        href={p.keyUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        去申请
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                  <div className="relative">
                    <Input
                      type={showKey[pid] ? "text" : "password"}
                      placeholder={
                        p.hasPreset ? "sk-...（留空则使用站点内置 Key）" : `sk-...（使用 ${p.label} 模型必填）`
                      }
                      value={form.keys[pid] ?? ""}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, keys: { ...f.keys, [pid]: e.target.value } }))
                      }
                      className="pr-10"
                      autoComplete="off"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey((s) => ({ ...s, [pid]: !s[pid] }))}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:bg-muted"
                      aria-label="显示/隐藏 Key"
                    >
                      {showKey[pid] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {isCustom
                      ? `发往 ${p.baseUrl}`
                      : p.hasPreset
                        ? "保存在浏览器本地，仅用于向 Agnes 发起请求。"
                        : "DeepSeek 无内置 Key，需填你自己的；仅保存在浏览器本地。"}
                  </p>

                  {/* 每个供应商独立的 Base URL —— 互不干扰 */}
                  {isAdmin && ALLOW_CUSTOM_BASE_URL ? (
                    <div className="space-y-1 border-t border-border/60 pt-2">
                      <Label
                        htmlFor={`bu-${pid}`}
                        className="flex items-center gap-1.5 text-[11px] text-fg-tertiary"
                      >
                        <Server className="h-3 w-3" />
                        {p.label} 的 Base URL（仅影响本服务商）
                      </Label>
                      <Input
                        id={`bu-${pid}`}
                        placeholder={p.baseUrl || "https://api.example.com/v1"}
                        value={form.baseUrls[pid] ?? ""}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            baseUrls: { ...f.baseUrls, [pid]: e.target.value },
                          }))
                        }
                        autoComplete="off"
                        className="h-8 text-xs"
                      />
                      {form.baseUrls[pid] && isBlockedBaseUrl(form.baseUrls[pid]) ? (
                        <p className="text-[11px] text-destructive">
                          该地址指向内网或受限地址，会被服务端拒绝。
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
            </div>
          </div>

          {/* 添加自定义供应商 */}
          {isAdmin && ALLOW_CUSTOM_BASE_URL ? <CustomProviderEditor /> : null}

          {/* 模型：已移到输入框左下角的小选择框 */}
          <div className="rounded-xl border border-border/70 bg-card/40 px-3 py-2.5 text-xs text-muted-foreground">
            模型可在聊天输入框左下角的小框里切换（当前：
            <span className="font-medium text-foreground">{form.model}</span>）。
          </div>

          {/* 对象存储：图片 / 视频上传 —— 仅管理员可见 */}
          {!isAdmin ? null : (
          <details className="rounded-xl border border-border/70 bg-card/40 px-3 py-2">
            <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium">
              <CloudUpload className="h-4 w-4" />
              对象存储（图片 / 视频上传）
              {form.s3?.enabled ? (
                <span className="ml-auto rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary">
                  已启用
                </span>
              ) : null}
            </summary>

            <div className="mt-3 space-y-3">
              {siteInfo?.siteManaged ? (
                <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
                  <p className="text-xs font-medium text-primary">站点已配置 R2，可直接使用</p>
                  <p className="text-[11px] text-muted-foreground">
                    管理员已在服务端配好存储桶。点下面的按钮即可上传，
                    <strong> 你不需要填写任何密钥</strong>。
                    {siteInfo.bucket ? ` 桶名：${siteInfo.bucket}` : ""}
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant={form.s3?.useSiteConfig ? "default" : "outline"}
                    className="h-7 text-xs"
                    onClick={() =>
                      patchS3({
                        enabled: true,
                        useSiteConfig: true,
                        endpoint: siteInfo.endpoint,
                        region: "auto",
                        bucket: siteInfo.bucket,
                        publicBaseUrl: siteInfo.publicBaseUrl,
                        accessKeyId: "",
                        secretAccessKey: "",
                      })
                    }
                  >
                    {form.s3?.useSiteConfig ? "✓ 正在使用站点配置" : "使用站点配置（推荐）"}
                  </Button>
                </div>
              ) : null}

              <div className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2">
                <div className="pr-3">
                  <p className="text-sm">启用对象存储</p>
                  <p className="text-xs text-muted-foreground">
                    开启后图片 / 视频上传到你的存储桶，只回传链接
                  </p>
                </div>
                <Switch
                  checked={Boolean(form.s3?.enabled)}
                  onCheckedChange={(v) => patchS3({ enabled: v })}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">服务商预设</Label>
                <div className="flex flex-wrap gap-1.5">
                  {availablePresets.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() =>
                        patchS3({
                          endpoint: preset.endpointHint,
                          region: preset.regionHint,
                        })
                      }
                      title={preset.note}
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-[11px] transition-colors",
                        preset.limited
                          ? "border-amber-500/40 text-amber-600 hover:bg-amber-500/10"
                          : preset.recommended
                            ? "border-primary/40 text-primary hover:bg-primary/10"
                            : "border-border text-muted-foreground hover:bg-muted",
                      )}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  点击预设会填入 Endpoint 与 Region 示例，把尖括号部分换成你自己的。
                </p>
              </div>

              {form.s3?.useSiteConfig ? (
                <p className="rounded-lg border border-border/60 px-3 py-2 text-[11px] text-muted-foreground">
                  当前使用站点托管的 R2，密钥保存在服务器，浏览器不持有。
                  如需改用你自己的存储，关掉上面的「使用站点配置」再填写。
                </p>
              ) : null}

              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs">Endpoint</Label>
                  <Input
                    placeholder="https://<accountid>.r2.cloudflarestorage.com"
                    value={s3.endpoint}
                    onChange={(e) => patchS3({ endpoint: e.target.value })}
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Region</Label>
                  <Input
                    placeholder="auto"
                    value={s3.region}
                    onChange={(e) => patchS3({ region: e.target.value })}
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Bucket</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="只填桶名，如 agnes-chat"
                      value={s3.bucket}
                      onChange={(e) => patchS3({ bucket: e.target.value })}
                      autoComplete="off"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-9 shrink-0 text-xs"
                      disabled={discovering}
                      onClick={() => void discoverBucket()}
                      title="用桶名自动查找并填入 Endpoint"
                    >
                      {discovering ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Search className="h-3.5 w-3.5" />
                      )}
                      自动寻找
                    </Button>
                  </div>
                  {discoverMsg ? (
                    <p
                      className={`text-[11px] ${
                        discoverMsg.startsWith("已找到") ? "text-primary" : "text-destructive"
                      }`}
                    >
                      {discoverMsg}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">目录前缀</Label>
                  <Input
                    placeholder="agnes-chat"
                    value={s3.prefix ?? ""}
                    onChange={(e) => patchS3({ prefix: e.target.value })}
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Access Key ID</Label>
                  <Input
                    placeholder="AKIA... / R2 的 Access Key ID"
                    value={s3.accessKeyId}
                    onChange={(e) => patchS3({ accessKeyId: e.target.value })}
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Secret Access Key</Label>
                  <div className="relative">
                    <Input
                      type={showSecret ? "text" : "password"}
                      placeholder="Secret Access Key"
                      value={s3.secretAccessKey}
                      onChange={(e) => patchS3({ secretAccessKey: e.target.value })}
                      className="pr-10"
                      autoComplete="off"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSecret((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:bg-muted"
                      aria-label="显示/隐藏 Secret"
                    >
                      {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">公开访问域名（可选）</Label>
                <Input
                  placeholder="https://cdn.example.com（留空则用 Endpoint 拼）"
                  value={s3.publicBaseUrl ?? ""}
                  onChange={(e) => patchS3({ publicBaseUrl: e.target.value })}
                  autoComplete="off"
                />
                <p className="text-[11px] text-muted-foreground">
                  填了自定义域名就用它拼外链；留空则用 Endpoint/Bucket/Key。
                </p>
              </div>

              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
                <p className="font-medium text-amber-600 dark:text-amber-400">两个必要设置</p>
                <p className="mt-1">
                  1. 存储桶要允许<strong>公开读</strong>，否则模型打不开链接；
                </p>
                <p>
                  2. 存储桶 CORS 要允许你的站点域名做 <code className="rounded bg-muted px-1">PUT</code>
                  ，否则浏览器直传会被拦。
                </p>
                <p className="mt-1">
                  凭证只存在你的浏览器，上传链接由服务端签名，文件<strong>不经过本站服务器</strong>。
                </p>
                {availablePresets[0]?.platform === "cloudflare" ? (
                  <p className="mt-1">
                    当前部署在 <strong>Cloudflare Workers</strong>，仅支持 Cloudflare R2（零出站流量费）。
                  </p>
                ) : null}
                {availablePresets[0]?.platform === "vercel" ? (
                  <p className="mt-1">
                    当前部署在 <strong>Vercel</strong>，仅支持 Backblaze B2。B2 的 S3 兼容层只覆盖部分操作，
                    若上传报 501 请改用其原生 API 或换到 Cloudflare 部署。
                  </p>
                ) : null}
              </div>
            </div>
          </details>
          )}

          {/* 云端保存 —— 仅管理员可见（站点级配置已移到 /admin） */}
          {!isAdmin ? null : user ? (
            <div className="flex items-center justify-between rounded-xl border border-border/70 bg-card/40 px-3 py-3">
              <div className="pr-3">
                <p className="text-sm font-medium">保存聊天记录到云端</p>
                <p className="text-xs text-muted-foreground">
                  关闭时聊天记录只存本地；开启后会同步到服务端存储（仅本人可见）
                </p>
              </div>
              <Switch checked={cloudSync} onCheckedChange={onCloudSyncChange} />
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">
              登录后可把聊天记录保存到云端（默认关闭）。
            </div>
          )}

          {/* 普通用户提示：高级配置已移至管理员面板 */}
          {isAdmin ? null : (
            <div className="rounded-xl border border-border/70 bg-muted/40 px-3 py-2.5 text-[11px] text-fg-tertiary">
              Base URL、对象存储、云端保存等站点级配置仅限管理员调整，详见「管理员面板」。
            </div>
          )}

          {/* 清空 */}
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-3">
            <p className="text-sm font-medium text-destructive">清空全部数据</p>
            <p className="mt-1 text-xs text-muted-foreground">
              清除本地保存的 API Key、模型选择与全部聊天记录（不可恢复）。
            </p>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="mt-3"
              onClick={() => {
                onClearAll();
                onOpenChange(false);
              }}
            >
              <Trash2 className="h-4 w-4" />
              清空全部数据
            </Button>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit">保存</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
