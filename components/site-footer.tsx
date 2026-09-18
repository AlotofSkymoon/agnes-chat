"use client";

import * as React from "react";
import Link from "next/link";

import { SiteFooterBadge } from "@/components/site-footer-badge";
import {
  AUTHOR_NAME,
  BY_LINE,
  REPO_URL,
  SITE_NAME,
  UPSTREAM_URL,
} from "@/lib/site";

/**
 * 全站页脚。
 * 按 LICENSE 第四条的署名要求，创作者与上游来源必须可见，不可移除。
 *
 * ⚠️ 为什么改成客户端组件 + 运行时拉取：
 * 备案信息以前只能靠环境变量配，改一次要重新部署，非常麻烦。
 * 现在管理员在面板里填完即生效，所以页脚得在运行时去取站点设置。
 *
 * 取不到时静默用空值 —— 页脚少几行不影响主功能，
 * 没必要因为一个接口失败就报错。
 */

interface FooterSettings {
  icpText: string;
  icpUrl: string;
  icpIconUrl: string;
  footerExtra: string;
}

const EMPTY: FooterSettings = {
  icpText: "",
  icpUrl: "",
  icpIconUrl: "",
  footerExtra: "",
};

export function SiteFooter({ className = "" }: { className?: string }) {
  const [footer, setFooter] = React.useState<FooterSettings>(EMPTY);

  React.useEffect(() => {
    let alive = true;
    fetch("/api/site-settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { settings?: Partial<FooterSettings> } | null) => {
        if (!alive || !d?.settings) return;
        setFooter({
          icpText: d.settings.icpText ?? "",
          icpUrl: d.settings.icpUrl ?? "",
          icpIconUrl: d.settings.icpIconUrl ?? "",
          footerExtra: d.settings.footerExtra ?? "",
        });
      })
      .catch(() => {
        /* 取不到就保持空，页脚照常显示署名部分 */
      });
    return () => {
      alive = false;
    };
  }, []);

  const hasCustom = Boolean(
    footer.icpText || footer.icpIconUrl || footer.footerExtra,
  );

  return (
    <footer
      className={`border-t border-border/60 px-4 py-4 text-center text-[11px] leading-relaxed text-fg-tertiary ${className}`}
    >
      <p>
        <span className="font-medium text-fg-secondary">{SITE_NAME}</span> 免费聊天站 · 由{" "}
        <span className="font-medium text-fg-secondary">{AUTHOR_NAME}</span> 创作
      </p>
      <p className="mt-1">
        上游项目迁移自{" "}
        <Link
          href={UPSTREAM_URL}
          target="_blank"
          rel="noreferrer noopener"
          className="underline decoration-dotted underline-offset-2 hover:text-primary"
        >
          AlotofSkymoon/agnes-chat
        </Link>
        {" · "}
        <Link
          href={REPO_URL}
          target="_blank"
          rel="noreferrer noopener"
          className="underline decoration-dotted underline-offset-2 hover:text-primary"
        >
          本项目源码
        </Link>
      </p>
      <p className="mt-1.5 text-fg-quaternary">
        代码开源（MIT），公开部署需获作者授权 · 详见 LICENSE
      </p>

      {/* 备案信息 + 自定义内容：管理员在面板里填，改完即生效 */}
      {hasCustom ? (
        <div className="mt-2 flex flex-col items-center gap-1.5">
          {/* 第三方备案徽章（图片挂了会自动隐藏） */}
          {footer.icpIconUrl ? (
            <SiteFooterBadge
              src={footer.icpIconUrl}
              alt="备案徽章"
              href={footer.icpUrl || undefined}
            />
          ) : null}

          {/* 备案号 */}
          {footer.icpText ? (
            <p className="text-fg-quaternary">
              {footer.icpUrl ? (
                <a
                  href={footer.icpUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="underline decoration-dotted underline-offset-2 hover:text-primary"
                >
                  {footer.icpText}
                </a>
              ) : (
                footer.icpText
              )}
            </p>
          ) : null}

          {/* 额外自定义文字 */}
          {footer.footerExtra ? (
            <p className="text-fg-quaternary">{footer.footerExtra}</p>
          ) : null}
        </div>
      ) : null}

      {/* 署名标识：按 LICENSE 要求保留，不可移除 */}
      <p className="mt-1 font-medium tracking-wide text-fg-tertiary">{BY_LINE}</p>
    </footer>
  );
}
