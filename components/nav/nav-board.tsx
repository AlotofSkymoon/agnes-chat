"use client";

import * as React from "react";
import { ExternalLink, Loader2, Search, Sparkles } from "lucide-react";

import { useI18n } from "@/components/i18n-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DEFAULT_NAV, type NavCategory } from "@/lib/nav-data";
import { cn } from "@/lib/utils";

interface TldPayload {
  tlds: string[];
  count: number;
  source: "cache" | "iana" | "fallback";
}

export function NavBoard() {
  const { t } = useI18n();
  const [categories, setCategories] = React.useState<NavCategory[]>(DEFAULT_NAV);
  const [query, setQuery] = React.useState("");
  const [tab, setTab] = React.useState<"tools" | "tld">("tools");

  // 域名后缀
  const [tlds, setTlds] = React.useState<string[]>([]);
  const [tldMeta, setTldMeta] = React.useState<{ count: number; source: string } | null>(null);
  const [tldQuery, setTldQuery] = React.useState("");
  const [tldLoading, setTldLoading] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    fetch("/api/nav")
      .then((r) => r.json())
      .then((d) => {
        if (alive && Array.isArray(d.categories) && d.categories.length) setCategories(d.categories);
      })
      .catch(() => {
        /* 用默认数据 */
      });
    return () => {
      alive = false;
    };
  }, []);

  const loadTlds = React.useCallback(async () => {
    if (tlds.length > 0) return;
    setTldLoading(true);
    try {
      const res = await fetch("/api/tlds");
      const data = (await res.json()) as TldPayload;
      setTlds(data.tlds ?? []);
      setTldMeta({ count: data.count ?? 0, source: data.source });
    } catch {
      setTldMeta({ count: 0, source: "error" });
    } finally {
      setTldLoading(false);
    }
  }, [tlds.length]);

  React.useEffect(() => {
    if (tab === "tld") void loadTlds();
  }, [tab, loadTlds]);

  const q = query.trim().toLowerCase();
  const filtered = React.useMemo(() => {
    if (!q) return categories;
    return categories
      .map((c) => ({
        ...c,
        items: c.items.filter(
          (i) =>
            i.name.toLowerCase().includes(q) ||
            (i.desc ?? "").toLowerCase().includes(q) ||
            i.url.toLowerCase().includes(q),
        ),
      }))
      .filter((c) => c.items.length > 0);
  }, [categories, q]);

  const tq = tldQuery.trim().toLowerCase().replace(/^\./, "");
  const filteredTlds = React.useMemo(
    () => (tq ? tlds.filter((t) => t.includes(tq)) : tlds),
    [tlds, tq],
  );

  // 按首字母分组
  const grouped = React.useMemo(() => {
    const map = new Map<string, string[]>();
    for (const t of filteredTlds) {
      const first = t[0]?.toUpperCase() ?? "#";
      const key = /[A-Z]/.test(first) ? first : "#";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredTlds]);

  const totalLinks = categories.reduce((n, c) => n + c.items.length, 0);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      {/* Header */}
      <div className="mb-8 text-center">
        <h1 className="bg-gradient-to-r from-violet-500 to-blue-500 bg-clip-text text-3xl font-bold tracking-tight text-transparent sm:text-4xl">
          {t("nav.titleMain")}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          🚀 {t("nav.tagline")}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          📡 {t("nav.source")}
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex justify-center gap-2">
        <button
          onClick={() => setTab("tools")}
          className={cn(
            "rounded-full px-4 py-2 text-sm font-medium transition-all",
            tab === "tools"
              ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
              : "border border-border/70 bg-card/50 text-muted-foreground hover:text-foreground",
          )}
        >
          🧰 {t("nav.tools")}
        </button>
        <button
          onClick={() => setTab("tld")}
          className={cn(
            "rounded-full px-4 py-2 text-sm font-medium transition-all",
            tab === "tld"
              ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
              : "border border-border/70 bg-card/50 text-muted-foreground hover:text-foreground",
          )}
        >
          📄 {t("nav.tlds")}
        </button>
      </div>

      {tab === "tools" ? (
        <>
          {/* Search */}
          <div className="relative mx-auto mb-8 max-w-xl">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`${t("nav.searchSites")} ${totalLinks} ${t("nav.sitesUnit")}`}
              className="pl-9"
            />
          </div>

          {/* Categories */}
          <div className="space-y-8">
            {filtered.map((cat) => (
              <section key={cat.id}>
                <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
                  <span>{cat.icon}</span>
                  {cat.title}
                  <Badge variant="secondary" className="ml-1 font-normal">
                    {cat.items.length}
                  </Badge>
                </h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {cat.items.map((item) => (
                    <a
                      key={item.id}
                      href={item.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      onMouseMove={(e) => {
                        const el = e.currentTarget as HTMLElement;
                        const r = el.getBoundingClientRect();
                        el.style.setProperty("--mx", `${((e.clientX - r.left) / r.width) * 100}%`);
                        el.style.setProperty("--my", `${((e.clientY - r.top) / r.height) * 100}%`);
                      }}
                      className="acet-spotlight group relative flex flex-col rounded-xl border border-border/70 bg-card/60 p-4 transition-all hover:border-primary/50 hover:bg-accent hover:shadow-md"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-medium leading-snug">{item.name}</span>
                        {item.recommended ? (
                          <Badge className="shrink-0 text-[10px]">{t("nav.recommended")}</Badge>
                        ) : null}
                      </div>
                      {item.desc ? (
                        <span className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">
                          {item.desc}
                        </span>
                      ) : null}
                      <span className="mt-2 flex items-center gap-1 text-[11px] text-primary opacity-0 transition-opacity group-hover:opacity-100">
                        {t("nav.visit")}
                        <ExternalLink className="h-3 w-3" />
                      </span>
                    </a>
                  ))}
                </div>
              </section>
            ))}
            {filtered.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">{t("nav.noMatch")}</p>
            ) : null}
          </div>
        </>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4" />
              {t("nav.tldLookup")}
            </CardTitle>
            <CardDescription>
              {tldMeta
                ? tldMeta.source === "iana" || tldMeta.source === "cache"
                  ? `${t("nav.authoritative")} · ${t("nav.totalUnit")} ${tldMeta.count} ${t("nav.tldUnit")}`
                  : tldMeta.source === "fallback"
                    ? `${t("nav.builtIn")} · ${t("nav.totalUnit")} ${tldMeta.count} ${t("nav.tldUnit")}`
                    : t("nav.loadFailed")
                : t("nav.loading")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={tldQuery}
                onChange={(e) => setTldQuery(e.target.value)}
                placeholder={t("nav.tldPlaceholder")}
                className="pl-9"
                disabled={tldLoading}
              />
            </div>

            {tldLoading ? (
              <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("nav.fetchingIana")}
              </div>
            ) : (
              <>
                <div className="mb-4 flex flex-wrap gap-1.5">
                  {grouped.map(([letter]) => (
                    <a
                      key={letter}
                      href={`#tld-${letter}`}
                      className="rounded-md border border-border/70 px-2 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                    >
                      {letter}
                    </a>
                  ))}
                </div>

                <div className="max-h-[60vh] space-y-5 overflow-y-auto pr-1">
                  {grouped.map(([letter, list]) => (
                    <div key={letter} id={`tld-${letter}`}>
                      <div className="mb-2 sticky top-0 bg-card/95 py-1 text-sm font-semibold text-primary backdrop-blur">
                        {letter}
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          {list.length}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {list.map((t) => (
                          <code
                            key={t}
                            className="rounded-md border border-border/60 bg-muted/50 px-2 py-1 text-xs"
                          >
                            .{t}
                          </code>
                        ))}
                      </div>
                    </div>
                  ))}
                  {grouped.length === 0 ? (
                    <p className="py-10 text-center text-sm text-muted-foreground">
                      {tq ? `${t("nav.noTldMatch")} ".${tq}" ${t("nav.tldUnit")}` : t("nav.noData")}
                    </p>
                  ) : null}
                </div>

                {tldQuery ? (
                  <p className="mt-3 text-xs text-muted-foreground">
                    {t("nav.matched")} {filteredTlds.length} {t("nav.tldUnit")}
                  </p>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>
      )}

      <p className="mt-10 text-center text-xs text-muted-foreground">
        {t("nav.communityNote")}
      </p>
    </div>
  );
}
