import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Coffee, Github, HeartHandshake, Share2 } from "lucide-react";

import { SponsorChannels } from "@/components/sponsor/sponsor-qr";
import { Beams, GridBackground, Meteors, Noise } from "@/components/ui/aceternity";
import { SiteFooter } from "@/components/site-footer";
import {
  PROJECT_LINK,
  REPO_URL,
  SHOW_SOURCE_LINKS,
  SITE_NAME,
  SPONSOR_ENABLED,
  SPONSOR_CHANNELS,
  pageTitle,
} from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata = {
  title: pageTitle("赞助"),
  description: "支持本项目继续维护：服务器、API 额度与域名都需要成本",
};

/**
 * 资金去向 —— 写清楚比含糊的「请我喝杯咖啡」更有说服力。
 *
 * 服务器、域名、API 额度用的都是免费额度，站长本人不担心这块。
 * 赞助实际是拿去贴补生活经费与日常购物，所以照实说，不包装成"服务器费用"。
 */
const USES = [
  { label: "生活经费", desc: "站长是名学生，赞助用来贴补日常开销" },
  { label: "日常购物", desc: "买点想要的东西，就这么简单" },
  { label: "继续做下去的动力", desc: "有人愿意付钱，说明这东西真的有用" },
];

/** 不出钱也能帮忙的方式 */
const OTHER_WAYS = [
  {
    icon: Github,
    title: "Star 一下",
    desc: "在 GitHub 上给项目点个 Star，是最省力的支持",
    href: REPO_URL,
    cta: "前往仓库",
  },
  {
    icon: Share2,
    title: "分享给朋友",
    desc: "有人用得上，比什么都实在",
    href: null,
    cta: null,
  },
  {
    icon: HeartHandshake,
    title: "反馈问题",
    desc: "提 Issue 或 PR，帮项目变得更稳",
    href: `${REPO_URL}/issues`,
    cta: "提交反馈",
  },
];

export default function SponsorPage() {
  if (!SPONSOR_ENABLED) notFound();

  /*
   * Star / 提 Issue 都指向仓库地址 —— 与页脚同理，默认不暴露。
   * 关掉后只剩「分享给朋友」这条不依赖外链的方式。
   */
  const otherWays = SHOW_SOURCE_LINKS
    ? OTHER_WAYS
    : OTHER_WAYS.filter((w) => !w.href);

  return (
    <main className="relative min-h-screen-safe">
      {/* 与导航站一致的 Aceternity 风格背景 */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] aurora" />
      <GridBackground className="h-[420px]" />
      <Beams count={8} className="h-[420px]" />
      <Meteors count={10} className="h-[420px]" />
      <Noise className="h-[420px]" />

      <div className="relative mx-auto max-w-3xl px-4 py-10 sm:py-14">
        {/* 返回聊天 */}
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          返回聊天
        </Link>

        {/* 标题 */}
        <header className="mb-10 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Coffee className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            支持 {SITE_NAME}
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-fg-secondary">
            本站永久免费、无广告、不采集隐私数据。
            <br className="hidden sm:block" />
            服务器、域名、API 额度用的都是免费额度，站长不担心这块 ——
            <br className="hidden sm:block" />
            赞助会直接变成他的生活经费和购物基金。
          </p>
        </header>

        {/* 收款码 —— 客户端组件，图片加载失败时优雅降级 */}
        <SponsorChannels channels={SPONSOR_CHANNELS} />

        {/* 资金去向 */}
        <section className="mt-10">
          <h2 className="mb-4 text-center text-sm font-medium text-fg-secondary">
            赞助用在哪
          </h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {USES.map((u) => (
              <div
                key={u.label}
                className="rounded-[var(--radius-card)] border border-border bg-card/60 px-4 py-4 backdrop-blur-xl"
              >
                <p className="text-sm font-medium">{u.label}</p>
                <p className="mt-1.5 text-xs leading-relaxed text-fg-tertiary">
                  {u.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* 其他支持方式 */}
        <section className="mt-10">
          <h2 className="mb-4 text-center text-sm font-medium text-fg-secondary">
            不出钱也能帮忙
          </h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {otherWays.map((w) => {
              const Icon = w.icon;
              const body = (
                <>
                  <Icon className="mb-2.5 h-4 w-4 text-primary" />
                  <p className="text-sm font-medium">{w.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-fg-tertiary">
                    {w.desc}
                  </p>
                  {w.cta ? (
                    <span className="mt-2.5 inline-block text-xs font-medium text-primary">
                      {w.cta} →
                    </span>
                  ) : null}
                </>
              );
              return w.href ? (
                <Link
                  key={w.title}
                  href={w.href}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="rounded-[var(--radius-card)] border border-border bg-card/60 px-4 py-4 backdrop-blur-xl transition-transform hover:scale-[1.02]"
                >
                  {body}
                </Link>
              ) : (
                <div
                  key={w.title}
                  className="rounded-[var(--radius-card)] border border-border bg-card/60 px-4 py-4 backdrop-blur-xl"
                >
                  {body}
                </div>
              );
            })}
          </div>
        </section>

        {/* 说明 */}
        <p className="mt-10 text-center text-xs leading-relaxed text-fg-tertiary">
          赞助完全自愿，不影响任何功能使用。
          <br />
          本站不提供任何付费会员或增值服务。
          <br />
          站长是名学生，每一笔都会用在生活与日常开销上。
        </p>

        {SHOW_SOURCE_LINKS ? (
          <div className="mt-8 flex justify-center">
            <Link
              href={PROJECT_LINK}
              target="_blank"
              rel="noreferrer noopener"
              className="text-xs text-fg-quaternary underline decoration-dotted underline-offset-2 hover:text-fg-secondary"
            >
              项目主页
            </Link>
          </div>
        ) : null}
      </div>

      <SiteFooter />
    </main>
  );
}
