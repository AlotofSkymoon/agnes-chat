import Link from "next/link";

import { SiteFooterBadge } from "@/components/site-footer-badge";
import {
  AUTHOR_NAME,
  BY_LINE,
  FOOTER_EXTRA,
  HAS_CUSTOM_FOOTER,
  ICP_ICON_URL,
  ICP_TEXT,
  ICP_URL,
  REPO_URL,
  SITE_NAME,
  UPSTREAM_URL,
} from "@/lib/site";

/**
 * 全站页脚。
 * 按 LICENSE 第四条的署名要求，创作者与上游来源必须可见，不可移除。
 */
export function SiteFooter({ className = "" }: { className?: string }) {
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
      {/* 备案信息 + 自定义内容：站长按需配置 */}
      {HAS_CUSTOM_FOOTER ? (
        <div className="mt-2 flex flex-col items-center gap-1.5">
          {/* 第三方备案徽章（图片挂了会自动隐藏） */}
          {ICP_ICON_URL ? (
            <SiteFooterBadge src={ICP_ICON_URL} alt="备案徽章" href={ICP_URL || undefined} />
          ) : null}

          {/* 备案号 */}
          {ICP_TEXT ? (
            <p className="text-fg-quaternary">
              {ICP_URL ? (
                <a
                  href={ICP_URL}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="underline decoration-dotted underline-offset-2 hover:text-primary"
                >
                  {ICP_TEXT}
                </a>
              ) : (
                ICP_TEXT
              )}
            </p>
          ) : null}

          {/* 额外自定义文字 */}
          {FOOTER_EXTRA ? (
            <p className="text-fg-quaternary">{FOOTER_EXTRA}</p>
          ) : null}
        </div>
      ) : null}

      {/* 署名标识：按 LICENSE 要求保留，不可移除 */}
      <p className="mt-1 font-medium tracking-wide text-fg-tertiary">{BY_LINE}</p>
    </footer>
  );
}
