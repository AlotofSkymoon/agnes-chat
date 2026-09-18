"use client";

import * as React from "react";

/**
 * 站点备案信息。
 *
 * 备案是在管理员面板里配的，改完即时生效，
 * 所以不能像主题那样在构建时读环境变量，得运行时去取。
 *
 * 多个组件都要用（页脚、聊天区底部），
 * 抽成 hook 避免每处各写一遍请求和兜底逻辑。
 */

export interface IcpInfo {
  icpText: string;
  icpUrl: string;
  icpIconUrl: string;
  footerExtra: string;
}

const EMPTY: IcpInfo = {
  icpText: "",
  icpUrl: "",
  icpIconUrl: "",
  footerExtra: "",
};

export function useSiteIcp(): IcpInfo {
  const [info, setInfo] = React.useState<IcpInfo>(EMPTY);

  React.useEffect(() => {
    let alive = true;
    fetch("/api/site-settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { settings?: Partial<IcpInfo> } | null) => {
        if (!alive || !d?.settings) return;
        setInfo({
          icpText: d.settings.icpText ?? "",
          icpUrl: d.settings.icpUrl ?? "",
          icpIconUrl: d.settings.icpIconUrl ?? "",
          footerExtra: d.settings.footerExtra ?? "",
        });
      })
      .catch(() => {
        /* 取不到就保持空，不影响主功能 */
      });
    return () => {
      alive = false;
    };
  }, []);

  return info;
}

/**
 * 从一段 HTML 里解析出备案链接和文字。
 *
 * 第三方备案（萌备案 icp.gov.moe 等）给的是一整段 <a> 标签，
 * 让用户手动拆成"备案号"和"链接"两个框很别扭。
 * 粘贴进去自动拆开。
 *
 * 支持两种输入：
 *   <a href="https://icp.gov.moe/?keyword=20260645" target="_blank">萌ICP备20260645号</a>
 *   https://icp.gov.moe/?keyword=20260645
 */
export function parseIcpInput(
  input: string,
): { icpText: string; icpUrl: string } | null {
  const raw = input.trim();
  if (!raw) return null;

  // 形态一：完整的 <a> 标签
  const anchor = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i.exec(raw);
  if (anchor) {
    const url = anchor[1].trim();
    const text = anchor[2].replace(/<[^>]*>/g, "").trim();
    if (url) return { icpText: text, icpUrl: url };
  }

  // 形态二：裸链接 —— 只填 URL，文字留空让站长自己补
  if (/^https?:\/\//i.test(raw)) {
    return { icpText: "", icpUrl: raw };
  }

  return null;
}
