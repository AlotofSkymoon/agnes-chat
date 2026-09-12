"use client";

import * as React from "react";
import { Check, ChevronDown } from "lucide-react";

import {
  CHAT_MODELS,
  PROVIDERS,
  type CustomProviderConfig,
  type ProviderId,
} from "@/lib/config";
import { cn } from "@/lib/utils";

interface ModelPickerProps {
  value: string;
  onChange: (modelId: string) => void;
  className?: string;
  /** 用户自建的供应商，用于把它们的模型也列进下拉 */
  customProviders?: CustomProviderConfig[];
}

const PROVIDER_ORDER: ProviderId[] = ["agnes", "deepseek"];

/** 模型名全是拉丁字符，强制走 Montserrat */
const MONTSERRAT = 'Montserrat, -apple-system, BlinkMacSystemFont, system-ui, sans-serif';

/** 输入框内的小模型选择框（不占全屏，点开是下拉小菜单） */
export function ModelPicker({ value, onChange, className, customProviders = [] }: ModelPickerProps) {
  const [open, setOpen] = React.useState(false);
  const wrapRef = React.useRef<HTMLDivElement>(null);

  /** 内置 + 自定义，拼成统一的分组列表 */
  const groups = React.useMemo(() => {
    const builtin = PROVIDER_ORDER.map((pid) => ({
      key: pid as string,
      label: PROVIDERS[pid].label,
      items: CHAT_MODELS.filter((m) => m.provider === pid).map((m) => ({
        id: m.id,
        label: m.label,
        desc: m.desc,
      })),
    }));
    const custom = customProviders.map((c) => ({
      key: c.id,
      label: c.label,
      items: c.models.map((id) => ({ id, label: id, desc: "自定义供应商" })),
    }));
    return [...builtin, ...custom].filter((g) => g.items.length > 0);
  }, [customProviders]);

  const allModels = React.useMemo(() => groups.flatMap((g) => g.items), [groups]);
  const current = allModels.find((m) => m.id === value) ?? allModels[0] ?? CHAT_MODELS[0];

  // 点击外部 / Esc 关闭
  React.useEffect(() => {
    if (!open) return;
    function onDocDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        title="切换模型"
        style={{ fontFamily: MONTSERRAT }}
        className={cn(
          "flex max-w-full items-center gap-1 rounded-full border border-border/70 bg-background px-2.5 py-1 font-sans text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground",
          open && "border-primary/50 text-foreground",
        )}
      >
        <span className="truncate">{current.label}</span>
        <ChevronDown className={cn("h-3 w-3 shrink-0 transition-transform", open && "rotate-180")} />
      </button>

      {open ? (
        <div
          role="listbox"
          style={{ fontFamily: MONTSERRAT }}
          className="absolute bottom-full left-0 z-50 mb-2 w-60 overflow-hidden rounded-xl border border-border bg-popover p-1 font-sans shadow-xl shadow-black/10 animate-fade-in"
        >
          {groups.map((g) => {
            const list = g.items;
            return (
              <div key={g.key} className="mb-1 last:mb-0">
                <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {g.label}
                </div>
                {list.map((m) => {
                  const active = m.id === value;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      role="option"
                      aria-selected={active}
                      onClick={() => {
                        onChange(m.id);
                        setOpen(false);
                      }}
                      className={cn(
                        "flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left transition-colors",
                        active ? "bg-primary/10" : "hover:bg-muted",
                      )}
                    >
                      <span className="min-w-0 flex-1">
                        <span
                          className={cn(
                            "block truncate text-sm",
                            active ? "font-medium text-primary" : "text-foreground",
                          )}
                        >
                          {m.label}
                        </span>
                        <span className="block truncate text-[11px] text-muted-foreground">
                          {m.desc}
                        </span>
                      </span>
                      {active ? <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" /> : null}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
