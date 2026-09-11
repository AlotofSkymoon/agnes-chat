"use client";

import * as React from "react";
import { Eye, EyeOff, KeyRound, Server, Trash2 } from "lucide-react";

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
import { AGENT_TIP, AGNES_MODELS, DEFAULT_BASE_URL } from "@/lib/config";

export interface ChatSettings {
  apiKey: string;
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
  const [showKey, setShowKey] = React.useState(false);

  React.useEffect(() => {
    if (open) setForm(settings);
  }, [open, settings]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    onSave({
      apiKey: form.apiKey.trim(),
      baseUrl: form.baseUrl.trim() || DEFAULT_BASE_URL,
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
          <div className="space-y-2">
            <Label htmlFor="apiKey" className="flex items-center gap-2">
              <KeyRound className="h-4 w-4" />
              Agnes API Key
            </Label>
            <div className="relative">
              <Input
                id="apiKey"
                type={showKey ? "text" : "password"}
                placeholder="sk-...（留空则使用站点内置 Key）"
                value={form.apiKey}
                onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
                className="pr-10"
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:bg-muted"
                aria-label="显示/隐藏 Key"
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              保存在浏览器 localStorage，仅用于向 Agnes 发起请求。留空则使用本站内置 Key。
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="baseUrl" className="flex items-center gap-2">
              <Server className="h-4 w-4" />
              Base URL
            </Label>
            <Input
              id="baseUrl"
              placeholder={DEFAULT_BASE_URL}
              value={form.baseUrl}
              onChange={(e) => setForm((f) => ({ ...f, baseUrl: e.target.value }))}
              autoComplete="off"
            />
          </div>

          <div className="space-y-2">
            <Label>模型</Label>
            <div className="grid gap-2">
              {AGNES_MODELS.map((m) => {
                const active = form.model === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, model: m.id }))}
                    className={`flex items-center justify-between rounded-xl border px-3 py-2.5 text-left transition-all ${
                      active
                        ? "border-primary/60 bg-primary/10"
                        : "border-border/70 bg-card/40 hover:border-primary/30"
                    }`}
                  >
                    <span>
                      <span className="block text-sm font-medium">{m.label}</span>
                      <span className="block text-xs text-muted-foreground">{m.desc}</span>
                    </span>
                    <span
                      className={`h-4 w-4 rounded-full border-2 ${
                        active ? "border-primary bg-primary" : "border-muted-foreground/40"
                      }`}
                    />
                  </button>
                );
              })}
            </div>
          </div>

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
