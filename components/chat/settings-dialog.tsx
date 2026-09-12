"use client";

import * as React from "react";
import { Eye, EyeOff, ExternalLink, KeyRound, Server, Trash2 } from "lucide-react";

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
import { AGENT_TIP, PROVIDERS, type ProviderId } from "@/lib/config";

export interface ChatSettings {
  /** 各服务商的 Key */
  keys: Record<ProviderId, string>;
  /** 自定义 Base URL，留空则用模型所属服务商的默认地址 */
  baseUrl: string;
  model: string;
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
  const [showKey, setShowKey] = React.useState<Record<ProviderId, boolean>>({
    agnes: false,
    deepseek: false,
  });

  React.useEffect(() => {
    if (open) setForm(settings);
  }, [open, settings]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    onSave({
      keys: {
        agnes: form.keys.agnes.trim(),
        deepseek: form.keys.deepseek.trim(),
      },
      baseUrl: form.baseUrl.trim(),
      model: form.model,
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
          {/* API Keys（按服务商） */}
          <div className="space-y-4">
            <Label className="flex items-center gap-2">
              <KeyRound className="h-4 w-4" />
              API Key
            </Label>

            {PROVIDER_ORDER.map((pid) => {
              const p = PROVIDERS[pid];
              return (
                <div key={pid} className="space-y-1.5 rounded-xl border border-border/70 bg-card/40 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{p.label}</span>
                    <a
                      href={p.keyUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      去申请
                      <ExternalLink className="h-3 w-3" />
                    </a>
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
                    {p.hasPreset
                      ? "保存在浏览器本地，仅用于向 Agnes 发起请求。"
                      : "DeepSeek 无内置 Key，需填你自己的；仅保存在浏览器本地。"}
                  </p>
                </div>
              );
            })}
          </div>

          {/* 模型：已移到输入框左下角的小选择框 */}
          <div className="rounded-xl border border-border/70 bg-card/40 px-3 py-2.5 text-xs text-muted-foreground">
            模型可在聊天输入框左下角的小框里切换（当前：
            <span className="font-medium text-foreground">{form.model}</span>）。
          </div>

          {/* 高级：Base URL */}
          <details className="rounded-xl border border-border/70 bg-card/40 px-3 py-2">
            <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium">
              <Server className="h-4 w-4" />
              自定义 Base URL（高级）
            </summary>
            <div className="mt-3 space-y-1.5">
              <Input
                placeholder="留空则自动使用所选模型的官方地址"
                value={form.baseUrl}
                onChange={(e) => setForm((f) => ({ ...f, baseUrl: e.target.value }))}
                autoComplete="off"
              />
              <p className="text-[11px] text-muted-foreground">
                Agnes：{PROVIDERS.agnes.baseUrl} · DeepSeek：{PROVIDERS.deepseek.baseUrl}
              </p>
            </div>
          </details>

          {/* 云端保存 */}
          {user ? (
            <div className="flex items-center justify-between rounded-xl border border-border/70 bg-card/40 px-3 py-3">
              <div className="pr-3">
                <p className="text-sm font-medium">保存聊天记录到云端</p>
                <p className="text-xs text-muted-foreground">
                  关闭时聊天记录只存本地；开启后会同步到 Upstash Redis（仅本人可见）
                </p>
              </div>
              <Switch checked={cloudSync} onCheckedChange={onCloudSyncChange} />
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">
              登录后可把聊天记录保存到云端（默认关闭）。
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
