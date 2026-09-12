import Link from "next/link";

import { AUTHOR_NAME, REPO_URL, SITE_NAME, UPSTREAM_URL } from "@/lib/site";

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
      <p className="mt-1 text-fg-quaternary">
        代码开源（MIT），公开部署需获作者授权 · 详见 LICENSE
      </p>
    </footer>
  );
}
